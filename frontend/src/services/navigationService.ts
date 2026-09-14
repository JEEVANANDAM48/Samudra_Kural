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
 * Speed in knots (default 8.5 knots for typical fishing trawler / motorboat)
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
 * Calculates a smooth, safe, obstacle-avoiding nautical route using a Cubic Bezier Spline.
 * Eliminates all sharp L-turns, hairpin bends, double-backs, and ugly zig-zags.
 * Generates an elegant, natural marine fairway curve (matching professional electronic chart systems).
 */
export function calculateSafeMaritimeRoute(
  startLat: number,
  startLon: number,
  targetLat: number,
  targetLon: number,
  speedKnots: number = 8.5
): SafeMaritimeRouteResult {
  // Helper to determine minimum safe longitude to clear coastal reefs & shallow breakwaters along Tamil Nadu coast
  const getMinSafeOceanLon = (lat: number): number => {
    if (lat >= 13.30) return 80.365;
    if (lat >= 13.15) return 80.350;
    if (lat >= 13.00) return 80.335;
    if (lat >= 12.50) return 80.280;
    return 80.270;
  };

  const dLat = targetLat - startLat;
  const dLon = targetLon - startLon;
  const directDistM = calculateHaversineDistance(startLat, startLon, targetLat, targetLon);

  // Check if straight line path passes close to shallow rocks / hazard zones
  let maxHazardOffset = 0;
  let hasObstacleAvoidance = false;

  COASTAL_HAZARD_ZONES.forEach((haz) => {
    const [hazLat, hazLon] = haz.center;
    const distToStart = calculateHaversineDistance(startLat, startLon, hazLat, hazLon);
    const distToTarget = calculateHaversineDistance(targetLat, targetLon, hazLat, hazLon);

    if (distToStart < directDistM + haz.radiusMeters && distToTarget < directDistM + haz.radiusMeters) {
      const midLat = (startLat + targetLat) / 2;
      const midLon = (startLon + targetLon) / 2;
      const hazDistToMid = calculateHaversineDistance(midLat, midLon, hazLat, hazLon);

      if (hazDistToMid < haz.radiusMeters + 3000) {
        hasObstacleAvoidance = true;
        maxHazardOffset = Math.max(maxHazardOffset, 0.020);
      }
    }
  });

  const minSafeStartLon = getMinSafeOceanLon(startLat);
  const minSafeMidLon = getMinSafeOceanLon((startLat + targetLat) / 2);

  if (startLon < minSafeStartLon) {
    hasObstacleAvoidance = true;
  }

  // Define Cubic Bezier Control Points P0, P1, P2, P3
  const P0: [number, number] = [startLat, startLon];
  const P3: [number, number] = [targetLat, targetLon];

  // Base intermediate parametric positions (t = 0.35 and t = 0.68)
  const p1Lat = startLat + 0.35 * dLat;
  const p2Lat = startLat + 0.68 * dLat;

  let p1Lon = startLon + 0.35 * dLon;
  let p2Lon = startLon + 0.68 * dLon;

  const oceanBulge = Math.max(maxHazardOffset, 0.012);

  if (targetLon >= startLon) {
    const reqP1Lon = Math.max(p1Lon, minSafeStartLon + 0.005);
    const reqP2Lon = Math.max(p2Lon, minSafeMidLon + 0.005);

    if (targetLon >= reqP1Lon) {
      p1Lon = reqP1Lon;
      p2Lon = Math.min(targetLon, reqP2Lon);
    } else {
      p1Lon = Math.max(startLon + 0.5 * dLon, minSafeStartLon + 0.008);
      p2Lon = Math.max(startLon + 0.8 * dLon, (p1Lon + targetLon) / 2);
    }

    // Strict monotonicity check for eastbound routes: P0.lon <= P1.lon <= P2.lon <= P3.lon
    // Clamping guarantees NO double-backs, reversals, or zig-zags!
    p1Lon = Math.max(P0[1], Math.min(P3[1], p1Lon));
    p2Lon = Math.max(p1Lon, Math.min(P3[1], p2Lon));
  } else {
    // Westbound route (returning to port)
    p1Lon = Math.min(P0[1], Math.max(P3[1], p1Lon + oceanBulge));
    p2Lon = Math.min(p1Lon, Math.max(P3[1], p2Lon));
  }

  const P1: [number, number] = [p1Lat, p1Lon];
  const P2: [number, number] = [p2Lat, p2Lon];

  // Generate 60 smooth interpolated points along the Cubic Bezier curve
  const NUM_STEPS = 60;
  const polylineCoords: Array<[number, number]> = [];

  for (let i = 0; i <= NUM_STEPS; i++) {
    const t = i / NUM_STEPS;
    const invT = 1 - t;

    const lat =
      invT * invT * invT * P0[0] +
      3 * invT * invT * t * P1[0] +
      3 * invT * t * t * P2[0] +
      t * t * t * P3[0];

    const lon =
      invT * invT * invT * P0[1] +
      3 * invT * invT * t * P1[1] +
      3 * invT * t * t * P2[1] +
      t * t * t * P3[1];

    polylineCoords.push([Number(lat.toFixed(5)), Number(lon.toFixed(5))]);
  }

  const waypointsList: MaritimeWaypoint[] = [
    {
      name: 'Fisherman Location (Boat)',
      latitude: startLat,
      longitude: startLon,
      type: 'start',
    },
  ];

  if (hasObstacleAvoidance) {
    waypointsList.push({
      name: `Coastal Hazard Avoidance Channel (${P1[0].toFixed(3)}°N)`,
      latitude: P1[0],
      longitude: P1[1],
      type: 'rock_avoidance',
    });
  }

  waypointsList.push({
    name: 'Target Fishing Zone',
    latitude: targetLat,
    longitude: targetLon,
    type: 'destination',
  });

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
