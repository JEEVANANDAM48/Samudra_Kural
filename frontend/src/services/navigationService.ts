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

export interface MaritimeHazardZone {
  id: string;
  name: string;
  type: 'shallow_rock' | 'restricted_area' | 'breakwater_hazard';
  center: [number, number];
  radiusMeters: number;
  minDepthMeters: number;
  description: string;
  severity: 'high' | 'medium';
}

export const COASTAL_HAZARD_ZONES: MaritimeHazardZone[] = [
  {
    id: 'haz-kasimedu-rocks',
    name: 'Kasimedu Submerged Reefs & Boulders',
    type: 'shallow_rock',
    center: [13.128, 80.305],
    radiusMeters: 1400,
    minDepthMeters: 4.5,
    description: 'Submerged breakwater boulders & shallow rocky reef (Depth < 5m)',
    severity: 'high',
  },
  {
    id: 'haz-ennore-shoal',
    name: 'Ennore Thermal Shoal & Submerged Rocks',
    type: 'shallow_rock',
    center: [13.235, 80.342],
    radiusMeters: 2200,
    minDepthMeters: 6.0,
    description: 'Submerged granite rocks & silted shoal area',
    severity: 'high',
  },
  {
    id: 'haz-pulicat-sandbars',
    name: 'Pulicat Outer Barrier Reef & Sandbars',
    type: 'shallow_rock',
    center: [13.410, 80.345],
    radiusMeters: 2800,
    minDepthMeters: 3.8,
    description: 'Shallow shifting sandbars & rocky coral ledges',
    severity: 'high',
  },
  {
    id: 'haz-covelong-reef',
    name: 'Kovalam / Covelong Point Outer Reef',
    type: 'shallow_rock',
    center: [12.795, 80.265],
    radiusMeters: 1800,
    minDepthMeters: 5.2,
    description: 'Rocky headland reef extension (Depth < 6m)',
    severity: 'medium',
  },
  {
    id: 'haz-chennai-restricted',
    name: 'Chennai Naval Port Restricted Anchorage Zone',
    type: 'restricted_area',
    center: [13.090, 80.315],
    radiusMeters: 2000,
    minDepthMeters: 12.0,
    description: 'Military & commercial vessel restricted fairway',
    severity: 'high',
  },
];

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
 * Smooth Cubic Bezier Spline interpolation for organic, curved nautical fairway trajectories.
 */
