"""Stormglass API collector — supplementary cross-validation data.

Limited free tier: 10 requests/day. Used to spot-check Open-Meteo data.
Only fetches if STORMGLASS_API_KEY is configured.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import SPOTS, settings
from src.models.orm import ForecastData

logger = logging.getLogger(__name__)

STORMGLASS_URL = "https://api.stormglass.io/v2/weather/point"

# Stormglass parameter names
SG_PARAMS = (
    "waveHeight,waveDirection,wavePeriod,"
    "swellHeight,swellDirection,swellPeriod,"
    "secondarySwellHeight,secondarySwellDirection,secondarySwellPeriod,"
    "windSpeed,windDirection,gust"
)


async def collect_stormglass(session: AsyncSession) -> int:
    """Fetch Stormglass data for all spots.

    Returns 0 if no API key is configured.
    """
    if not settings.stormglass_api_key:
        logger.info("Stormglass: skipped — no API key configured")
        return 0

    rows_added = 0

    async with httpx.AsyncClient() as client:
        for spot_id, spot in SPOTS.items():
            try:
                resp = await client.get(
                    STORMGLASS_URL,
                    params={
                        "lat": spot["lat"],
                        "lng": spot["lon"],
                        "params": SG_PARAMS,
                    },
                    headers={"Authorization": settings.stormglass_api_key},
                    timeout=30,
                )
                resp.raise_for_status()
                data = resp.json()

                for hour in data.get("hours", []):
                    row = ForecastData(
                        source="stormglass",
                        spot_id=spot_id,
                        forecast_time=datetime.fromisoformat(
                            hour["time"].replace("Z", "+00:00")
                        ),
                        wave_height=_sg_val(hour, "waveHeight"),
                        wave_direction=_sg_val(hour, "waveDirection"),
                        wave_period=_sg_val(hour, "wavePeriod"),
                        swell_height=_sg_val(hour, "swellHeight"),
                        swell_direction=_sg_val(hour, "swellDirection"),
                        swell_period=_sg_val(hour, "swellPeriod"),
                        swell2_height=_sg_val(hour, "secondarySwellHeight"),
                        swell2_direction=_sg_val(hour, "secondarySwellDirection"),
                        swell2_period=_sg_val(hour, "secondarySwellPeriod"),
                        wind_speed=_sg_val(hour, "windSpeed"),
                        wind_direction=_sg_val(hour, "windDirection"),
                        wind_gusts=_sg_val(hour, "gust"),
                    )
                    session.add(row)
                    rows_added += 1

                logger.info("Stormglass: %s — %d hours fetched", spot_id, len(data.get("hours", [])))

            except httpx.HTTPError as exc:
                logger.error("Stormglass error for %s: %s", spot_id, exc)

    await session.commit()
    logger.info("Stormglass: total %d rows stored", rows_added)
    return rows_added


def _sg_val(hour: dict, key: str) -> float | None:
    """Extract a value from Stormglass response, preferring 'sg' source."""
    param = hour.get(key)
    if param is None:
        return None
    if isinstance(param, dict):
        return param.get("sg") or param.get("noaa") or param.get("dwd")
    return None
