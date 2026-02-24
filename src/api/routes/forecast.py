"""Forecast endpoints — scored forecasts, comparisons, best windows, current conditions."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import SPOTS
from src.engine.scoring import (
    ScoreResult,
    find_best_windows,
    score_spot_from_db,
    score_to_rating,
)
from src.models.database import get_session
from src.models.orm import ForecastData, ScoredForecast
from src.models.schemas import (
    BestWindow,
    BestWindowsResponse,
    CompareResponse,
    ComponentScores,
    CurrentConditions,
    ForecastSlot,
    RawConditions,
    SpotForecastResponse,
    SpotInfo,
    SpotSnapshot,
)

router = APIRouter(prefix="/api/v1", tags=["forecast"])


def _spot_info(spot_id: str) -> SpotInfo:
    s = SPOTS[spot_id]
    return SpotInfo(
        id=spot_id,
        name=s["name"],
        lat=s["lat"],
        lon=s["lon"],
        facing=s["facing"],
        description=s["description"],
    )


def _score_to_slot(sr: ScoreResult) -> ForecastSlot:
    return ForecastSlot(
        time=sr.forecast_time,
        total_score=sr.total_score,
        rating=sr.rating,
        components=ComponentScores(**sr.components),
        conditions=RawConditions(
            wave_height=sr.conditions.wave_height,
            wave_period=sr.conditions.wave_period,
            wave_direction=sr.conditions.wave_direction,
            swell_height=sr.conditions.swell_height,
            swell_period=sr.conditions.swell_period,
            swell_direction=sr.conditions.swell_direction,
            wind_speed=sr.conditions.wind_speed,
            wind_direction=sr.conditions.wind_direction,
            tide_height=sr.conditions.tide_height,
        ),
        summary=sr.summary,
    )


@router.get("/forecast/{spot_id}", response_model=SpotForecastResponse)
async def get_forecast(
    spot_id: str,
    session: AsyncSession = Depends(get_session),
) -> SpotForecastResponse:
    """Get scored forecast with component breakdown for a spot."""
    if spot_id not in SPOTS:
        raise HTTPException(404, f"Unknown spot: {spot_id}")

    # Get all distinct forecast times for this spot
    stmt = (
        select(ForecastData.forecast_time)
        .where(ForecastData.spot_id == spot_id)
        .distinct()
        .order_by(ForecastData.forecast_time)
    )
    result = await session.execute(stmt)
    times = [row[0] for row in result.all()]

    slots = []
    for t in times:
        sr = await score_spot_from_db(session, spot_id, t)
        if sr:
            slots.append(_score_to_slot(sr))

    return SpotForecastResponse(spot=_spot_info(spot_id), forecast=slots)


@router.get("/forecast/compare", response_model=CompareResponse)
async def compare_spots(
    spots: str = Query(..., description="Comma-separated spot IDs"),
    time: datetime | None = Query(None, description="ISO timestamp (defaults to nearest hour)"),
    session: AsyncSession = Depends(get_session),
) -> CompareResponse:
    """Compare multiple spots at the same time."""
    spot_ids = [s.strip() for s in spots.split(",")]
    for sid in spot_ids:
        if sid not in SPOTS:
            raise HTTPException(404, f"Unknown spot: {sid}")

    # Default to nearest hour
    if time is None:
        now = datetime.now(timezone.utc)
        time = now.replace(minute=0, second=0, microsecond=0)

    snapshots = []
    for sid in spot_ids:
        sr = await score_spot_from_db(session, sid, time)
        if sr:
            snapshots.append(
                SpotSnapshot(
                    spot=_spot_info(sid),
                    time=sr.forecast_time,
                    total_score=sr.total_score,
                    rating=sr.rating,
                    summary=sr.summary,
                )
            )

    return CompareResponse(time=time, spots=snapshots)


@router.get("/best-windows", response_model=BestWindowsResponse)
async def best_windows(
    min_score: float = Query(5.0, ge=0, le=10),
    session: AsyncSession = Depends(get_session),
) -> BestWindowsResponse:
    """Find the best surf windows across all spots for the forecast period."""
    all_scores: list[ScoreResult] = []

    for spot_id in SPOTS:
        stmt = (
            select(ForecastData.forecast_time)
            .where(ForecastData.spot_id == spot_id)
            .distinct()
            .order_by(ForecastData.forecast_time)
        )
        result = await session.execute(stmt)
        times = [row[0] for row in result.all()]

        for t in times:
            sr = await score_spot_from_db(session, spot_id, t)
            if sr:
                all_scores.append(sr)

    windows = find_best_windows(all_scores, min_score=min_score)

    return BestWindowsResponse(
        windows=[
            BestWindow(
                spot=_spot_info(w["spot_id"]),
                start=w["start"],
                end=w["end"],
                peak_score=w["peak_score"],
                avg_score=w["avg_score"],
                rating=w["rating"],
                summary=w["summary"],
            )
            for w in windows
        ]
    )


@router.get("/conditions/now", response_model=CurrentConditions)
async def current_conditions(
    session: AsyncSession = Depends(get_session),
) -> CurrentConditions:
    """Quick snapshot of all spots right now."""
    now = datetime.now(timezone.utc)
    target = now.replace(minute=0, second=0, microsecond=0)

    snapshots = []
    for spot_id in SPOTS:
        sr = await score_spot_from_db(session, spot_id, target)
        if sr:
            snapshots.append(
                SpotSnapshot(
                    spot=_spot_info(spot_id),
                    time=sr.forecast_time,
                    total_score=sr.total_score,
                    rating=sr.rating,
                    summary=sr.summary,
                )
            )

    return CurrentConditions(spots=snapshots, updated_at=now)
