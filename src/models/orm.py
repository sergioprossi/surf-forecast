"""SQLAlchemy ORM models for surf forecast data."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Index, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class ForecastData(Base):
    """Raw forecast data from collectors (Open-Meteo, Stormglass, etc.)."""

    __tablename__ = "forecast_data"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(32))  # "open_meteo", "stormglass", "cmems"
    spot_id: Mapped[str] = mapped_column(String(32))
    forecast_time: Mapped[datetime] = mapped_column(DateTime)
    collected_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Wave parameters
    wave_height: Mapped[float | None] = mapped_column(Float, nullable=True)
    wave_direction: Mapped[float | None] = mapped_column(Float, nullable=True)
    wave_period: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Primary swell
    swell_height: Mapped[float | None] = mapped_column(Float, nullable=True)
    swell_direction: Mapped[float | None] = mapped_column(Float, nullable=True)
    swell_period: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Secondary swell (if available)
    swell2_height: Mapped[float | None] = mapped_column(Float, nullable=True)
    swell2_direction: Mapped[float | None] = mapped_column(Float, nullable=True)
    swell2_period: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Wind
    wind_speed: Mapped[float | None] = mapped_column(Float, nullable=True)
    wind_direction: Mapped[float | None] = mapped_column(Float, nullable=True)
    wind_gusts: Mapped[float | None] = mapped_column(Float, nullable=True)

    __table_args__ = (
        Index("ix_forecast_spot_time", "spot_id", "forecast_time"),
        Index("ix_forecast_source_time", "source", "forecast_time"),
    )


class TideData(Base):
    """Tide predictions for Leixões port."""

    __tablename__ = "tide_data"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    time: Mapped[datetime] = mapped_column(DateTime)
    height: Mapped[float] = mapped_column(Float)
    type: Mapped[str | None] = mapped_column(String(4), nullable=True)  # "high" or "low"
    collected_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (Index("ix_tide_time", "time"),)


class ScoredForecast(Base):
    """Computed surf quality scores per spot per time slot."""

    __tablename__ = "scored_forecasts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    spot_id: Mapped[str] = mapped_column(String(32))
    forecast_time: Mapped[datetime] = mapped_column(DateTime)
    scored_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Overall score
    total_score: Mapped[float] = mapped_column(Float)

    # Component scores (0.0–1.0)
    swell_quality: Mapped[float] = mapped_column(Float, default=0.0)
    swell_direction: Mapped[float] = mapped_column(Float, default=0.0)
    period: Mapped[float] = mapped_column(Float, default=0.0)
    spectral_purity: Mapped[float] = mapped_column(Float, default=0.0)
    wind: Mapped[float] = mapped_column(Float, default=0.0)
    wind_trend: Mapped[float] = mapped_column(Float, default=0.0)
    tide: Mapped[float] = mapped_column(Float, default=0.0)
    tide_bathy_interaction: Mapped[float] = mapped_column(Float, default=0.0)
    consistency: Mapped[float] = mapped_column(Float, default=0.0)

    # Summary text
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_scored_spot_time", "spot_id", "forecast_time"),
    )


class AlertConfig(Base):
    """User alert preferences."""

    __tablename__ = "alert_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    channel: Mapped[str] = mapped_column(String(16))  # "telegram" or "email"
    chat_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    email: Mapped[str | None] = mapped_column(String(128), nullable=True)
    spot_ids: Mapped[str] = mapped_column(String(256))  # comma-separated
    min_score: Mapped[float] = mapped_column(Float, default=6.0)
    enabled: Mapped[bool] = mapped_column(Integer, default=True)  # SQLite has no bool
    quiet_start_hour: Mapped[int] = mapped_column(Integer, default=22)
    quiet_end_hour: Mapped[int] = mapped_column(Integer, default=6)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class AlertLog(Base):
    """Sent alerts — used for deduplication."""

    __tablename__ = "alert_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    alert_config_id: Mapped[int] = mapped_column(Integer)
    spot_id: Mapped[str] = mapped_column(String(32))
    forecast_time: Mapped[datetime] = mapped_column(DateTime)
    score: Mapped[float] = mapped_column(Float)
    sent_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("ix_alert_log_dedup", "alert_config_id", "spot_id", "forecast_time"),
    )


class SessionFeedback(Base):
    """User feedback on actual surf sessions — for model calibration."""

    __tablename__ = "session_feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    spot_id: Mapped[str] = mapped_column(String(32))
    session_time: Mapped[datetime] = mapped_column(DateTime)
    predicted_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_rating: Mapped[int] = mapped_column(Integer)  # 1-5 stars
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
