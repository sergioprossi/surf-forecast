"""Application settings and spot definitions for Porto coast."""

from __future__ import annotations

from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import Field


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"


class Settings(BaseSettings):
    database_url: str = f"sqlite+aiosqlite:///{DATA_DIR / 'surf_forecast.db'}"

    # Stormglass (optional)
    stormglass_api_key: str = ""

    # Copernicus Marine (Phase 5)
    cmems_username: str = ""
    cmems_password: str = ""

    # Telegram
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    # Email
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    email_from: str = ""
    email_to: str = ""

    # JWT Auth
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Scheduling
    default_forecast_days: int = 3
    scheduler_interval_minutes: int = 60

    model_config = {"env_file": str(BASE_DIR / ".env"), "extra": "ignore"}


settings = Settings()


# ---------------------------------------------------------------------------
# Porto coast spot definitions
# ---------------------------------------------------------------------------
# Each spot encodes local knowledge about how ocean parameters map to actual
# wave quality at that specific beach.

SPOTS: dict[str, dict] = {
    "matosinhos": {
        "name": "Matosinhos",
        "lat": 41.185,
        "lon": -8.690,
        "facing": 270,  # degrees — west-facing
        "swell_window": (240, 310),  # SW to NW
        "offshore_wind_dirs": (45, 135),  # NE to SE = offshore
        "ideal_height_range": (0.8, 2.0),  # metres
        "ideal_period_range": (10, 16),  # seconds
        "min_period": 8,
        "tide_sensitivity": 0.5,  # moderate
        "ideal_tide_pct": (30, 70),  # mid-tide works best
        "depth_at_break": 2.5,  # metres at MLLW
        "douro_influence": 0.6,  # moderate — nearby river
        "description": (
            "Beach break sheltered by Leixões breakwater. "
            "Blocks N-NW swell — needs more westerly component. "
            "Consistent but rarely big. Good for beginners to intermediates."
        ),
        # Scoring weights — higher = more important for this spot
        "weights": {
            "swell_quality": 1.0,
            "swell_direction": 1.4,  # direction matters a lot (breakwater)
            "period": 1.2,
            "spectral_purity": 0.8,
            "wind": 1.0,
            "wind_trend": 0.9,
            "tide": 0.7,
            "tide_bathy_interaction": 0.5,
            "consistency": 0.8,
        },
    },
    "leca": {
        "name": "Leça da Palmeira",
        "lat": 41.200,
        "lon": -8.705,
        "facing": 280,  # WNW-facing
        "swell_window": (260, 330),  # W to NNW
        "offshore_wind_dirs": (60, 150),  # ENE to SSE = offshore
        "ideal_height_range": (1.0, 2.5),
        "ideal_period_range": (10, 18),
        "min_period": 9,
        "tide_sensitivity": 0.9,  # high — reef break
        "ideal_tide_pct": (20, 55),  # works better on lower tides
        "depth_at_break": 1.8,
        "douro_influence": 0.4,
        "description": (
            "Reef and beach break mix. Rock reef produces hollow waves "
            "and barrels on the right swell. Very tide-sensitive — "
            "low-to-mid tide is crucial. Handles bigger swells than Matosinhos."
        ),
        "weights": {
            "swell_quality": 1.0,
            "swell_direction": 1.0,
            "period": 1.3,
            "spectral_purity": 1.0,
            "wind": 1.1,
            "wind_trend": 0.8,
            "tide": 1.5,  # tide is critical for reef
            "tide_bathy_interaction": 1.3,
            "consistency": 0.9,
        },
    },
    "espinho": {
        "name": "Espinho",
        "lat": 41.007,
        "lon": -8.647,
        "facing": 275,  # W-WNW
        "swell_window": (250, 340),  # WSW to NNW — wider window
        "offshore_wind_dirs": (50, 140),  # NE to SE
        "ideal_height_range": (1.0, 3.0),  # handles more size
        "ideal_period_range": (10, 18),
        "min_period": 8,
        "tide_sensitivity": 0.6,
        "ideal_tide_pct": (25, 65),
        "depth_at_break": 2.0,
        "douro_influence": 0.2,  # far from river
        "description": (
            "Beach break with breakwall that produces fast right-handers. "
            "Handles bigger swells than Porto spots. Less sheltered — "
            "picks up more swell but also more exposed to wind."
        ),
        "weights": {
            "swell_quality": 1.2,  # size matters here
            "swell_direction": 0.9,
            "period": 1.1,
            "spectral_purity": 0.9,
            "wind": 1.3,  # more exposed to wind
            "wind_trend": 1.0,
            "tide": 0.8,
            "tide_bathy_interaction": 0.7,
            "consistency": 1.0,
        },
    },
}

# Component score names for iteration
SCORE_COMPONENTS = [
    "swell_quality",
    "swell_direction",
    "period",
    "spectral_purity",
    "wind",
    "wind_trend",
    "tide",
    "tide_bathy_interaction",
    "consistency",
]
