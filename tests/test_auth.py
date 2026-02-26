"""Tests for JWT authentication endpoints."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from src.api.main import app
from src.models.database import engine, init_db
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
# Registration
# ---------------------------------------------------------------------------

async def test_register_success(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "surfer@test.com",
        "password": "longpassword123",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


async def test_register_duplicate_email(client: AsyncClient):
    payload = {"email": "surfer@test.com", "password": "longpassword123"}
    await client.post("/api/v1/auth/register", json=payload)
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 409


async def test_register_short_password(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "surfer@test.com",
        "password": "short",
    })
    assert resp.status_code == 422


async def test_register_invalid_email(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "not-an-email",
        "password": "longpassword123",
    })
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

async def test_login_success(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "surfer@test.com",
        "password": "longpassword123",
    })
    resp = await client.post("/api/v1/auth/login", json={
        "email": "surfer@test.com",
        "password": "longpassword123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


async def test_login_wrong_password(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "surfer@test.com",
        "password": "longpassword123",
    })
    resp = await client.post("/api/v1/auth/login", json={
        "email": "surfer@test.com",
        "password": "wrongpassword",
    })
    assert resp.status_code == 401


async def test_login_nonexistent_user(client: AsyncClient):
    resp = await client.post("/api/v1/auth/login", json={
        "email": "nobody@test.com",
        "password": "longpassword123",
    })
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------

async def test_refresh_success(client: AsyncClient):
    reg = await client.post("/api/v1/auth/register", json={
        "email": "surfer@test.com",
        "password": "longpassword123",
    })
    refresh_token = reg.json()["refresh_token"]

    resp = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": refresh_token,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    # New refresh token should differ (rotation)
    assert data["refresh_token"] != refresh_token


async def test_refresh_reuse_rejected(client: AsyncClient):
    """Using a refresh token twice should fail (it's revoked after first use)."""
    reg = await client.post("/api/v1/auth/register", json={
        "email": "surfer@test.com",
        "password": "longpassword123",
    })
    refresh_token = reg.json()["refresh_token"]

    # First use — OK
    await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})

    # Second use — should fail
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 401


async def test_refresh_invalid_token(client: AsyncClient):
    resp = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": "totally-bogus-token",
    })
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Protected endpoints
# ---------------------------------------------------------------------------

async def test_protected_endpoint_without_token(client: AsyncClient):
    """POST /alerts requires auth — should 401 without token."""
    resp = await client.post("/api/v1/alerts", json={
        "channel": "telegram",
        "chat_id": "123",
        "spot_ids": ["matosinhos"],
        "min_score": 6.0,
    })
    assert resp.status_code == 401


async def test_protected_endpoint_with_token(client: AsyncClient):
    """POST /alerts should work with valid token."""
    reg = await client.post("/api/v1/auth/register", json={
        "email": "surfer@test.com",
        "password": "longpassword123",
    })
    token = reg.json()["access_token"]

    resp = await client.post(
        "/api/v1/alerts",
        json={
            "channel": "telegram",
            "chat_id": "123",
            "spot_ids": ["matosinhos"],
            "min_score": 6.0,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200


async def test_protected_endpoint_with_bad_token(client: AsyncClient):
    """POST /alerts should 401 with invalid JWT."""
    resp = await client.post(
        "/api/v1/alerts",
        json={
            "channel": "telegram",
            "chat_id": "123",
            "spot_ids": ["matosinhos"],
            "min_score": 6.0,
        },
        headers={"Authorization": "Bearer invalid.jwt.token"},
    )
    assert resp.status_code == 401


async def test_public_endpoint_no_auth_needed(client: AsyncClient):
    """GET /api/v1/spots should work without auth."""
    resp = await client.get("/api/v1/spots")
    assert resp.status_code == 200


async def test_feedback_submit_requires_auth(client: AsyncClient):
    """POST /feedback/session requires auth."""
    resp = await client.post("/api/v1/feedback/session", json={
        "spot_id": "matosinhos",
        "session_time": "2024-01-15T10:00:00",
        "actual_rating": 4,
    })
    assert resp.status_code == 401


async def test_feedback_read_is_public(client: AsyncClient):
    """GET /feedback should work without auth."""
    resp = await client.get("/api/v1/feedback")
    assert resp.status_code == 200
