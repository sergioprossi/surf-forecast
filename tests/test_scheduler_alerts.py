"""Tests for the scheduled alert evaluation job."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest

from src.models.database import async_session, engine
from src.models.orm import AlertConfig, AlertLog, Base, ScoredForecast
from src.scheduler.jobs import evaluate_alerts


@pytest.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


def _future_slot() -> datetime:
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    return now + timedelta(hours=3)


async def _seed(*configs: AlertConfig) -> None:
    async with async_session() as session:
        session.add(
            ScoredForecast(spot_id="matosinhos", forecast_time=_future_slot(), total_score=8.0, summary="Firing")
        )
        session.add_all(configs)
        await session.commit()


def _config(user_id: int | None, **kw) -> AlertConfig:
    defaults = dict(
        channel="telegram",
        chat_id="123456789",
        spot_ids="matosinhos",
        min_score=6.0,
        enabled=True,
        quiet_start_hour=0,
        quiet_end_hour=0,  # equal hours = no quiet window
    )
    defaults.update(kw)
    return AlertConfig(user_id=user_id, **defaults)


async def _logged_config_ids() -> list[int]:
    from sqlalchemy import select

    async with async_session() as session:
        rows = await session.execute(select(AlertLog.alert_config_id))
        return sorted(rows.scalars().all())


async def test_evaluate_alerts_owned_config_sends_and_logs():
    await _seed(_config(user_id=1))
    with patch("src.scheduler.jobs._send_alert", new=AsyncMock()) as send:
        await evaluate_alerts()
    assert send.await_count == 1
    assert len(await _logged_config_ids()) == 1


async def test_evaluate_alerts_legacy_ownerless_config_is_skipped():
    await _seed(_config(user_id=None), _config(user_id=7, chat_id="555"))
    with patch("src.scheduler.jobs._send_alert", new=AsyncMock()) as send:
        await evaluate_alerts()
    assert send.await_count == 1
    sent_config = send.await_args.args[0]
    assert sent_config.user_id == 7


async def test_evaluate_alerts_disabled_config_is_skipped():
    await _seed(_config(user_id=1, enabled=False))
    with patch("src.scheduler.jobs._send_alert", new=AsyncMock()) as send:
        await evaluate_alerts()
    send.assert_not_awaited()


async def test_evaluate_alerts_second_run_does_not_resend():
    await _seed(_config(user_id=1))
    with patch("src.scheduler.jobs._send_alert", new=AsyncMock()) as send:
        await evaluate_alerts()
        await evaluate_alerts()
    assert send.await_count == 1
