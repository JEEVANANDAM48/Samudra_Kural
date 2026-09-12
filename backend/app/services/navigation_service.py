import math
from typing import Tuple

EARTH_RADIUS_METERS = 6371000.0  # Mean radius of Earth in meters

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate great-circle distance between two (lat, lon) points on Earth in meters.
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_METERS * c

def calculate_initial_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate initial geographic bearing from (lat1, lon1) to (lat2, lon2) in degrees.
    Result is normalized to [0, 360). 0° = North, 90° = East, 180° = South, 270° = West.
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)

    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)

    initial_bearing_rad = math.atan2(y, x)
    initial_bearing_deg = (math.degrees(initial_bearing_rad) + 360.0) % 360.0
    return round(initial_bearing_deg, 2)

def bearing_to_cardinal(bearing_degrees: float) -> str:
    """
    Convert geographic bearing in degrees to 8-direction cardinal string.
    Directions: N, NE, E, SE, S, SW, W, NW.
    """
    normalized = (bearing_degrees % 360.0 + 360.0) % 360.0
    if 337.5 <= normalized or normalized < 22.5:
        return "N"
    elif 22.5 <= normalized < 67.5:
        return "NE"
    elif 67.5 <= normalized < 112.5:
        return "E"
    elif 112.5 <= normalized < 157.5:
        return "SE"
    elif 157.5 <= normalized < 202.5:
        return "S"
    elif 202.5 <= normalized < 247.5:
        return "SW"
    elif 247.5 <= normalized < 292.5:
        return "W"
    else:
        return "NW"

def calculate_navigation(lat1: float, lon1: float, lat2: float, lon2: float) -> Tuple[float, float, str]:
    """
    Helper function returning (distance_meters, bearing_degrees, direction).
    """
    dist_m = calculate_haversine_distance(lat1, lon1, lat2, lon2)
    bearing_deg = calculate_initial_bearing(lat1, lon1, lat2, lon2)
    direction = bearing_to_cardinal(bearing_deg)
    return round(dist_m, 2), bearing_deg, direction
