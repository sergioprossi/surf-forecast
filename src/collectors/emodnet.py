"""EMODnet bathymetry data — one-time download of seafloor depth profiles.

Stores depth data as JSON files per spot in data/bathymetry/.
Used by the tide-bathymetry interaction model in the scoring engine.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import httpx

from src.config import DATA_DIR, SPOTS

logger = logging.getLogger(__name__)

BATHY_DIR = DATA_DIR / "bathymetry"

# EMODnet REST API for bathymetry
EMODNET_WCS_URL = "https://ows.emodnet-bathymetry.eu/wcs"


def _bbox_around(lat: float, lon: float, radius_deg: float = 0.02) -> str:
    """Create a WCS bounding box string around a point."""
    return f"{lon - radius_deg},{lat - radius_deg},{lon + radius_deg},{lat + radius_deg}"


async def fetch_bathymetry(spot_id: str, lat: float, lon: float) -> dict | None:
    """Fetch bathymetry from EMODnet WCS for a small area around the spot.

    Returns a dict with depth_profile data, or None on failure.
    """
    bbox = _bbox_around(lat, lon)

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                EMODNET_WCS_URL,
                params={
                    "service": "WCS",
                    "version": "2.0.1",
                    "request": "GetCoverage",
                    "CoverageId": "emodnet__mean",
                    "subset": f"Long({lon - 0.02},{lon + 0.02})",
                    "subset": f"Lat({lat - 0.02},{lat + 0.02})",
                    "format": "application/json",
                },
                timeout=60,
            )

            if resp.status_code == 200:
                return resp.json()
            else:
                logger.warning(
                    "EMODnet returned %d for %s — using fallback",
                    resp.status_code,
                    spot_id,
                )
                return None

        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            logger.warning("EMODnet fetch failed for %s: %s — using fallback", spot_id, exc)
            return None


def _fallback_profile(spot_id: str) -> dict:
    """Generate a simple depth profile from spot config data.

    Until EMODnet data is fetched, use the configured depth_at_break
    to create a basic linear profile.
    """
    spot = SPOTS[spot_id]
    depth = spot["depth_at_break"]

    # Simple linear profile from shore to 500m offshore
    return {
        "spot_id": spot_id,
        "source": "fallback",
        "depth_at_break": depth,
        "profile": [
            {"distance_m": 0, "depth_m": 0.0},
            {"distance_m": 50, "depth_m": depth * 0.3},
            {"distance_m": 100, "depth_m": depth * 0.6},
            {"distance_m": 200, "depth_m": depth},
            {"distance_m": 500, "depth_m": depth * 2.5},
            {"distance_m": 1000, "depth_m": depth * 5.0},
        ],
    }


async def collect_bathymetry() -> int:
    """Fetch and store bathymetry for all spots.

    Creates fallback profiles if EMODnet is unreachable.
    Returns the number of spot profiles saved.
    """
    BATHY_DIR.mkdir(parents=True, exist_ok=True)
    count = 0

    for spot_id, spot in SPOTS.items():
        out_file = BATHY_DIR / f"{spot_id}.json"

        if out_file.exists():
            logger.info("Bathymetry: %s — already cached", spot_id)
            count += 1
            continue

        data = await fetch_bathymetry(spot_id, spot["lat"], spot["lon"])

        if data is None:
            data = _fallback_profile(spot_id)
            logger.info("Bathymetry: %s — using fallback profile", spot_id)
        else:
            data = {
                "spot_id": spot_id,
                "source": "emodnet",
                "raw": data,
                "depth_at_break": spot["depth_at_break"],
            }
            logger.info("Bathymetry: %s — EMODnet data saved", spot_id)

        out_file.write_text(json.dumps(data, indent=2))
        count += 1

    return count


def load_bathymetry(spot_id: str) -> dict:
    """Load cached bathymetry profile for a spot."""
    path = BATHY_DIR / f"{spot_id}.json"
    if path.exists():
        return json.loads(path.read_text())
    return _fallback_profile(spot_id)
