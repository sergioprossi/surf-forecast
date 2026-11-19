"""Tests for GET /api/v1/forecast/compare."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from src.api.main import app
from src.models.database import async_session, engine
from src.models.orm import Base, ForecastData

T = datetime(2026, 11, 18, 9, 0, tzinfo=timezone.utc)


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


async def _seed(spot_id: str, wave_height: float, period: float = 12.0, wind: float = 8.0):
    async with async_session() as s:
        s.add(
            ForecastData(
                source="open_meteo",
                spot_id=spot_id,
                forecast_time=T,
                wave_height=wave_height,
                wave_period=period,
                wave_direction=285,
                swell_height=wave_height,
                swell_period=period,
                swell_direction=285,
                wind_speed=wind,
                wind_direction=90,  # offshore (E)
            )
        )
        await s.commit()


async def test_compare_route_not_shadowed_by_spot_route(client):
    """Regression: /forecast/{spot_id} used to swallow /forecast/compare."""
    resp = await client.get("/api/v1/forecast/compare", params={"spots": "matosinhos"})
    assert resp.status_code == 200
    assert "spots" in resp.json()


async def test_compare_returns_snapshot_with_conditions(client):
    await _seed("matosinhos", 1.5)
    await _seed("espinho", 2.0)

    resp = await client.get(
        "/api/v1/forecast/compare",
        params={"spots": "matosinhos,espinho", "time": T.isoformat()},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert {s["spot"]["id"] for s in data["spots"]} == {"matosinhos", "espinho"}
    for snap in data["spots"]:
        assert 0 <= snap["total_score"] <= 10
        assert snap["conditions"]["wave_height"] in (1.5, 2.0)
        assert snap["components"] is not None


async def test_compare_snaps_time_to_hour(client):
    await _seed("leca", 1.2)
    resp = await client.get(
        "/api/v1/forecast/compare",
        params={"spots": "leca", "time": "2026-11-18T09:37:12+00:00"},
    )
    data = resp.json()
    assert len(data["spots"]) == 1
    assert data["time"].startswith("2026-11-18T09:00:00")


async def test_compare_naive_time_treated_as_utc(client):
    await _seed("leca", 1.2)
    resp = await client.get("/api/v1/forecast/compare", params={"spots": "leca", "time": "2026-11-18T09:00:00"})
    assert len(resp.json()["spots"]) == 1


async def test_compare_no_data_returns_empty_list(client):
    resp = await client.get("/api/v1/forecast/compare", params={"spots": "leca", "time": T.isoformat()})
    assert resp.status_code == 200
    assert resp.json()["spots"] == []


async def test_compare_unknown_spot_returns_404(client):
    resp = await client.get("/api/v1/forecast/compare", params={"spots": "matosinhos,nazare"})
    assert resp.status_code == 404


async def test_compare_empty_spots_returns_422(client):
    resp = await client.get("/api/v1/forecast/compare", params={"spots": " , "})
    assert resp.status_code == 422


async def test_conditions_now_omits_detail_fields(client):
    resp = await client.get("/api/v1/conditions/now")
    assert resp.status_code == 200
    for snap in resp.json()["spots"]:
        assert snap.get("conditions") is None
