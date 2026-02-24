"""Spots endpoint — list available surf spots."""

from __future__ import annotations

from fastapi import APIRouter

from src.config import SPOTS
from src.models.schemas import SpotInfo, SpotListResponse

router = APIRouter(prefix="/api/v1", tags=["spots"])


@router.get("/spots", response_model=SpotListResponse)
async def list_spots() -> SpotListResponse:
    """List all configured surf spots."""
    spots = [
        SpotInfo(
            id=sid,
            name=s["name"],
            lat=s["lat"],
            lon=s["lon"],
            facing=s["facing"],
            description=s["description"],
        )
        for sid, s in SPOTS.items()
    ]
    return SpotListResponse(spots=spots)
