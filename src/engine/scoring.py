"""SpotScorer — the core scoring engine.

Takes raw forecast data + tide data for a specific spot and time,
and produces 9 component scores (0-1) plus a weighted total (0-10).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import SCORE_COMPONENTS, SPOTS
from src.engine.spot_profile import SpotProfile
from src.engine.spectral import consistency_score, spectral_purity_score
from src.engine.tide_bathy import tide_bathy_score
from src.engine.wind_model import angle_diff, wind_score, wind_trend_score
from src.collectors.tides import predict_tide, tide_percentage
from src.models.orm import ForecastData, ScoredForecast, TideData


@dataclass
class RawConditions:
    """Raw parameters for a single time slot at a single spot."""

    wave_height: float | None = None
    wave_direction: float | None = None
    wave_period: float | None = None
    swell_height: float | None = None
    swell_direction: float | None = None
    swell_period: float | None = None
    swell2_height: float | None = None
    swell2_direction: float | None = None
    swell2_period: float | None = None
    wind_speed: float | None = None
    wind_direction: float | None = None
    wind_gusts: float | None = None
    tide_height: float | None = None
    tide_pct: float | None = None

    # Wind history (last 6 hours) for trend detection
    wind_speed_history: list[float | None] | None = None
    wind_dir_history: list[float | None] | None = None


@dataclass
class ScoreResult:
    """Complete scoring output for a single time slot."""

    spot_id: str
    forecast_time: datetime
    components: dict[str, float]
    total_score: float
    rating: str
    summary: str
    conditions: RawConditions


class SpotScorer:
    """Scores surf quality for a specific spot."""

    def __init__(self, spot_id: str) -> None:
        self.profile = SpotProfile(spot_id)

    def score(self, cond: RawConditions) -> dict[str, float]:
        """Compute all 9 component scores from raw conditions."""
        return {
            "swell_quality": self._swell_quality(cond),
            "swell_direction": self._swell_direction(cond),
            "period": self._period(cond),
            "spectral_purity": self._spectral_purity(cond),
            "wind": self._wind(cond),
            "wind_trend": self._wind_trend(cond),
            "tide": self._tide(cond),
            "tide_bathy_interaction": self._tide_bathy(cond),
            "consistency": self._consistency(cond),
        }

    def total(self, components: dict[str, float]) -> float:
        """Compute weighted total score (0-10 scale)."""
        weighted_sum = 0.0
        weight_total = 0.0

        for comp in SCORE_COMPONENTS:
            w = self.profile.weight(comp)
            weighted_sum += components[comp] * w
            weight_total += w

        if weight_total == 0:
            return 0.0

        # Normalize to 0-10
        return round((weighted_sum / weight_total) * 10, 1)

    def full_score(self, cond: RawConditions, forecast_time: datetime) -> ScoreResult:
        """Complete scoring pipeline: components → total → rating → summary."""
        components = self.score(cond)
        total = self.total(components)
        rating = score_to_rating(total)
        summary = self._generate_summary(components, cond, total, rating)

        return ScoreResult(
            spot_id=self.profile.id,
            forecast_time=forecast_time,
            components=components,
            total_score=total,
            rating=rating,
            summary=summary,
            conditions=cond,
        )

    # ----- Component scoring functions -----

    def _swell_quality(self, cond: RawConditions) -> float:
        """Is wave height in the sweet spot for this beach?"""
        h = cond.swell_height or cond.wave_height
        if h is None or h < 0.1:
            return 0.0  # flat

        lo, hi = self.profile.ideal_height_range

        if lo <= h <= hi:
            return 1.0  # perfect range
        elif h < lo:
            # Small but surfable
            return max(0.1, h / lo)
        else:
            # Too big — penalty increases past ideal range
            overshoot = (h - hi) / hi
            return max(0.1, 1.0 - overshoot * 0.5)

    def _swell_direction(self, cond: RawConditions) -> float:
        """Is swell arriving from the optimal window?"""
        d = cond.swell_direction or cond.wave_direction
        if d is None:
            return 0.5

        window_start, window_end = self.profile.swell_window
        facing = self.profile.facing

        # Check if direction is within the swell window
        if _in_arc(d, window_start, window_end):
            # Within window — score based on how centered
            center = (window_start + window_end) / 2
            if window_start > window_end:
                center = ((window_start + window_end + 360) / 2) % 360
            dist_from_center = angle_diff(d, center)
            half_width = angle_diff(window_start, center)
            if half_width > 0:
                return max(0.5, 1.0 - (dist_from_center / half_width) * 0.5)
            return 1.0
        else:
            # Outside window — how far off?
            dist_start = angle_diff(d, window_start)
            dist_end = angle_diff(d, window_end)
            min_dist = min(dist_start, dist_end)

            if min_dist < 20:
                return 0.4  # just outside window
            elif min_dist < 40:
                return 0.2
            else:
                return 0.05  # way off — swell completely blocked

    def _period(self, cond: RawConditions) -> float:
        """Is the period long enough for Porto's continental shelf?"""
        p = cond.swell_period or cond.wave_period
        if p is None:
            return 0.3

        min_p = self.profile.min_period
        lo, hi = self.profile.ideal_period_range

        if p < min_p:
            # Below minimum — continental shelf kills this
            return max(0.0, (p / min_p) * 0.3)
        elif p < lo:
            # Between min and ideal — okay but not great
            return 0.3 + 0.4 * ((p - min_p) / (lo - min_p))
        elif p <= hi:
            # Ideal range
            return 1.0
        else:
            # Extra long period — still good, slight diminishing returns
            return max(0.8, 1.0 - (p - hi) * 0.02)

    def _spectral_purity(self, cond: RawConditions) -> float:
        """Single clean swell vs confused crossing seas?"""
        return spectral_purity_score(
            cond.swell_height,
            cond.swell_period,
            cond.swell_direction,
            cond.swell2_height,
            cond.swell2_period,
            cond.swell2_direction,
            cond.wave_height,
        )

    def _wind(self, cond: RawConditions) -> float:
        """Offshore/onshore/cross-shore + speed."""
        return wind_score(
            cond.wind_speed,
            cond.wind_direction,
            self.profile.facing,
            self.profile.offshore_wind_dirs,
        )

    def _wind_trend(self, cond: RawConditions) -> float:
        """Is wind improving or deteriorating?"""
        if cond.wind_speed_history is None or cond.wind_dir_history is None:
            return 0.5  # no trend data

        return wind_trend_score(
            cond.wind_speed_history,
            cond.wind_dir_history,
            self.profile.facing,
            self.profile.offshore_wind_dirs,
        )

    def _tide(self, cond: RawConditions) -> float:
        """Is tide in the optimal range for this beach?"""
        if cond.tide_pct is None:
            return 0.5

        lo, hi = self.profile.ideal_tide_pct

        if lo <= cond.tide_pct <= hi:
            return 1.0
        else:
            if cond.tide_pct < lo:
                dist = lo - cond.tide_pct
            else:
                dist = cond.tide_pct - hi
            return max(0.1, 1.0 - (dist / 50.0))

    def _tide_bathy(self, cond: RawConditions) -> float:
        """How tide + bottom contour shapes the wave."""
        if cond.tide_height is None or cond.tide_pct is None:
            return 0.5

        return tide_bathy_score(
            tide_height=cond.tide_height,
            depth_at_break=self.profile.depth_at_break,
            tide_sensitivity=self.profile.tide_sensitivity,
            ideal_tide_pct=self.profile.ideal_tide_pct,
            tide_pct=cond.tide_pct,
        )

    def _consistency(self, cond: RawConditions) -> float:
        """Set consistency from period + spectral purity."""
        sp = self._spectral_purity(cond)
        return consistency_score(cond.swell_period, sp, cond.swell_height)

    # ----- Summary generation -----

    def _generate_summary(
        self,
        components: dict[str, float],
        cond: RawConditions,
        total: float,
        rating: str,
    ) -> str:
        """Generate a natural language summary of conditions."""
        parts = []

        # Wave description
        h = cond.swell_height or cond.wave_height
        p = cond.swell_period or cond.wave_period
        if h is not None:
            if h < 0.3:
                parts.append("Flat")
            elif h < 0.8:
                parts.append(f"Small ({h:.1f}m)")
            elif h < 1.5:
                parts.append(f"Fun size ({h:.1f}m)")
            elif h < 2.5:
                parts.append(f"Solid ({h:.1f}m)")
            else:
                parts.append(f"Big ({h:.1f}m)")

            if p is not None:
                parts[-1] += f" @ {p:.0f}s"

        # Wind
        if cond.wind_speed is not None:
            ws = cond.wind_speed
            if ws < 5:
                parts.append("glassy")
            elif ws < 15 and components["wind"] > 0.7:
                parts.append("light offshore")
            elif ws < 15:
                parts.append(f"light wind ({ws:.0f} km/h)")
            elif components["wind"] > 0.6:
                parts.append(f"offshore {ws:.0f} km/h")
            elif components["wind"] < 0.3:
                parts.append(f"onshore {ws:.0f} km/h")
            else:
                parts.append(f"cross-shore {ws:.0f} km/h")

        # Nortada warning
        if components["wind_trend"] < 0.3:
            parts.append("Nortada building!")

        # Tide
        if cond.tide_pct is not None:
            if cond.tide_pct < 25:
                parts.append("low tide")
            elif cond.tide_pct > 75:
                parts.append("high tide")
            else:
                parts.append("mid tide")

        # Standout good/bad factors
        best = max(components, key=components.get)
        worst = min(components, key=components.get)

        if components[best] > 0.8 and best not in ("wind_trend", "consistency"):
            nice_name = best.replace("_", " ")
            parts.append(f"great {nice_name}")

        if components[worst] < 0.3:
            nice_name = worst.replace("_", " ")
            parts.append(f"watch: {nice_name}")

        return ". ".join(parts) + "." if parts else rating.capitalize() + " conditions."


