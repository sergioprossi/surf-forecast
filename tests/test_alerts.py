"""Tests for user-scoped alert configuration endpoints."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from src.api.main import app
from src.api.routes.alerts import MAX_ALERTS_PER_USER
from src.models.database import engine
from src.models.orm import Base

TELEGRAM_ALERT = {
    "channel": "telegram",
    "chat_id": "123456789",
    "spot_ids": ["matosinhos", "leca"],
    "min_score": 6.5,
}


@pytest.fixture(autouse=True)
async def setup_db():
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


async def _auth(client: AsyncClient, email: str = "surfer@test.com") -> dict:
    resp = await client.post(
        "/api/v1/auth/register", json={"email": email, "password": "longpassword123"}
    )
    assert resp.status_code == 201
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


# ---------------------------------------------------------------------------
# Auth required
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/v1/alerts"),
        ("post", "/api/v1/alerts"),
        ("patch", "/api/v1/alerts/1"),
        ("delete", "/api/v1/alerts/1"),
    ],
)
async def test_alerts_endpoints_unauthenticated_return_401(client, method, path):
    kwargs = {"json": TELEGRAM_ALERT} if method in ("post", "patch") else {}
    resp = await getattr(client, method)(path, **kwargs)
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

async def test_create_alert_telegram_success(client):
    headers = await _auth(client)
    resp = await client.post("/api/v1/alerts", json=TELEGRAM_ALERT, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["channel"] == "telegram"
    assert data["chat_id"] == "123456789"
    assert data["email"] is None
    assert data["spot_ids"] == ["matosinhos", "leca"]
    assert data["min_score"] == 6.5
    assert data["enabled"] is True
    assert data["quiet_start_hour"] == 22
    assert data["quiet_end_hour"] == 6


async def test_create_alert_email_success_drops_chat_id(client):
    headers = await _auth(client)
    body = {"channel": "email", "email": "me@test.com", "chat_id": "999", "spot_ids": ["espinho"]}
    resp = await client.post("/api/v1/alerts", json=body, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["email"] == "me@test.com"
    assert resp.json()["chat_id"] is None


async def test_create_alert_dedupes_spot_ids(client):
    headers = await _auth(client)
    body = {**TELEGRAM_ALERT, "spot_ids": ["leca", "leca", "espinho"]}
    resp = await client.post("/api/v1/alerts", json=body, headers=headers)
    assert resp.json()["spot_ids"] == ["leca", "espinho"]


@pytest.mark.parametrize(
    "override",
    [
        {"spot_ids": []},
        {"spot_ids": ["nazare"]},
        {"channel": "sms"},
        {"chat_id": None},  # telegram without chat id
        {"chat_id": "not-a-number"},
        {"min_score": 11},
        {"min_score": -1},
        {"quiet_start_hour": 24},
        {"channel": "email", "chat_id": None},  # email without address
        {"channel": "email", "email": "nope"},
    ],
)
async def test_create_alert_invalid_input_returns_422(client, override):
    headers = await _auth(client)
    resp = await client.post("/api/v1/alerts", json={**TELEGRAM_ALERT, **override}, headers=headers)
    assert resp.status_code == 422


async def test_create_alert_over_limit_returns_409(client):
    headers = await _auth(client)
    for _ in range(MAX_ALERTS_PER_USER):
        assert (await client.post("/api/v1/alerts", json=TELEGRAM_ALERT, headers=headers)).status_code == 201
    resp = await client.post("/api/v1/alerts", json=TELEGRAM_ALERT, headers=headers)
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# List + pagination + isolation
# ---------------------------------------------------------------------------

async def test_list_alerts_empty(client):
    headers = await _auth(client)
    resp = await client.get("/api/v1/alerts", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == {"items": [], "next_cursor": None}


async def test_list_alerts_only_returns_own(client):
    alice = await _auth(client, "alice@test.com")
    bob = await _auth(client, "bob@test.com")
    await client.post("/api/v1/alerts", json=TELEGRAM_ALERT, headers=alice)

    assert len((await client.get("/api/v1/alerts", headers=alice)).json()["items"]) == 1
    assert (await client.get("/api/v1/alerts", headers=bob)).json()["items"] == []


async def test_list_alerts_cursor_pagination(client):
    headers = await _auth(client)
    ids = [
        (await client.post("/api/v1/alerts", json=TELEGRAM_ALERT, headers=headers)).json()["id"]
        for _ in range(5)
    ]

    page1 = (await client.get("/api/v1/alerts?limit=2", headers=headers)).json()
    assert [a["id"] for a in page1["items"]] == ids[:2]
    assert page1["next_cursor"] == ids[1]

    page2 = (await client.get(f"/api/v1/alerts?limit=2&cursor={page1['next_cursor']}", headers=headers)).json()
    assert [a["id"] for a in page2["items"]] == ids[2:4]

    page3 = (await client.get(f"/api/v1/alerts?limit=2&cursor={page2['next_cursor']}", headers=headers)).json()
    assert [a["id"] for a in page3["items"]] == ids[4:]
    assert page3["next_cursor"] is None


async def test_list_alerts_limit_out_of_range_returns_422(client):
    headers = await _auth(client)
    assert (await client.get("/api/v1/alerts?limit=0", headers=headers)).status_code == 422
    assert (await client.get("/api/v1/alerts?limit=101", headers=headers)).status_code == 422


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

async def test_update_alert_toggle_enabled(client):
    headers = await _auth(client)
    alert_id = (await client.post("/api/v1/alerts", json=TELEGRAM_ALERT, headers=headers)).json()["id"]

    resp = await client.patch(f"/api/v1/alerts/{alert_id}", json={"enabled": False}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["enabled"] is False
    # untouched fields preserved
    assert resp.json()["min_score"] == 6.5
    assert resp.json()["spot_ids"] == ["matosinhos", "leca"]


async def test_update_alert_spots_and_threshold(client):
    headers = await _auth(client)
    alert_id = (await client.post("/api/v1/alerts", json=TELEGRAM_ALERT, headers=headers)).json()["id"]

    resp = await client.patch(
        f"/api/v1/alerts/{alert_id}",
        json={"spot_ids": ["espinho"], "min_score": 8, "quiet_start_hour": 23},
        headers=headers,
    )
    data = resp.json()
    assert data["spot_ids"] == ["espinho"]
    assert data["min_score"] == 8
    assert data["quiet_start_hour"] == 23


async def test_update_alert_invalid_spot_returns_422(client):
    headers = await _auth(client)
    alert_id = (await client.post("/api/v1/alerts", json=TELEGRAM_ALERT, headers=headers)).json()["id"]
    resp = await client.patch(f"/api/v1/alerts/{alert_id}", json={"spot_ids": ["nazare"]}, headers=headers)
    assert resp.status_code == 422


async def test_update_alert_other_user_returns_404(client):
    alice = await _auth(client, "alice@test.com")
    bob = await _auth(client, "bob@test.com")
    alert_id = (await client.post("/api/v1/alerts", json=TELEGRAM_ALERT, headers=alice)).json()["id"]

    resp = await client.patch(f"/api/v1/alerts/{alert_id}", json={"enabled": False}, headers=bob)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

async def test_delete_alert_success(client):
    headers = await _auth(client)
    alert_id = (await client.post("/api/v1/alerts", json=TELEGRAM_ALERT, headers=headers)).json()["id"]

    resp = await client.delete(f"/api/v1/alerts/{alert_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == {"deleted": alert_id}
    assert (await client.get("/api/v1/alerts", headers=headers)).json()["items"] == []


async def test_delete_alert_other_user_returns_404_and_keeps_alert(client):
    alice = await _auth(client, "alice@test.com")
    bob = await _auth(client, "bob@test.com")
    alert_id = (await client.post("/api/v1/alerts", json=TELEGRAM_ALERT, headers=alice)).json()["id"]

    assert (await client.delete(f"/api/v1/alerts/{alert_id}", headers=bob)).status_code == 404
    assert len((await client.get("/api/v1/alerts", headers=alice)).json()["items"]) == 1


async def test_delete_alert_missing_returns_404(client):
    headers = await _auth(client)
    assert (await client.delete("/api/v1/alerts/9999", headers=headers)).status_code == 404
