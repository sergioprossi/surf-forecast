"""Spot profile helper — wraps the raw config dict with convenience methods."""

from __future__ import annotations

from src.config import SPOTS


class SpotProfile:
    """Typed accessor for spot configuration data."""

    def __init__(self, spot_id: str) -> None:
        if spot_id not in SPOTS:
            raise ValueError(f"Unknown spot: {spot_id}")
        self.id = spot_id
        self._data = SPOTS[spot_id]

    # Basic info
    @property
    def name(self) -> str:
        return self._data["name"]

    @property
    def lat(self) -> float:
        return self._data["lat"]

    @property
    def lon(self) -> float:
        return self._data["lon"]

    @property
    def facing(self) -> int:
        return self._data["facing"]

    @property
    def description(self) -> str:
        return self._data["description"]

    # Swell
    @property
    def swell_window(self) -> tuple[int, int]:
        return self._data["swell_window"]

    @property
    def ideal_height_range(self) -> tuple[float, float]:
        return self._data["ideal_height_range"]

    @property
    def ideal_period_range(self) -> tuple[int, int]:
        return self._data["ideal_period_range"]

    @property
    def min_period(self) -> int:
        return self._data["min_period"]

    # Wind
    @property
    def offshore_wind_dirs(self) -> tuple[int, int]:
        return self._data["offshore_wind_dirs"]

    # Tide
    @property
    def tide_sensitivity(self) -> float:
        return self._data["tide_sensitivity"]

    @property
    def ideal_tide_pct(self) -> tuple[int, int]:
        return self._data["ideal_tide_pct"]

    @property
    def depth_at_break(self) -> float:
        return self._data["depth_at_break"]

    @property
    def douro_influence(self) -> float:
        return self._data["douro_influence"]

    # Scoring weights
    @property
    def weights(self) -> dict[str, float]:
        return self._data["weights"]

    def weight(self, component: str) -> float:
        return self._data["weights"].get(component, 1.0)


def get_all_profiles() -> list[SpotProfile]:
    return [SpotProfile(sid) for sid in SPOTS]
