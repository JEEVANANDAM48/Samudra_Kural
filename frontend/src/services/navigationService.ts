export interface NavigationPoint {
  latitude: number;
  longitude: number;
}

export interface NavigationTarget {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  sst_celsius?: number;
  chlorophyll_mg_m3?: number;
  depth_meters?: number;
  target_species?: string[];
  reliability_score?: string;
  is_shore?: boolean;
}

export interface CalculatedNavigationData {
  distance_meters: number;
  distance_km: number;
  distance_nautical_miles: number;
  bearing_degrees: number;
  direction_cardinal: string;
  eta_minutes: number;
  formatted_eta: string;
}

const EARTH_RADIUS_METERS = 6371000.0;

/**
 * Calculate Great-Circle Distance in meters using Haversine formula.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculate Initial Geographic Bearing from (lat1, lon1) to (lat2, lon2) in degrees [0, 360).
 */
export function calculateInitialBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const initialBearingRad = Math.atan2(y, x);
  const initialBearingDeg = ((initialBearingRad * 180) / Math.PI + 360) % 360;
  return Number(initialBearingDeg.toFixed(1));
}

/**
 * Convert bearing in degrees to 8-point cardinal direction string.
 */
export function bearingToCardinal(bearingDegrees: number): string {
  const normalized = ((bearingDegrees % 360) + 360) % 360;
  if (337.5 <= normalized || normalized < 22.5) return 'N';
  if (22.5 <= normalized && normalized < 67.5) return 'NE';
  if (67.5 <= normalized && normalized < 112.5) return 'E';
  if (112.5 <= normalized && normalized < 157.5) return 'SE';
  if (157.5 <= normalized && normalized < 202.5) return 'S';
  if (202.5 <= normalized && normalized < 247.5) return 'SW';
  if (247.5 <= normalized && normalized < 292.5) return 'W';
  return 'NW';
}

/**
 * Full Navigation Calculation Helper
 * Speed in knots (default 8 knots for typical fishing trawler / motorboat)
 */
export function getNavigationDetails(
  userLat: number,
  userLon: number,
  targetLat: number,
  targetLon: number,
  speedKnots: number = 8.5
): CalculatedNavigationData {
  const distM = calculateHaversineDistance(userLat, userLon, targetLat, targetLon);
  const distKm = distM / 1000.0;
  const distNM = distM / 1852.0;

  const bearing = calculateInitialBearing(userLat, userLon, targetLat, targetLon);
  const cardinal = bearingToCardinal(bearing);

  // Speed in NM/hr = knots
  const timeHours = distNM / Math.max(1, speedKnots);
  const etaMinutes = Math.round(timeHours * 60);

  let formattedEta = `${etaMinutes} mins`;
  if (etaMinutes >= 60) {
    const hrs = Math.floor(etaMinutes / 60);
    const mins = etaMinutes % 60;
    formattedEta = `${hrs}h ${mins}m`;
  }

  return {
    distance_meters: Math.round(distM),
    distance_km: Number(distKm.toFixed(2)),
    distance_nautical_miles: Number(distNM.toFixed(2)),
    bearing_degrees: bearing,
    direction_cardinal: cardinal,
    eta_minutes: etaMinutes,
    formatted_eta: formattedEta,
  };
}
