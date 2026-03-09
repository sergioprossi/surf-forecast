"""Tests for deployment-related features: health check, config, etc."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from src.api.main import app
from src.config import Settings
from src.models.database import engine
from src.models.orm import Base


@pytest.fixture(autouse=True)
async def setup_db():
    """Create fresh tables for each test."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

async def test_health_check_returns_ok(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# DATABASE_URL conversion
# ---------------------------------------------------------------------------

def test_postgres_url_converted_to_asyncpg():
    """Railway-style postgresql:// URLs get converted to postgresql+asyncpg://."""
    s = Settings(database_url="postgresql://user:pass@host:5432/db")
    assert s.database_url == "postgresql+asyncpg://user:pass@host:5432/db"


def test_postgres_short_url_converted_to_asyncpg():
    """Heroku-style postgres:// URLs also get converted."""
    s = Settings(database_url="postgres://user:pass@host:5432/db")
    assert s.database_url == "postgresql+asyncpg://user:pass@host:5432/db"


def test_sqlite_url_unchanged():
    """SQLite URLs should not be modified."""
    s = Settings(database_url="sqlite+aiosqlite:///test.db")
    assert s.database_url == "sqlite+aiosqlite:///test.db"


def test_already_asyncpg_url_unchanged():
    """URLs already using asyncpg should not be double-converted."""
    s = Settings(database_url="postgresql+asyncpg://user:pass@host:5432/db")
    assert s.database_url == "postgresql+asyncpg://user:pass@host:5432/db"