def score_to_rating(total: float) -> str:
    """Map 0-10 score to a human-readable rating."""
    if total < 2:
        return "flat"
    elif total < 4:
        return "poor"
    elif total < 5.5:
        return "fair"
    elif total < 7:
        return "good"
    elif total < 8.5:
        return "great"
    else:
        return "epic"


# ---------------------------------------------------------------------------
# Database integration: score from stored forecast data
# ---------------------------------------------------------------------------

async def score_spot_from_db(
    session: AsyncSession, spot_id: str, forecast_time: datetime
) -> ScoreResult | None:
    """Load data from DB and score a single time slot."""
    scorer = SpotScorer(spot_id)

    # Fetch forecast data for this spot and time
    stmt = (
        select(ForecastData)
        .where(ForecastData.spot_id == spot_id)
        .where(ForecastData.forecast_time == forecast_time)
        .order_by(ForecastData.collected_at.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    row = result.scalar_one_or_none()

    if row is None:
        return None

    # Get tide
    tide_h = predict_tide(forecast_time)
    tide_pct = tide_percentage(forecast_time)

    # Get wind history (last 6 hours)
    history_start = forecast_time - timedelta(hours=6)
    hist_stmt = (
        select(ForecastData)
        .where(ForecastData.spot_id == spot_id)
        .where(ForecastData.forecast_time >= history_start)
        .where(ForecastData.forecast_time <= forecast_time)
        .order_by(ForecastData.forecast_time)
    )
    hist_result = await session.execute(hist_stmt)
    hist_rows = hist_result.scalars().all()

    wind_speed_hist = [r.wind_speed for r in hist_rows]
    wind_dir_hist = [r.wind_direction for r in hist_rows]

    cond = RawConditions(
        wave_height=row.wave_height,
        wave_direction=row.wave_direction,
        wave_period=row.wave_period,
        swell_height=row.swell_height,
        swell_direction=row.swell_direction,
        swell_period=row.swell_period,
        swell2_height=row.swell2_height,
        swell2_direction=row.swell2_direction,
        swell2_period=row.swell2_period,
        wind_speed=row.wind_speed,
        wind_direction=row.wind_direction,
        wind_gusts=row.wind_gusts,
        tide_height=tide_h,
        tide_pct=tide_pct,
        wind_speed_history=wind_speed_hist,
        wind_dir_history=wind_dir_hist,
    )

    return scorer.full_score(cond, forecast_time)


async def score_all_spots(session: AsyncSession) -> list[ScoredForecast]:
    """Score all spots for all available forecast times. Store results in DB.

    Returns list of ScoredForecast ORM objects.
    """
    # Get distinct forecast times per spot
    stmt = (
        select(ForecastData.spot_id, ForecastData.forecast_time)
        .distinct()
        .order_by(ForecastData.forecast_time)
    )
    result = await session.execute(stmt)
    pairs = result.all()

    scored = []
    for spot_id, forecast_time in pairs:
        if spot_id not in SPOTS:
            continue

        sr = await score_spot_from_db(session, spot_id, forecast_time)
        if sr is None:
            continue

        row = ScoredForecast(
            spot_id=sr.spot_id,
            forecast_time=sr.forecast_time,
            total_score=sr.total_score,
            swell_quality=sr.components["swell_quality"],
            swell_direction=sr.components["swell_direction"],
            period=sr.components["period"],
            spectral_purity=sr.components["spectral_purity"],
            wind=sr.components["wind"],
            wind_trend=sr.components["wind_trend"],
            tide=sr.components["tide"],
            tide_bathy_interaction=sr.components["tide_bathy_interaction"],
            consistency=sr.components["consistency"],
            summary=sr.summary,
        )
        session.add(row)
        scored.append(row)

    await session.commit()
    return scored


def find_best_windows(
    scores: list[ScoreResult],
    min_score: float = 5.0,
    min_consecutive_hours: int = 2,
) -> list[dict]:
    """Find the best surf windows from a list of scored time slots.

    Groups consecutive hours above min_score into windows.
    Returns sorted by peak_score descending.
    """
    # Group by spot
    by_spot: dict[str, list[ScoreResult]] = {}
    for s in scores:
        by_spot.setdefault(s.spot_id, []).append(s)

    windows = []
    for spot_id, spot_scores in by_spot.items():
        spot_scores.sort(key=lambda s: s.forecast_time)

        current_window: list[ScoreResult] = []
        for s in spot_scores:
            if s.total_score >= min_score:
                current_window.append(s)
            else:
                if len(current_window) >= min_consecutive_hours:
                    windows.append(_make_window(spot_id, current_window))
                current_window = []

        # Don't forget trailing window
        if len(current_window) >= min_consecutive_hours:
            windows.append(_make_window(spot_id, current_window))

    windows.sort(key=lambda w: w["peak_score"], reverse=True)
    return windows


def _make_window(spot_id: str, slots: list[ScoreResult]) -> dict:
    scores = [s.total_score for s in slots]
    best = max(slots, key=lambda s: s.total_score)
    return {
        "spot_id": spot_id,
        "start": slots[0].forecast_time,
        "end": slots[-1].forecast_time + timedelta(hours=1),
        "peak_score": max(scores),
        "avg_score": round(sum(scores) / len(scores), 1),
        "rating": best.rating,
        "summary": best.summary,
    }


def _in_arc(bearing: float, start: float, end: float) -> bool:
    bearing = bearing % 360
    start = start % 360
    end = end % 360
    if start <= end:
        return start <= bearing <= end
    return bearing >= start or bearing <= end
