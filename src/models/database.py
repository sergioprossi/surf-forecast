"""Async SQLAlchemy engine and session factory."""

from __future__ import annotations

import logging

from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import settings

logger = logging.getLogger(__name__)

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


def _add_missing_columns(sync_conn) -> None:
    """Add columns introduced after a table was first created.

    `create_all` only creates missing *tables*, so existing deployments (the
    dev SQLite file, Railway Postgres) need new columns added explicitly.

    TODO: replace with Alembic migrations once there is more than one of these —
    this is a deliberate shortcut for a single additive, nullable column.
    """
    insp = inspect(sync_conn)
    if "alert_configs" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("alert_configs")}
    if "user_id" not in existing:
        from src.models.orm import AlertConfig

        logger.info("Migrating alert_configs: adding user_id column")
        # Static DDL (no user input) — portable across SQLite and Postgres.
        sync_conn.execute(text("ALTER TABLE alert_configs ADD COLUMN user_id INTEGER"))
        # Reuse the index the model already declares (index=True on user_id)
        for idx in AlertConfig.__table__.indexes:
            if [c.name for c in idx.columns] == ["user_id"]:
                idx.create(sync_conn)


async def init_db() -> None:
    """Create all tables if they don't exist, then apply additive migrations."""
    from src.models.orm import Base

    async with engine.begin() as conn:
        await conn.run_sync(_add_missing_columns)
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncSession:
    """Dependency for FastAPI route injection."""
    async with async_session() as session:
        yield session
