export interface FishermanGPS {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

/**
 * Get current fisherman device GPS location.
 * Falls back to active fishing harbor/boat coordinate if native GPS permission is pending.
 */
export async function getCurrentFishermanGPS(): Promise<FishermanGPS> {
  return new Promise((resolve) => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy || 5.0,
            timestamp: pos.timestamp || Date.now(),
          });
        },
        () => {
          // Default coastal boat location near Chennai / Marina Coast
          resolve({
            latitude: 13.0620,
            longitude: 80.3210,
            accuracy: 8.0,
            timestamp: Date.now(),
          });
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      resolve({
        latitude: 13.0620,
        longitude: 80.3210,
        accuracy: 8.0,
        timestamp: Date.now(),
      });
    }
  });
}
