"""Session feedback endpoints — for model calibration."""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.database import get_session
from src.models.orm import ScoredForecast, SessionFeedback
from src.models.schemas import SessionFeedbackCreate, SessionFeedbackResponse

router = APIRouter(prefix="/api/v1", tags=["feedback"])


@router.post("/feedback/session", response_model=SessionFeedbackResponse)
async def submit_feedback(
    body: SessionFeedbackCreate,
    session: AsyncSession = Depends(get_session),
) -> SessionFeedbackResponse:
    """Log actual surf session for model calibration."""
    # Try to find the predicted score for this spot/time
    predicted = None
    stmt = (
        select(ScoredForecast)
        .where(ScoredForecast.spot_id == body.spot_id)
        .where(ScoredForecast.forecast_time >= body.session_time - timedelta(hours=1))
        .where(ScoredForecast.forecast_time <= body.session_time + timedelta(hours=1))
        .order_by(ScoredForecast.scored_at.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    scored = result.scalar_one_or_none()
    if scored:
        predicted = scored.total_score

    row = SessionFeedback(
        spot_id=body.spot_id,
        session_time=body.session_time,
        predicted_score=predicted,
        actual_rating=body.actual_rating,
        notes=body.notes,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)

    return SessionFeedbackResponse(
        id=row.id,
        spot_id=row.spot_id,
        session_time=row.session_time,
        predicted_score=row.predicted_score,
        actual_rating=row.actual_rating,
        notes=row.notes,
    )


@router.get("/feedback", response_model=list[SessionFeedbackResponse])
async def list_feedback(
    session: AsyncSession = Depends(get_session),
) -> list[SessionFeedbackResponse]:
    """List all session feedback entries."""
    result = await session.execute(
        select(SessionFeedback).order_by(SessionFeedback.session_time.desc())
    )
    rows = result.scalars().all()

    return [
        SessionFeedbackResponse(
            id=r.id,
            spot_id=r.spot_id,
            session_time=r.session_time,
            predicted_score=r.predicted_score,
            actual_rating=r.actual_rating,
            notes=r.notes,
        )
        for r in rows
    ]


@router.get("/feedback/accuracy")
async def accuracy_stats(
    spot_id: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get prediction accuracy statistics from session feedback."""
    from src.engine.calibration import get_accuracy_stats

    return await get_accuracy_stats(session, spot_id)


@router.get("/feedback/calibration/{spot_id}")
async def calibration_suggestions(
    spot_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get suggested weight adjustments for a spot based on feedback."""
    from src.engine.calibration import suggest_weight_adjustments

    adjustments = await suggest_weight_adjustments(session, spot_id)
    if adjustments is None:
        return {"message": "Insufficient feedback data (need 10+ entries)", "adjustments": None}
    return {"spot_id": spot_id, "adjustments": adjustments}
