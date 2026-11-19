"""Tests for the additive alert_configs.user_id migration in init_db."""

from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine

from src.models import database


async def test_init_db_adds_user_id_to_legacy_alert_configs(tmp_path, monkeypatch):
    eng = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'legacy.db'}")
    # Legacy schema: alert_configs without user_id, with an existing row
    async with eng.begin() as conn:
        await conn.execute(text(
            "CREATE TABLE alert_configs (id INTEGER PRIMARY KEY, channel VARCHAR(16), "
            "chat_id VARCHAR(64), email VARCHAR(128), spot_ids VARCHAR(256), min_score FLOAT, "
            "enabled INTEGER, quiet_start_hour INTEGER, quiet_end_hour INTEGER, created_at DATETIME)"
        ))
        await conn.execute(text(
            "INSERT INTO alert_configs (channel, chat_id, spot_ids, min_score, enabled, "
            "quiet_start_hour, quiet_end_hour) VALUES ('telegram', '1', 'leca', 6, 1, 22, 6)"
        ))

    monkeypatch.setattr(database, "engine", eng)
    await database.init_db()
    await database.init_db()  # idempotent

    async with eng.connect() as conn:
        cols = await conn.run_sync(lambda c: {x["name"] for x in inspect(c).get_columns("alert_configs")})
        idx = await conn.run_sync(lambda c: [i["column_names"] for i in inspect(c).get_indexes("alert_configs")])
        rows = (await conn.execute(text("SELECT user_id, spot_ids FROM alert_configs"))).all()

    assert "user_id" in cols
    assert ["user_id"] in idx
    assert rows == [(None, "leca")]  # existing row preserved, unowned
    await eng.dispose()