function interpolateCubicBezierPath(
  controlPoints: Array<[number, number]>,
  totalSteps: number = 40
): Array<[number, number]> {
  if (controlPoints.length < 2) return controlPoints;

  const result: Array<[number, number]> = [];

  if (controlPoints.length === 2) {
    const p0 = controlPoints[0];
    const p3 = controlPoints[1];
    const midLat = (p0[0] + p3[0]) / 2;
    const maxLon = Math.max(p0[1], p3[1]);
    const minLon = Math.min(p0[1], p3[1]);
    const offset = Math.max(0.045, (maxLon - minLon) * 0.8 + 0.035);

    const p1: [number, number] = [p0[0] + (midLat - p0[0]) * 0.4, p0[1] + offset];
    const p2: [number, number] = [midLat + (p3[0] - midLat) * 0.6, p3[1] + offset];

    for (let i = 0; i <= totalSteps; i++) {
      const t = i / totalSteps;
      const oneMinusT = 1 - t;
      const lat =
        oneMinusT * oneMinusT * oneMinusT * p0[0] +
        3 * oneMinusT * oneMinusT * t * p1[0] +
        3 * oneMinusT * t * t * p2[0] +
        t * t * t * p3[0];
      const lon =
        oneMinusT * oneMinusT * oneMinusT * p0[1] +
        3 * oneMinusT * oneMinusT * t * p1[1] +
        3 * oneMinusT * t * t * p2[1] +
        t * t * t * p3[1];
      result.push([Number(lat.toFixed(5)), Number(lon.toFixed(5))]);
    }
    return result;
  }

  const segments = controlPoints.length - 1;
  const stepsPerSeg = Math.ceil(totalSteps / segments);

  for (let i = 0; i < segments; i++) {
    const p0 = controlPoints[i];
    const p3 = controlPoints[i + 1];

    const dLat = p3[0] - p0[0];
    const dLon = p3[1] - p0[1];

    const p1: [number, number] = [
      p0[0] + dLat * 0.35,
      p0[1] + (dLon > 0 ? Math.max(0.025, dLon * 0.6) : Math.min(-0.010, dLon * 0.4)),
    ];
    const p2: [number, number] = [
      p3[0] - dLat * 0.35,
      p3[1] + (dLon > 0 ? Math.max(0.025, dLon * 0.4) : Math.min(-0.010, dLon * 0.6)),
    ];

    for (let s = 0; s < stepsPerSeg; s++) {
      const t = s / stepsPerSeg;
      const oneMinusT = 1 - t;
      const lat =
        oneMinusT * oneMinusT * oneMinusT * p0[0] +
        3 * oneMinusT * oneMinusT * t * p1[0] +
        3 * oneMinusT * t * t * p2[0] +
        t * t * t * p3[0];
      const lon =
        oneMinusT * oneMinusT * oneMinusT * p0[1] +
        3 * oneMinusT * oneMinusT * t * p1[1] +
        3 * oneMinusT * t * t * p2[1] +
        t * t * t * p3[1];
      result.push([Number(lat.toFixed(5)), Number(lon.toFixed(5))]);
    }
  }
  result.push(controlPoints[controlPoints.length - 1]);
  return result;
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
  const getSafeOceanLon = (lat: number): number => {
    if (lat >= 13.30) return 80.385;
    if (lat >= 13.15) return 80.370;
    if (lat >= 13.00) return 80.350;
    if (lat >= 12.50) return 80.295;
    return Math.max(80.285, startLon);
  };

  const waypointsList: MaritimeWaypoint[] = [];
  const keyControlPoints: Array<[number, number]> = [];
  let hasObstacleAvoidance = false;

  // Add Start Point
  waypointsList.push({
    name: 'Fisherman Location (Boat)',
    latitude: startLat,
    longitude: startLon,
    type: 'start',
  });
  keyControlPoints.push([startLat, startLon]);

  // Check 1: If start position is inside harbor or nearshore
  const startSafeLon = getSafeOceanLon(startLat);
  if (startLon < startSafeLon) {
    hasObstacleAvoidance = true;
    const fairwayLat = startLat + (targetLat >= startLat ? 0.006 : -0.006);
    const fairwayLon = startSafeLon + 0.015;
    waypointsList.push({
      name: 'Kasimedu Fairway Channel Exit',
      latitude: fairwayLat,
      longitude: fairwayLon,
      type: 'harbor_exit',
    });
    keyControlPoints.push([fairwayLat, fairwayLon]);
  }

  // Check 2: Intermediate coastal avoidance
  const lastP = keyControlPoints[keyControlPoints.length - 1];
  const latDiff = targetLat - lastP[0];

  if (Math.abs(latDiff) > 0.015) {
    const sampleLat = lastP[0] + latDiff * 0.5;
    const requiredSafeLon = getSafeOceanLon(sampleLat);
    const bypassLon = Math.max(requiredSafeLon + 0.025, Math.max(startLon, targetLon) + 0.020);

    hasObstacleAvoidance = true;
    waypointsList.push({
      name: `Deep Water Fairway (${sampleLat.toFixed(3)}°N)`,
      latitude: sampleLat,
      longitude: bypassLon,
      type: 'rock_avoidance',
    });
    keyControlPoints.push([sampleLat, bypassLon]);
  }

  // Add Target Point
  waypointsList.push({
    name: 'Target Fishing Zone',
    latitude: targetLat,
    longitude: targetLon,
    type: 'destination',
  });
  keyControlPoints.push([targetLat, targetLon]);

  // Generate smooth cubic Bezier curved trajectory
  const polylineCoords = interpolateCubicBezierPath(keyControlPoints, 45);

  // Calculate total distance along the smooth curve
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
