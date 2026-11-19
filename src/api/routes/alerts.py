"""Alert configuration endpoints — all scoped to the authenticated user."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth import require_user
from src.models.database import get_session
from src.models.orm import AlertConfig, User
from src.models.schemas import (
    AlertConfigCreate,
    AlertConfigResponse,
    AlertConfigUpdate,
    AlertListResponse,
)

router = APIRouter(prefix="/api/v1", tags=["alerts"])

# Cap per user so one account can't flood the alert scheduler
MAX_ALERTS_PER_USER = 20


def _to_response(row: AlertConfig) -> AlertConfigResponse:
    return AlertConfigResponse(
        id=row.id,
        channel=row.channel,
        chat_id=row.chat_id,
        email=row.email,
        spot_ids=row.spot_ids.split(","),
        min_score=row.min_score,
        enabled=bool(row.enabled),
        quiet_start_hour=row.quiet_start_hour,
        quiet_end_hour=row.quiet_end_hour,
    )


async def _get_owned(session: AsyncSession, alert_id: int, user: User) -> AlertConfig:
    """Fetch an alert owned by `user`. Other users' alerts are reported as 404
    (not 403) so IDs can't be probed."""
    result = await session.execute(
        select(AlertConfig)
        .where(AlertConfig.id == alert_id)
        .where(AlertConfig.user_id == user.id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(404, "Alert not found")
    return row


@router.post("/alerts", response_model=AlertConfigResponse, status_code=201)
async def create_alert(
    body: AlertConfigCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_user),
) -> AlertConfigResponse:
    """Configure a new surf alert."""
    existing = await session.execute(
        select(AlertConfig.id).where(AlertConfig.user_id == user.id).limit(MAX_ALERTS_PER_USER)
    )
    if len(existing.all()) >= MAX_ALERTS_PER_USER:
        raise HTTPException(409, f"Alert limit reached ({MAX_ALERTS_PER_USER})")

    row = AlertConfig(
        user_id=user.id,
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
    return _to_response(row)


@router.get("/alerts", response_model=AlertListResponse)
async def list_alerts(
    cursor: int | None = Query(None, ge=0, description="Return alerts with id > cursor"),
    limit: int = Query(50, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_user),
) -> AlertListResponse:
    """List the current user's alert configurations (cursor-paginated by id)."""
    stmt = (
        select(AlertConfig)
        .where(AlertConfig.user_id == user.id)
        .order_by(AlertConfig.id)
        .limit(limit + 1)  # fetch one extra to know if there's another page
    )
    if cursor is not None:
        stmt = stmt.where(AlertConfig.id > cursor)

    rows = (await session.execute(stmt)).scalars().all()
    has_more = len(rows) > limit
    rows = rows[:limit]
    return AlertListResponse(
        items=[_to_response(r) for r in rows],
        next_cursor=rows[-1].id if has_more else None,
    )


@router.patch("/alerts/{alert_id}", response_model=AlertConfigResponse)
async def update_alert(
    alert_id: int,
    body: AlertConfigUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_user),
) -> AlertConfigResponse:
    """Partially update an alert (e.g. toggle enabled, change spots/threshold)."""
    row = await _get_owned(session, alert_id, user)
    changes = body.model_dump(exclude_unset=True)

    for field in ("min_score", "quiet_start_hour", "quiet_end_hour"):
        if changes.get(field) is not None:
            setattr(row, field, changes[field])
    if changes.get("enabled") is not None:
        row.enabled = changes["enabled"]
    if changes.get("spot_ids") is not None:
        row.spot_ids = ",".join(changes["spot_ids"])

    await session.commit()
    await session.refresh(row)
    return _to_response(row)


@router.delete("/alerts/{alert_id}")
async def delete_alert(
    alert_id: int,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_user),
) -> dict:
    """Delete an alert configuration."""
    row = await _get_owned(session, alert_id, user)
    await session.delete(row)
    await session.commit()
    return {"deleted": alert_id}
