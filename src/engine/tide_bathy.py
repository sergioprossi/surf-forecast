"""Tide-bathymetry interaction model.

Models how the current tide level interacts with the seafloor profile
at each spot to affect wave quality. At reef breaks (like Leça), this
interaction is critical — too much water drowns the reef, too little
exposes rocks.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from src.config import DATA_DIR


def tide_bathy_score(
    tide_height: float,
    depth_at_break: float,
    tide_sensitivity: float,
    ideal_tide_pct: tuple[int, int],
    tide_pct: float,
) -> float:
    """Score how current tide interacts with bottom contour.

    Args:
        tide_height: current tide height in metres above chart datum
        depth_at_break: depth at the primary breakpoint at MLLW
        tide_sensitivity: 0-1, how much this spot cares about tide
        ideal_tide_pct: (low, high) percentage range of tidal cycle
        tide_pct: current position in tidal cycle (0=low, 100=high)

    Returns:
        Score from 0.0 (terrible interaction) to 1.0 (perfect).
    """
    low, high = ideal_tide_pct

    # How far are we from the ideal tidal window?
    if low <= tide_pct <= high:
        # In the sweet spot
        tide_position_score = 1.0
    else:
        # Penalty increases with distance from ideal window
        if tide_pct < low:
            dist = low - tide_pct
        else:
            dist = tide_pct - high
        tide_position_score = max(0.0, 1.0 - (dist / 50.0))

    # Water depth at break point = static depth + tide height above MSL
    # Typical MSL at Leixões ≈ 2.08m above chart datum
    effective_depth = depth_at_break + (tide_height - 2.08)

    # Depth ratio: how deep the water is relative to typical breaking wave
    # Waves break at depth ≈ 1.3× wave height (for reef/rock breaks)
    # Optimal depth at break: not too shallow (closeouts), not too deep (mushy)
    # Sweet spot: effective depth between 1.0m and 3.0m for typical Porto waves
    if effective_depth < 0.5:
        depth_score = 0.1  # too shallow, dangerous
    elif effective_depth < 1.0:
        depth_score = 0.6  # shallow, may close out
    elif effective_depth <= 3.0:
        depth_score = 1.0  # ideal range
    elif effective_depth <= 4.0:
        depth_score = 0.7  # getting deep, mushier
    else:
        depth_score = 0.4  # too deep for most swells

    # Blend: spots with high tide_sensitivity weight the depth score more
    blended = (
        tide_position_score * (1.0 - tide_sensitivity * 0.5)
        + depth_score * (tide_sensitivity * 0.5)
    )

    return max(0.0, min(1.0, blended))
