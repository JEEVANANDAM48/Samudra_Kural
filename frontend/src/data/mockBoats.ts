export interface RegisteredBoat {
  id: string;
  name: string;
  captainName: string;
  latitude: number;
  longitude: number;
  status: 'active' | 'anchored' | 'returning';
  distanceKm?: number;
}

export const MOCK_REGISTERED_BOATS: RegisteredBoat[] = [
  {
    id: 'IND-TN-02-1842',
    name: 'Kadal Magal 3',
    captainName: 'Murugan',
    latitude: 13.0855,
    longitude: 80.278,
    status: 'active',
  },
  {
    id: 'IND-TN-02-0921',
    name: 'Samudra Deepam',
    captainName: 'Selvam',
    latitude: 13.078,
    longitude: 80.265,
    status: 'active',
  },
  {
    id: 'IND-TN-02-3310',
    name: 'Ocean Express',
    captainName: 'Kumar',
    latitude: 13.092,
    longitude: 80.285,
    status: 'anchored',
  },
  {
    id: 'IND-TN-02-4099',
    name: 'Alai Arasi',
    captainName: 'Velu',
    latitude: 13.065,
    longitude: 80.252,
    status: 'returning',
  },
];

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function findNearbyRegisteredBoats(
  latitude: number | null,
  longitude: number | null,
  maxRadiusKm: number = 25
): RegisteredBoat[] {
  if (latitude === null || longitude === null) {
    return [];
  }

  return MOCK_REGISTERED_BOATS.map((boat) => {
    const dist = calculateDistanceKm(latitude, longitude, boat.latitude, boat.longitude);
    return { ...boat, distanceKm: dist };
  })
    .filter((boat) => (boat.distanceKm ?? Infinity) <= maxRadiusKm)
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}
