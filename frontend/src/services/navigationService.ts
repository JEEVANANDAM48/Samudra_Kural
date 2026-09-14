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

export interface MaritimeWaypoint {
  name: string;
  latitude: number;
  longitude: number;
  type: 'start' | 'harbor_exit' | 'rock_avoidance' | 'destination';
}

export interface SafeMaritimeRouteResult {
  waypoints: Array<[number, number]>;
  detailedWaypoints: MaritimeWaypoint[];
  totalDistanceMeters: number;
  totalDistanceKm: number;
  totalDistanceNM: number;
  etaMinutes: number;
  formattedEta: string;
  bearingDegrees: number;
  directionCardinal: string;
  hasObstacleAvoidance: boolean;
}

/**
 * Calculates a safe, obstacle-avoiding maritime route between fisherman location and target zone.
 * Avoids landmass, headlands, shallow coastal breakwaters, and rocky shoals.
 */
export function calculateSafeMaritimeRoute(
  startLat: number,
  startLon: number,
  targetLat: number,
  targetLon: number,
  speedKnots: number = 8.5
): SafeMaritimeRouteResult {
  // Helper for safe ocean longitude at a given latitude along Tamil Nadu / Coromandel coast
  const getSafeOceanLon = (lat: number): number => {
    if (lat >= 13.30) return 80.380; // Pulicat Reefs & Barrier Islands Bypass
    if (lat >= 13.15) return 80.365; // Ennore Port & Breakwater Bypass
    if (lat >= 13.00) return 80.345; // Kasimedu & Chennai Port Fairway Corridor
    if (lat >= 12.50) return 80.290; // Covelong & Mahabalipuram Reef Bypass
    return Math.max(80.280, startLon);
  };

  const waypointsList: MaritimeWaypoint[] = [];
  let hasObstacleAvoidance = false;

  // Add Start Point
  waypointsList.push({
    name: 'Fisherman Location (Boat)',
    latitude: startLat,
    longitude: startLon,
    type: 'start',
  });

  // Check 1: If start position is inside harbor or nearshore (west of safe ocean longitude)
  const startSafeLon = getSafeOceanLon(startLat);
  if (startLon < startSafeLon) {
    hasObstacleAvoidance = true;
    waypointsList.push({
      name: 'Kasimedu Fairway Channel Exit',
      latitude: startLat + 0.003,
      longitude: startSafeLon,
      type: 'harbor_exit',
    });
  }

  // Check 2: Sample intermediate latitudes between start and target to detect coastline / rock clipping
  const lastWp = waypointsList[waypointsList.length - 1];
  const latDiff = targetLat - lastWp.latitude;
  const steps = 4;

  if (Math.abs(latDiff) > 0.02) {
    for (let i = 1; i < steps; i++) {
      const sampleLat = lastWp.latitude + (latDiff * (i / steps));
      const straightLon = lastWp.longitude + ((targetLon - lastWp.longitude) * (i / steps));
      const requiredSafeLon = getSafeOceanLon(sampleLat);

      // If straight route clips land/rocks or gets too close to shore:
      if (straightLon < requiredSafeLon + 0.005) {
        hasObstacleAvoidance = true;
        const bypassLon = Math.max(requiredSafeLon + 0.010, targetLon);
        waypointsList.push({
          name: `Coastal Rock & Shoal Bypass (${sampleLat.toFixed(3)}°N)`,
          latitude: sampleLat,
          longitude: bypassLon,
          type: 'rock_avoidance',
        });
        break;
      }
    }
  }

  // Add Final Target Point
  waypointsList.push({
    name: 'Target Fishing Zone',
    latitude: targetLat,
    longitude: targetLon,
    type: 'destination',
  });

  // Interpolate smooth dense points along waypoints for realistic nautical curve rendering
  const polylineCoords: Array<[number, number]> = [];
  for (let i = 0; i < waypointsList.length - 1; i++) {
    const p1 = waypointsList[i];
    const p2 = waypointsList[i + 1];

    const subSteps = 6;
    for (let s = 0; s < subSteps; s++) {
      const ratio = s / subSteps;
      const interpLat = p1.latitude + (p2.latitude - p1.latitude) * ratio;
      const interpLon = p1.longitude + (p2.longitude - p1.longitude) * ratio;
      polylineCoords.push([Number(interpLat.toFixed(5)), Number(interpLon.toFixed(5))]);
    }
  }
  polylineCoords.push([Number(targetLat.toFixed(5)), Number(targetLon.toFixed(5))]);

  // Calculate total distance along the safe polyline path
  let totalMeters = 0;
  for (let i = 0; i < polylineCoords.length - 1; i++) {
    totalMeters += calculateHaversineDistance(
      polylineCoords[i][0],
      polylineCoords[i][1],
      polylineCoords[i + 1][0],
      polylineCoords[i + 1][1]
    );
  }

  const totalKm = totalMeters / 1000.0;
  const totalNM = totalMeters / 1852.0;

  const bearing = calculateInitialBearing(startLat, startLon, targetLat, targetLon);
  const cardinal = bearingToCardinal(bearing);

  const timeHours = totalNM / Math.max(1, speedKnots);
  const etaMinutes = Math.round(timeHours * 60);
  let formattedEta = `${etaMinutes} mins`;
  if (etaMinutes >= 60) {
    const hrs = Math.floor(etaMinutes / 60);
    const mins = etaMinutes % 60;
    formattedEta = `${hrs}h ${mins}m`;
  }

  return {
    waypoints: polylineCoords,
    detailedWaypoints: waypointsList,
    totalDistanceMeters: Math.round(totalMeters),
    totalDistanceKm: Number(totalKm.toFixed(2)),
    totalDistanceNM: Number(totalNM.toFixed(2)),
    etaMinutes,
    formattedEta,
    bearingDegrees: bearing,
    directionCardinal: cardinal,
    hasObstacleAvoidance,
  };
}
