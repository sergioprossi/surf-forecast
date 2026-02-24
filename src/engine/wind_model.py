"""Wind scoring model with Nortada (summer N/NNE wind) detection.

Scores wind based on direction relative to the beach (offshore/onshore/cross)
and speed. Detects the Nortada pattern that ruins afternoon sessions in Porto.
"""

from __future__ import annotations

import math


def angle_diff(a: float, b: float) -> float:
    """Smallest angular difference between two bearings (0-180)."""
    d = abs(a - b) % 360
    return d if d <= 180 else 360 - d


def wind_score(
    wind_speed: float | None,
    wind_dir: float | None,
    beach_facing: int,
    offshore_dirs: tuple[int, int],
) -> float:
    """Score wind conditions from 0 (terrible) to 1 (perfect).

    Logic:
    - Offshore wind (blowing from land to sea) = best
    - Light wind = good regardless of direction
    - Strong onshore = bad
    - Cross-shore = intermediate
    """
    if wind_speed is None or wind_dir is None:
        return 0.5  # unknown — neutral

    # Very light wind (<5 km/h) is always fine
    if wind_speed < 5:
        return 1.0

    # Determine if wind is offshore, onshore, or cross
    off_start, off_end = offshore_dirs
    is_offshore = _in_arc(wind_dir, off_start, off_end)

    # Angle between wind direction and beach facing
    # Wind blowing FROM opposite of beach facing = directly onshore
    onshore_dir = beach_facing  # waves come from this direction, wind from opposite is offshore
    angle_from_onshore = angle_diff(wind_dir, onshore_dir)

    # Offshore factor: 1.0 if perfectly offshore, 0.0 if perfectly onshore
    if is_offshore:
        direction_factor = 1.0
    elif angle_from_onshore < 30:
        direction_factor = 0.0  # directly onshore
    elif angle_from_onshore < 60:
        direction_factor = 0.3  # mostly onshore
    elif angle_from_onshore < 90:
        direction_factor = 0.5  # cross-shore
    else:
        direction_factor = 0.7  # cross-off

    # Speed penalty — stronger wind amplifies the direction effect
    # Light onshore is okay, strong onshore is terrible
    if wind_speed < 10:
        speed_factor = 1.0
    elif wind_speed < 20:
        speed_factor = 0.8
    elif wind_speed < 30:
        speed_factor = 0.5
    elif wind_speed < 40:
        speed_factor = 0.3
    else:
        speed_factor = 0.1  # gale force — unsurf-able

    # For offshore wind, strong is actually okay (grooming effect)
    if is_offshore:
        if wind_speed < 25:
            return max(0.7, direction_factor * speed_factor)
        elif wind_speed < 35:
            return 0.6  # too strong offshore can make it hard to paddle
        else:
            return 0.3

    return max(0.0, min(1.0, direction_factor * speed_factor))


def _in_arc(bearing: float, start: float, end: float) -> bool:
    """Check if a bearing falls within a directional arc."""
    bearing = bearing % 360
    start = start % 360
    end = end % 360

    if start <= end:
        return start <= bearing <= end
    else:  # wraps around 360
        return bearing >= start or bearing <= end


def wind_trend_score(
    wind_speeds: list[float | None],
    wind_dirs: list[float | None],
    beach_facing: int,
    offshore_dirs: tuple[int, int],
) -> float:
    """Score wind trend from recent history.

    Detects Nortada onset (worsening N/NNE wind pattern) and improving
    or deteriorating conditions.

    Args:
        wind_speeds: last 6 hours of wind speed (oldest first)
        wind_dirs: last 6 hours of wind direction (oldest first)

    Returns:
        0.0 = rapidly worsening (e.g. Nortada onset)
        0.5 = stable
        1.0 = rapidly improving
    """
    if len(wind_speeds) < 3 or len(wind_dirs) < 3:
        return 0.5  # not enough data

    # Filter Nones
    valid = [
        (s, d) for s, d in zip(wind_speeds, wind_dirs)
        if s is not None and d is not None
    ]
    if len(valid) < 3:
        return 0.5

    speeds = [v[0] for v in valid]
    dirs = [v[1] for v in valid]

    # Check for Nortada pattern: N/NNE wind (340-30°) increasing
    recent_dirs = dirs[-3:]
    is_nortada = all(_in_arc(d, 340, 30) for d in recent_dirs)
    speed_increasing = speeds[-1] > speeds[0] + 5  # >5 km/h increase

    if is_nortada and speed_increasing:
        # Classic Nortada onset — bad news
        return 0.1

    # General trend: compute wind scores for first half vs second half
    mid = len(valid) // 2
    first_scores = [
        wind_score(s, d, beach_facing, offshore_dirs)
        for s, d in valid[:mid]
    ]
    second_scores = [
        wind_score(s, d, beach_facing, offshore_dirs)
        for s, d in valid[mid:]
    ]

    avg_first = sum(first_scores) / len(first_scores) if first_scores else 0.5
    avg_second = sum(second_scores) / len(second_scores) if second_scores else 0.5

    # Map improvement/worsening to 0-1
    delta = avg_second - avg_first  # positive = improving
    return max(0.0, min(1.0, 0.5 + delta))
