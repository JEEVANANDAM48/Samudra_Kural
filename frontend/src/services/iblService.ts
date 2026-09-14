export interface IBLPoint {
  latitude: number;
  longitude: number;
  name?: string;
}

export type IBLStatus = 'SAFE' | 'WARNING' | 'CRITICAL' | 'CROSSED';

export interface IBLProximityResult {
  distanceNm: number;
  distanceKm: number;
  status: IBLStatus;
  nearestBoundaryPoint: IBLPoint;
  bearingDegrees: number;
  warningMessage: string;
}

// Official India - Sri Lanka International Maritime Boundary Line (IBL) Coordinates
// Spanning from Bay of Bengal north of Point Calimere down through Palk Strait & Gulf of Mannar
export const INDIA_SRI_LANKA_IBL_POINTS: IBLPoint[] = [
  { latitude: 11.2667, longitude: 80.2000, name: 'IBL Point 1 (Bay of Bengal)' },
  { latitude: 10.8333, longitude: 79.9167, name: 'IBL Point 2 (Point Calimere Outer)' },
  { latitude: 10.3833, longitude: 79.8667, name: 'IBL Point 3 (Palk Strait North)' },
  { latitude: 10.0833, longitude: 79.5000, name: 'IBL Point 4 (Palk Strait Center)' },
  { latitude: 9.6667, longitude: 79.5333, name: 'IBL Point 5 (Kachchatheevu North)' },
  { latitude: 9.3833, longitude: 79.5333, name: 'IBL Point 6 (Rameswaram Channel)' },
  { latitude: 9.1000, longitude: 79.5333, name: 'IBL Point 7 (Adam\'s Bridge)' },
  { latitude: 8.8000, longitude: 79.1167, name: 'IBL Point 8 (Gulf of Mannar)' },
  { latitude: 8.3667, longitude: 78.6333, name: 'IBL Point 9 (South Gulf of Mannar)' },
];

/**
 * Calculates Great-Circle Haversine Distance between two points in Kilometers.
 */
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates initial bearing in degrees from point 1 to point 2.
 */
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

/**
 * Calculates the perpendicular distance from a vessel coordinate to a segment between two IBL points.
 */
function minDistanceToSegmentKm(
  vLat: number,
  vLon: number,
  p1: IBLPoint,
  p2: IBLPoint
): { distKm: number; nearestLat: number; nearestLon: number } {
  const l2 = haversineDistanceKm(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
  if (l2 === 0) {
    return {
      distKm: haversineDistanceKm(vLat, vLon, p1.latitude, p1.longitude),
      nearestLat: p1.latitude,
      nearestLon: p1.longitude,
    };
  }

  // Linear projection parameter t
  let t =
    ((vLat - p1.latitude) * (p2.latitude - p1.latitude) +
      (vLon - p1.longitude) * (p2.longitude - p1.longitude)) /
    (Math.pow(p2.latitude - p1.latitude, 2) + Math.pow(p2.longitude - p1.longitude, 2));

  t = Math.max(0, Math.min(1, t));

  const projLat = p1.latitude + t * (p2.latitude - p1.latitude);
  const projLon = p1.longitude + t * (p2.longitude - p1.longitude);

  return {
    distKm: haversineDistanceKm(vLat, vLon, projLat, projLon),
    nearestLat: projLat,
    nearestLon: projLon,
  };
}

/**
 * Checks vessel position against the IBL and returns live proximity telemetry.
 */
export function checkIBLProximity(vesselLat: number, vesselLon: number): IBLProximityResult {
  let minKm = Infinity;
  let nearestPt: IBLPoint = INDIA_SRI_LANKA_IBL_POINTS[0];

  for (let i = 0; i < INDIA_SRI_LANKA_IBL_POINTS.length - 1; i++) {
    const p1 = INDIA_SRI_LANKA_IBL_POINTS[i];
    const p2 = INDIA_SRI_LANKA_IBL_POINTS[i + 1];
    const res = minDistanceToSegmentKm(vesselLat, vesselLon, p1, p2);
    if (res.distKm < minKm) {
      minKm = res.distKm;
      nearestPt = { latitude: res.nearestLat, longitude: res.nearestLon, name: `Segment ${i + 1}` };
    }
  }

  const distanceNm = parseFloat((minKm / 1.852).toFixed(2));
  const distanceKm = parseFloat(minKm.toFixed(2));
  const bearingDegrees = Math.round(calculateBearing(vesselLat, vesselLon, nearestPt.latitude, nearestPt.longitude));

  // Determine if vessel has crossed eastward into international/foreign waters (approx longitude comparison)
  const isEastOfIBL = vesselLon > nearestPt.longitude;

  let status: IBLStatus = 'SAFE';
  let warningMessage = 'Safe Indian Territorial Waters. Normal Voyage Operations.';

  if (isEastOfIBL || distanceNm < 0.3) {
    status = 'CROSSED';
    warningMessage = 'CRITICAL: Beyond International Boundary! Turn back immediately!';
  } else if (distanceNm <= 2.0) {
    status = 'CRITICAL';
    warningMessage = `CRITICAL WARNING: Imminent International Boundary! (${distanceNm} NM away)`;
  } else if (distanceNm <= 5.0) {
    status = 'WARNING';
    warningMessage = `CAUTION: Approaching International Boundary Line (${distanceNm} NM away)`;
  }

  return {
    distanceNm,
    distanceKm,
    status,
    nearestBoundaryPoint: nearestPt,
    bearingDegrees,
    warningMessage,
  };
}
