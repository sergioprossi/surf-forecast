"""Open-Meteo Marine + Weather API collector.

Primary data source — free, no API key required.
Fetches hourly wave, swell, and wind data for each spot.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import SPOTS, settings
from src.models.orm import ForecastData

logger = logging.getLogger(__name__)

MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"

MARINE_PARAMS = [
    "wave_height",
    "wave_direction",
    "wave_period",
    "swell_wave_height",
    "swell_wave_direction",
    "swell_wave_period",
    "swell_wave_peak_period",
    "secondary_swell_wave_height",
    "secondary_swell_wave_direction",
    "secondary_swell_wave_period",
]

WEATHER_PARAMS = [
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
]


async def fetch_marine(
    client: httpx.AsyncClient, lat: float, lon: float, days: int
) -> dict:
    """Fetch marine data from Open-Meteo."""
    resp = await client.get(
        MARINE_URL,
        params={
            "latitude": lat,
            "longitude": lon,
            "hourly": ",".join(MARINE_PARAMS),
            "forecast_days": days,
            "timezone": "UTC",
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


async def fetch_weather(
    client: httpx.AsyncClient, lat: float, lon: float, days: int
) -> dict:
    """Fetch wind data from Open-Meteo weather API."""
    resp = await client.get(
        WEATHER_URL,
        params={
            "latitude": lat,
            "longitude": lon,
            "hourly": ",".join(WEATHER_PARAMS),
            "forecast_days": days,
            "timezone": "UTC",
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def _parse_time(iso: str) -> datetime:
    """Parse ISO timestamp from Open-Meteo (no trailing Z)."""
    return datetime.fromisoformat(iso).replace(tzinfo=timezone.utc)


async def collect_open_meteo(session: AsyncSession) -> int:
    """Fetch and store Open-Meteo data for all spots.

    Returns the number of rows inserted.
    """
    days = settings.default_forecast_days
    rows_added = 0

    async with httpx.AsyncClient() as client:
        for spot_id, spot in SPOTS.items():
            try:
                marine, weather = await fetch_marine(
                    client, spot["lat"], spot["lon"], days
                ), None

                weather = await fetch_weather(
                    client, spot["lat"], spot["lon"], days
                )

                hourly_m = marine.get("hourly", {})
                hourly_w = weather.get("hourly", {})
                times = hourly_m.get("time", [])

                for i, t in enumerate(times):
                    row = ForecastData(
                        source="open_meteo",
                        spot_id=spot_id,
                        forecast_time=_parse_time(t),
                        wave_height=_safe_get(hourly_m, "wave_height", i),
                        wave_direction=_safe_get(hourly_m, "wave_direction", i),
                        wave_period=_safe_get(hourly_m, "wave_period", i),
                        swell_height=_safe_get(hourly_m, "swell_wave_height", i),
                        swell_direction=_safe_get(hourly_m, "swell_wave_direction", i),
                        swell_period=_safe_get(
                            hourly_m, "swell_wave_peak_period", i
                        ) or _safe_get(hourly_m, "swell_wave_period", i),
                        swell2_height=_safe_get(
                            hourly_m, "secondary_swell_wave_height", i
                        ),
                        swell2_direction=_safe_get(
                            hourly_m, "secondary_swell_wave_direction", i
                        ),
                        swell2_period=_safe_get(
                            hourly_m, "secondary_swell_wave_period", i
                        ),
                        wind_speed=_safe_get(hourly_w, "wind_speed_10m", i),
                        wind_direction=_safe_get(hourly_w, "wind_direction_10m", i),
                        wind_gusts=_safe_get(hourly_w, "wind_gusts_10m", i),
                    )
                    session.add(row)
                    rows_added += 1

                logger.info("Open-Meteo: %s — %d hours fetched", spot_id, len(times))

            except httpx.HTTPError as exc:
                logger.error("Open-Meteo error for %s: %s", spot_id, exc)

    await session.commit()
    logger.info("Open-Meteo: total %d rows stored", rows_added)
    return rows_added


def _safe_get(hourly: dict, key: str, idx: int) -> float | None:
    """Safely index into an hourly array, returning None on missing data."""
    values = hourly.get(key)
    if values is None or idx >= len(values):
        return None
    return values[idx]
