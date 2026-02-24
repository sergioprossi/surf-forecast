"""Pydantic schemas for API request/response models."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


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

class AlertConfigCreate(BaseModel):
    channel: str = Field(pattern="^(telegram|email)$")
    chat_id: str | None = None
    email: str | None = None
    spot_ids: list[str]
    min_score: float = Field(default=6.0, ge=0, le=10)
    quiet_start_hour: int = Field(default=22, ge=0, le=23)
    quiet_end_hour: int = Field(default=6, ge=0, le=23)


class AlertConfigResponse(BaseModel):
    id: int
    channel: str
    spot_ids: list[str]
    min_score: float
    enabled: bool


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
