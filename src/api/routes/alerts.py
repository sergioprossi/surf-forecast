"""Alert configuration endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth import require_user
from src.models.database import get_session
from src.models.orm import AlertConfig, User
from src.models.schemas import AlertConfigCreate, AlertConfigResponse

router = APIRouter(prefix="/api/v1", tags=["alerts"])


@router.post("/alerts", response_model=AlertConfigResponse)
async def create_alert(
    body: AlertConfigCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_user),
) -> AlertConfigResponse:
    """Configure a new surf alert."""
    row = AlertConfig(
        channel=body.channel,
        chat_id=body.chat_id,
        email=body.email,
        spot_ids=",".join(body.spot_ids),
        min_score=body.min_score,
        quiet_start_hour=body.quiet_start_hour,
        quiet_end_hour=body.quiet_end_hour,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)

    return AlertConfigResponse(
        id=row.id,
        channel=row.channel,
        spot_ids=row.spot_ids.split(","),
        min_score=row.min_score,
        enabled=bool(row.enabled),
    )


@router.get("/alerts", response_model=list[AlertConfigResponse])
async def list_alerts(
    session: AsyncSession = Depends(get_session),
) -> list[AlertConfigResponse]:
    """List all alert configurations."""
    result = await session.execute(select(AlertConfig))
    rows = result.scalars().all()

    return [
        AlertConfigResponse(
            id=r.id,
            channel=r.channel,
            spot_ids=r.spot_ids.split(","),
            min_score=r.min_score,
            enabled=bool(r.enabled),
        )
        for r in rows
    ]


@router.delete("/alerts/{alert_id}")
async def delete_alert(
    alert_id: int,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_user),
) -> dict:
    """Delete an alert configuration."""
    result = await session.execute(
        select(AlertConfig).where(AlertConfig.id == alert_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(404, "Alert not found")

    await session.delete(row)
    await session.commit()
    return {"deleted": alert_id}
