"""Tide predictions for Leixões port (Porto coast).

Uses astronomical tide harmonics to generate predictions. Leixões is the
reference port for all Porto-area spots.

Harmonic constants sourced from IH / IPMA published data for Leixões.
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from src.models.orm import TideData

logger = logging.getLogger(__name__)

# Leixões port — principal harmonic constituents
# Format: (name, amplitude_m, phase_deg, speed_deg_per_hour)
# Values are approximate from published IH data for Leixões.
LEIXOES_HARMONICS = [
    ("M2", 1.08, 75.0, 28.9841),   # principal lunar semidiurnal
    ("S2", 0.38, 103.0, 30.0000),   # principal solar semidiurnal
    ("N2", 0.22, 55.0, 28.4397),    # larger lunar elliptic
    ("K1", 0.07, 60.0, 15.0411),    # luni-solar diurnal
    ("O1", 0.06, 320.0, 13.9430),   # principal lunar diurnal
    ("K2", 0.10, 100.0, 30.0821),   # luni-solar semidiurnal
    ("M4", 0.03, 200.0, 57.9682),   # shallow water
]

# Mean sea level above chart datum at Leixões (metres)
MSL = 2.08


def predict_tide(dt: datetime) -> float:
    """Predict tide height (metres above chart datum) at a given time.

    Uses simple harmonic summation — accurate to ~10-15cm for planning.
    """
    # Hours since epoch (J2000.0 = 2000-01-01 12:00 UTC)
    epoch = datetime(2000, 1, 12, 0, 0, tzinfo=timezone.utc)
    # Ensure dt is timezone-aware (assume UTC if naive)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    hours = (dt - epoch).total_seconds() / 3600.0

    height = MSL
    for _name, amplitude, phase_deg, speed in LEIXOES_HARMONICS:
        angle_deg = speed * hours + phase_deg
        height += amplitude * math.cos(math.radians(angle_deg))

    return round(height, 2)


def predict_tide_series(
    start: datetime, end: datetime, interval_minutes: int = 60
) -> list[tuple[datetime, float]]:
    """Generate tide predictions at regular intervals."""
    results = []
    current = start
    delta = timedelta(minutes=interval_minutes)
    while current <= end:
        results.append((current, predict_tide(current)))
        current += delta
    return results


def find_high_low(
    start: datetime, end: datetime, resolution_minutes: int = 6
) -> list[tuple[datetime, float, str]]:
    """Find high and low tide times between start and end.

    Returns list of (time, height, "high"|"low").
    """
    series = predict_tide_series(start, end, resolution_minutes)
    extremes: list[tuple[datetime, float, str]] = []

    for i in range(1, len(series) - 1):
        prev_h = series[i - 1][1]
        curr_h = series[i][1]
        next_h = series[i + 1][1]

        if curr_h > prev_h and curr_h > next_h:
            extremes.append((series[i][0], curr_h, "high"))
        elif curr_h < prev_h and curr_h < next_h:
            extremes.append((series[i][0], curr_h, "low"))

    return extremes


def tide_percentage(dt: datetime) -> float:
    """Compute where in the tidal range we are at time dt (0% = low, 100% = high).

    Finds the surrounding high/low tides and linearly interpolates.
    """
    # Ensure dt is timezone-aware (assume UTC if naive)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    # Search ±12 hours to find surrounding extremes
    search_start = dt - timedelta(hours=12)
    search_end = dt + timedelta(hours=12)
    extremes = find_high_low(search_start, search_end)

    if len(extremes) < 2:
        # Fallback: estimate from absolute position in tidal range
        height = predict_tide(dt)
        # Typical Leixões range: ~0.5m (neap low) to ~3.6m (spring high)
        return max(0, min(100, (height - 0.5) / 3.1 * 100))

    # Find the extreme just before and just after dt
    before = None
    after = None
    for ext_time, ext_h, ext_type in extremes:
        if ext_time <= dt:
            before = (ext_time, ext_h, ext_type)
        elif after is None:
            after = (ext_time, ext_h, ext_type)

    if before is None or after is None:
        height = predict_tide(dt)
        return max(0, min(100, (height - 0.5) / 3.1 * 100))

    # Interpolate: if going low->high, pct rises; if high->low, pct drops
    elapsed = (dt - before[0]).total_seconds()
    total = (after[0] - before[0]).total_seconds()
    fraction = elapsed / total if total > 0 else 0.5

    if before[2] == "low":
        return fraction * 100  # rising
    else:
        return (1 - fraction) * 100  # falling


async def collect_tides(session: AsyncSession, days: int = 3) -> int:
    """Generate and store tide predictions for the next N days."""
    now = datetime.now(timezone.utc)
    start = now.replace(minute=0, second=0, microsecond=0)
    end = start + timedelta(days=days)

    series = predict_tide_series(start, end, interval_minutes=60)
    extremes = find_high_low(start, end)
    extreme_times = {e[0] for e in extremes}

    rows_added = 0
    for t, h in series:
        tide_type = None
        for et, eh, etype in extremes:
            if abs((t - et).total_seconds()) < 600:  # within 10 min
                tide_type = etype
                break

        row = TideData(time=t, height=h, type=tide_type)
        session.add(row)
        rows_added += 1

    await session.commit()
    logger.info("Tides: %d hourly predictions stored (%d extremes)", rows_added, len(extremes))
    return rows_added
