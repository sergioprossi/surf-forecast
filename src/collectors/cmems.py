"""Copernicus Marine (CMEMS) data collector — spectral wave data.

Fetches higher-quality spectral wave parameters (VHM0, VTPK, VMDR, etc.)
from the Copernicus Marine Service. Requires free registration.

This collector is optional (Phase 5) and enhances the spectral_purity
and consistency scores when available.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import SPOTS, settings
from src.models.orm import ForecastData

logger = logging.getLogger(__name__)

# CMEMS Marine Data Store API
# Dataset: MEDSEA_ANALYSISFORECAST_WAV_006_017 (Mediterranean/Atlantic)
# or GLOBAL_ANALYSISFORECAST_WAV_001_027 (global)
CMEMS_CATALOG_URL = "https://data-be-prd.marine.copernicus.eu/api"


async def collect_cmems(session: AsyncSession) -> int:
    """Fetch CMEMS wave data for Porto coast spots.

    Uses the Copernicus Marine Data Store API to get spectral wave
    parameters. Requires CMEMS_USERNAME and CMEMS_PASSWORD in .env.

    Returns the number of rows stored, or 0 if not configured.
    """
    if not settings.cmems_username or not settings.cmems_password:
        logger.info("CMEMS: skipped — no credentials configured")
        return 0

    rows_added = 0

    # Porto coast bounding box
    min_lat = min(s["lat"] for s in SPOTS.values()) - 0.1
    max_lat = max(s["lat"] for s in SPOTS.values()) + 0.1
    min_lon = min(s["lon"] for s in SPOTS.values()) - 0.1
    max_lon = max(s["lon"] for s in SPOTS.values()) + 0.1

    now = datetime.now(timezone.utc)
    start = now.replace(minute=0, second=0, microsecond=0)
    end = start + timedelta(days=settings.default_forecast_days)

    try:
        # Try using the copernicusmarine Python package (preferred)
        data = await _fetch_via_package(min_lat, max_lat, min_lon, max_lon, start, end)

        if data is not None:
            rows_added = await _store_cmems_data(session, data)
            logger.info("CMEMS: %d rows stored via Python package", rows_added)
            return rows_added

    except ImportError:
        logger.info("CMEMS: copernicusmarine package not installed, trying REST API")
    except Exception:
        logger.exception("CMEMS Python package failed, trying REST API")

    # Fallback: REST API (subset download)
    try:
        rows_added = await _fetch_via_rest(
            session, min_lat, max_lat, min_lon, max_lon, start, end
        )
    except Exception:
        logger.exception("CMEMS REST API also failed")

    return rows_added


async def _fetch_via_package(
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
    start: datetime,
    end: datetime,
) -> dict | None:
    """Fetch CMEMS data using the copernicusmarine Python package."""
    import copernicusmarine

    ds = copernicusmarine.open_dataset(
        dataset_id="cmems_mod_glo_wav_anfc_0.083deg_PT3H-i",
        variables=["VHM0", "VTPK", "VMDR", "VHM0_SW1", "VMDR_SW1", "VTM01_SW1",
                    "VHM0_SW2", "VMDR_SW2", "VTM01_SW2"],
        minimum_latitude=min_lat,
        maximum_latitude=max_lat,
        minimum_longitude=min_lon,
        maximum_longitude=max_lon,
        start_datetime=start.isoformat(),
        end_datetime=end.isoformat(),
        username=settings.cmems_username,
        password=settings.cmems_password,
    )

    return ds


async def _store_cmems_data(session: AsyncSession, ds) -> int:
    """Store xarray dataset into forecast_data table."""
    rows = 0

    for spot_id, spot in SPOTS.items():
        try:
            # Find nearest grid point to spot
            point = ds.sel(
                latitude=spot["lat"],
                longitude=spot["lon"],
                method="nearest",
            )

            for t_idx in range(len(point.time)):
                t = point.time.values[t_idx]
                forecast_time = datetime.utcfromtimestamp(
                    t.astype("datetime64[s]").astype("int64")
                ).replace(tzinfo=timezone.utc)

                row = ForecastData(
                    source="cmems",
                    spot_id=spot_id,
                    forecast_time=forecast_time,
                    wave_height=_xr_val(point, "VHM0", t_idx),
                    wave_period=_xr_val(point, "VTPK", t_idx),
                    wave_direction=_xr_val(point, "VMDR", t_idx),
                    swell_height=_xr_val(point, "VHM0_SW1", t_idx),
                    swell_direction=_xr_val(point, "VMDR_SW1", t_idx),
                    swell_period=_xr_val(point, "VTM01_SW1", t_idx),
                    swell2_height=_xr_val(point, "VHM0_SW2", t_idx),
                    swell2_direction=_xr_val(point, "VMDR_SW2", t_idx),
                    swell2_period=_xr_val(point, "VTM01_SW2", t_idx),
                )
                session.add(row)
                rows += 1

        except Exception:
            logger.exception("CMEMS: failed to extract data for %s", spot_id)

    await session.commit()
    return rows


def _xr_val(ds, var: str, idx: int) -> float | None:
    """Safely extract a float value from xarray at a time index."""
    try:
        import numpy as np

        val = float(ds[var].values[idx])
        if np.isnan(val):
            return None
        return val
    except (KeyError, IndexError):
        return None


async def _fetch_via_rest(
    session: AsyncSession,
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
    start: datetime,
    end: datetime,
) -> int:
    """Fallback: fetch CMEMS data via REST API subset endpoint."""
    logger.info("CMEMS REST API: attempting subset download for Porto coast")

    # The CMEMS Marine Data Store REST API for subsetting
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{CMEMS_CATALOG_URL}/subset",
            json={
                "datasetId": "cmems_mod_glo_wav_anfc_0.083deg_PT3H-i",
                "variables": ["VHM0", "VTPK", "VMDR"],
                "boundingBox": {
                    "north": max_lat,
                    "south": min_lat,
                    "east": max_lon,
                    "west": min_lon,
                },
                "dateRange": {
                    "start": start.isoformat(),
                    "end": end.isoformat(),
                },
                "format": "json",
            },
            auth=(settings.cmems_username, settings.cmems_password),
            timeout=120,
        )

        if resp.status_code != 200:
            logger.warning("CMEMS REST returned %d: %s", resp.status_code, resp.text[:200])
            return 0

        data = resp.json()
        logger.info("CMEMS REST: received data, parsing...")

        # Store whatever we get — format may vary
        # This is a best-effort fallback
        return 0  # TODO: parse REST response format when credentials available
