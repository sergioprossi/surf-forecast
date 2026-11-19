"""Pydantic schemas for API request/response models."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Spots
# ---------------------------------------------------------------------------

class SpotInfo(BaseModel):
    id: str
    name: str
    lat: float
    lon: float
    facing: int
    description: str


class SpotListResponse(BaseModel):
    spots: list[SpotInfo]


# ---------------------------------------------------------------------------
# Forecast / Scores
# ---------------------------------------------------------------------------

class ComponentScores(BaseModel):
    swell_quality: float = Field(ge=0, le=1)
    swell_direction: float = Field(ge=0, le=1)
    period: float = Field(ge=0, le=1)
    spectral_purity: float = Field(ge=0, le=1)
    wind: float = Field(ge=0, le=1)
    wind_trend: float = Field(ge=0, le=1)
    tide: float = Field(ge=0, le=1)
    tide_bathy_interaction: float = Field(ge=0, le=1)
    consistency: float = Field(ge=0, le=1)


class RawConditions(BaseModel):
    wave_height: float | None = None
    wave_period: float | None = None
    wave_direction: float | None = None
    swell_height: float | None = None
    swell_period: float | None = None
    swell_direction: float | None = None
    wind_speed: float | None = None
    wind_direction: float | None = None
    tide_height: float | None = None


class ForecastSlot(BaseModel):
    time: datetime
    total_score: float = Field(ge=0, le=10)
    rating: str  # "flat", "poor", "fair", "good", "great", "epic"
    components: ComponentScores
    conditions: RawConditions
    summary: str


class SpotForecastResponse(BaseModel):
    spot: SpotInfo
    forecast: list[ForecastSlot]


# ---------------------------------------------------------------------------
# Comparison
# ---------------------------------------------------------------------------

class SpotSnapshot(BaseModel):
    spot: SpotInfo
    time: datetime
    total_score: float
    rating: str
    summary: str
    # Optional detail — populated by /forecast/compare so the Compare screen can
    # show conditions side by side. Left out by /conditions/now to keep it light.
    components: ComponentScores | None = None
    conditions: RawConditions | None = None


class CompareResponse(BaseModel):
    time: datetime
    spots: list[SpotSnapshot]


# ---------------------------------------------------------------------------
# Best windows
# ---------------------------------------------------------------------------

class BestWindow(BaseModel):
    spot: SpotInfo
    start: datetime
    end: datetime
    peak_score: float
    avg_score: float
    rating: str
    summary: str


class BestWindowsResponse(BaseModel):
    windows: list[BestWindow]


# ---------------------------------------------------------------------------
# Current conditions
# ---------------------------------------------------------------------------

class CurrentConditions(BaseModel):
    spots: list[SpotSnapshot]
    updated_at: datetime


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

def _validate_spot_ids(spot_ids: list[str]) -> list[str]:
    """Reject unknown spots and drop duplicates (order preserved)."""
    from src.config import SPOTS

    unknown = [s for s in spot_ids if s not in SPOTS]
    if unknown:
        raise ValueError(f"Unknown spot(s): {', '.join(unknown)}")
    return list(dict.fromkeys(spot_ids))


class AlertConfigCreate(BaseModel):
    channel: Literal["telegram", "email"]
    # Telegram chat IDs are integers (negative for groups)
    chat_id: str | None = Field(default=None, pattern=r"^-?\d{1,20}$")
    email: EmailStr | None = None
    spot_ids: list[str] = Field(min_length=1, max_length=10)
    min_score: float = Field(default=6.0, ge=0, le=10)
    quiet_start_hour: int = Field(default=22, ge=0, le=23)
    quiet_end_hour: int = Field(default=6, ge=0, le=23)

    _check_spots = field_validator("spot_ids")(_validate_spot_ids)

    @model_validator(mode="after")
    def _destination_matches_channel(self) -> "AlertConfigCreate":
        if self.channel == "telegram":
            if not self.chat_id:
                raise ValueError("chat_id is required for telegram alerts")
            self.email = None
        else:
            if not self.email:
                raise ValueError("email is required for email alerts")
            self.chat_id = None
        return self


class AlertConfigUpdate(BaseModel):
    """Partial update. Channel/destination are immutable — delete and recreate."""

    enabled: bool | None = None
    spot_ids: list[str] | None = Field(default=None, min_length=1, max_length=10)
    min_score: float | None = Field(default=None, ge=0, le=10)
    quiet_start_hour: int | None = Field(default=None, ge=0, le=23)
    quiet_end_hour: int | None = Field(default=None, ge=0, le=23)

    @field_validator("spot_ids")
    @classmethod
    def _check_spots(cls, v: list[str] | None) -> list[str] | None:
        return None if v is None else _validate_spot_ids(v)


class AlertConfigResponse(BaseModel):
    id: int
    channel: str
    chat_id: str | None = None
    email: str | None = None
    spot_ids: list[str]
    min_score: float
    enabled: bool
    quiet_start_hour: int
    quiet_end_hour: int


class AlertListResponse(BaseModel):
    items: list[AlertConfigResponse]
    next_cursor: int | None = None


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------

class SessionFeedbackCreate(BaseModel):
    spot_id: str
    session_time: datetime
    actual_rating: int = Field(ge=1, le=5)
    notes: str | None = None


class SessionFeedbackResponse(BaseModel):
    id: int
    spot_id: str
    session_time: datetime
    predicted_score: float | None
    actual_rating: int
    notes: str | None
