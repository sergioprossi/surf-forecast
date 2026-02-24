"""Spectral analysis — swell purity and consistency scoring.

Evaluates whether conditions consist of a single clean swell or
confused crossing seas. Uses primary + secondary swell partition data
from Open-Meteo / CMEMS.
"""

from __future__ import annotations

import math


def spectral_purity_score(
    swell_height: float | None,
    swell_period: float | None,
    swell_dir: float | None,
    swell2_height: float | None,
    swell2_period: float | None,
    swell2_dir: float | None,
    wave_height: float | None,
) -> float:
    """Score spectral purity from 0 (confused mess) to 1 (clean single swell).

    A clean swell means:
    - Primary swell dominates total wave energy
    - Secondary swell is small or absent
    - If secondary swell exists, it's from a similar direction (not crossing)
    """
    if swell_height is None or swell_height < 0.1:
        return 0.2  # no meaningful swell

    # Energy dominance: what fraction of total wave height comes from primary swell?
    # Wave energy ∝ H², so compare squared heights
    total_energy = swell_height**2
    if swell2_height and swell2_height > 0.1:
        total_energy += swell2_height**2

    if wave_height and wave_height > swell_height:
        # Wind waves contributing significant energy beyond swell
        wind_wave_energy = max(0, wave_height**2 - total_energy)
        total_energy += wind_wave_energy

    if total_energy <= 0:
        return 0.5

    dominance = (swell_height**2) / total_energy

    # Crossing penalty: if secondary swell comes from a different direction
    crossing_penalty = 0.0
    if (
        swell2_height
        and swell2_height > 0.3
        and swell_dir is not None
        and swell2_dir is not None
    ):
        dir_diff = abs(swell_dir - swell2_dir) % 360
        if dir_diff > 180:
            dir_diff = 360 - dir_diff

        if dir_diff > 90:
            # Crossing seas — significant penalty
            energy_ratio = swell2_height**2 / (swell_height**2)
            crossing_penalty = min(0.4, energy_ratio * 0.5 * (dir_diff / 180))
        elif dir_diff > 45:
            energy_ratio = swell2_height**2 / (swell_height**2)
            crossing_penalty = min(0.2, energy_ratio * 0.2)

    score = dominance - crossing_penalty
    return max(0.0, min(1.0, score))


def consistency_score(
    swell_period: float | None,
    spectral_purity: float,
    swell_height: float | None,
) -> float:
    """Score expected set consistency.

    Longer periods = more consistent sets.
    Higher spectral purity = more regular intervals.
    Very small swells = inconsistent regardless.
    """
    if swell_period is None or swell_height is None:
        return 0.3

    if swell_height < 0.3:
        return 0.1  # barely any swell

    # Period factor: longer period = more consistent sets
    if swell_period >= 14:
        period_factor = 1.0
    elif swell_period >= 12:
        period_factor = 0.9
    elif swell_period >= 10:
        period_factor = 0.7
    elif swell_period >= 8:
        period_factor = 0.5
    else:
        period_factor = 0.3

    # Consistency = period regularity × spectral purity
    return max(0.0, min(1.0, period_factor * 0.6 + spectral_purity * 0.4))
