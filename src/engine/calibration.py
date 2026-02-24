"""Model calibration from session feedback.

Tracks prediction accuracy and adjusts spot weights based on
how well predicted scores match actual user ratings.
"""

from __future__ import annotations

import logging
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import SPOTS
from src.models.orm import SessionFeedback

logger = logging.getLogger(__name__)


async def get_accuracy_stats(
    session: AsyncSession, spot_id: str | None = None
) -> dict:
    """Compute accuracy statistics from session feedback.

    Returns metrics like MAE, correlation, and bias.
    """
    stmt = select(SessionFeedback).where(
        SessionFeedback.predicted_score.is_not(None)
    )
    if spot_id:
        stmt = stmt.where(SessionFeedback.spot_id == spot_id)

    result = await session.execute(stmt)
    rows = result.scalars().all()

    if len(rows) < 3:
        return {
            "samples": len(rows),
            "sufficient_data": False,
            "message": "Need at least 3 feedback entries for statistics",
        }

    # Convert 1-5 star rating to 0-10 scale for comparison
    predicted = [r.predicted_score for r in rows]
    actual = [(r.actual_rating - 1) * 2.5 for r in rows]  # 1→0, 5→10

    # Mean Absolute Error
    mae = sum(abs(p - a) for p, a in zip(predicted, actual)) / len(rows)

    # Bias (positive = over-predicting, negative = under-predicting)
    bias = sum(p - a for p, a in zip(predicted, actual)) / len(rows)

    # Simple correlation
    mean_p = sum(predicted) / len(predicted)
    mean_a = sum(actual) / len(actual)

    cov = sum((p - mean_p) * (a - mean_a) for p, a in zip(predicted, actual))
    std_p = (sum((p - mean_p) ** 2 for p in predicted)) ** 0.5
    std_a = (sum((a - mean_a) ** 2 for a in actual)) ** 0.5

    correlation = cov / (std_p * std_a) if std_p > 0 and std_a > 0 else 0.0

    return {
        "samples": len(rows),
        "sufficient_data": True,
        "mae": round(mae, 2),
        "bias": round(bias, 2),
        "correlation": round(correlation, 3),
        "interpretation": _interpret_stats(mae, bias, correlation),
    }


def _interpret_stats(mae: float, bias: float, correlation: float) -> str:
    """Human-readable interpretation of accuracy stats."""
    parts = []

    if mae < 1.5:
        parts.append("Predictions are accurate")
    elif mae < 2.5:
        parts.append("Predictions are reasonable")
    else:
        parts.append("Predictions need calibration")

    if bias > 1.0:
        parts.append("model tends to over-predict (too optimistic)")
    elif bias < -1.0:
        parts.append("model tends to under-predict (too pessimistic)")

    if correlation > 0.7:
        parts.append("good at ranking conditions")
    elif correlation < 0.3:
        parts.append("poor at ranking conditions — weights may need adjustment")

    return ". ".join(parts) + "."


async def suggest_weight_adjustments(
    session: AsyncSession, spot_id: str
) -> dict[str, float] | None:
    """Suggest weight adjustments for a spot based on feedback patterns.

    Analyzes which component scores correlate best/worst with actual
    ratings, and suggests increasing/decreasing those weights.

    Returns None if insufficient data.
    """
    from src.models.orm import ScoredForecast

    # Get feedback with matching scored forecasts
    stmt = select(SessionFeedback).where(
        SessionFeedback.spot_id == spot_id,
        SessionFeedback.predicted_score.is_not(None),
    )
    result = await session.execute(stmt)
    feedback_rows = result.scalars().all()

    if len(feedback_rows) < 10:
        return None  # need more data

    # For each feedback entry, find the matching scored forecast
    from datetime import timedelta

    adjustments = {}
    components = [
        "swell_quality", "swell_direction", "period", "spectral_purity",
        "wind", "wind_trend", "tide", "tide_bathy_interaction", "consistency",
    ]

    component_correlations = {c: [] for c in components}

    for fb in feedback_rows:
        # Find closest scored forecast
        fc_stmt = (
            select(ScoredForecast)
            .where(ScoredForecast.spot_id == spot_id)
            .where(
                ScoredForecast.forecast_time.between(
                    fb.session_time - timedelta(hours=1),
                    fb.session_time + timedelta(hours=1),
                )
            )
            .limit(1)
        )
        fc_result = await session.execute(fc_stmt)
        fc = fc_result.scalar_one_or_none()

        if fc is None:
            continue

        actual_norm = (fb.actual_rating - 1) / 4.0  # normalize to 0-1

        for comp in components:
            comp_val = getattr(fc, comp)
            component_correlations[comp].append((comp_val, actual_norm))

    # Compute correlation for each component with actual ratings
    for comp in components:
        pairs = component_correlations[comp]
        if len(pairs) < 5:
            continue

        vals = [p[0] for p in pairs]
        actuals = [p[1] for p in pairs]

        mean_v = sum(vals) / len(vals)
        mean_a = sum(actuals) / len(actuals)

        cov = sum((v - mean_v) * (a - mean_a) for v, a in zip(vals, actuals))
        std_v = (sum((v - mean_v) ** 2 for v in vals)) ** 0.5
        std_a = (sum((a - mean_a) ** 2 for a in actuals)) ** 0.5

        if std_v > 0 and std_a > 0:
            corr = cov / (std_v * std_a)
        else:
            corr = 0.0

        # Suggest weight adjustment based on correlation
        # High correlation → increase weight
        # Negative correlation → decrease weight
        current_weight = SPOTS[spot_id]["weights"].get(comp, 1.0)
        if corr > 0.5:
            adjustments[comp] = round(current_weight * 1.1, 2)  # +10%
        elif corr < -0.2:
            adjustments[comp] = round(current_weight * 0.85, 2)  # -15%

    return adjustments if adjustments else None
