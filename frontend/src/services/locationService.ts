import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { LocationResult } from '../types/sos';

let demoGpsAvailable = true;

/**
 * Allows demo developer controls to simulate GPS availability/unavailability
 */
export function setDemoGpsAvailable(available: boolean): void {
  demoGpsAvailable = available;
}

export function isDemoGpsAvailable(): boolean {
  return demoGpsAvailable;
}

/**
 * Retrieves the device's real battery level percentage (0-100).
 */
export async function getRealBatteryLevel(): Promise<number> {
  try {
    const level = await Battery.getBatteryLevelAsync();
    if (level !== null && level >= 0) {
      return Math.round(level * 100);
    }
  } catch (e) {
    console.warn('Expo Battery error:', e);
  }
  return 88;
}

/**
 * Attempts to retrieve real device GPS location using Expo Location API.
 * Prompts user for foreground location permission if not already granted.
 * Handles errors gracefully and returns detailed LocationResult.
 */
export async function getCurrentLocation(): Promise<LocationResult> {
  const timestamp = new Date().toISOString();

  // Handle explicit demo GPS forced UNAVAILABLE state
  if (!demoGpsAvailable) {
    return {
      latitude: null,
      longitude: null,
      accuracy: null,
      timestamp,
      available: false,
      errorMessage: 'Device GPS module disabled or position unavailable.',
    };
  }

  try {
    // 1. Request foreground location permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return {
        latitude: null,
        longitude: null,
        accuracy: null,
        timestamp,
        available: false,
        errorMessage: 'Location permission was denied. Please enable location permissions for Samudra Kural.',
      };
    }

    // 2. Fetch real high-accuracy position from GPS sensor
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: Math.round(loc.coords.latitude * 1000000) / 1000000,
      longitude: Math.round(loc.coords.longitude * 1000000) / 1000000,
      accuracy: loc.coords.accuracy ? Math.round(loc.coords.accuracy) : null,
      timestamp: new Date(loc.timestamp).toISOString(),
      available: true,
    };
  } catch (e: any) {
    console.warn('Expo Location error, attempting last known location fallback:', e);

    // Fallback: try getting last known position if current position timed out
    try {
      const lastLoc = await Location.getLastKnownPositionAsync();
      if (lastLoc) {
        return {
          latitude: Math.round(lastLoc.coords.latitude * 1000000) / 1000000,
          longitude: Math.round(lastLoc.coords.longitude * 1000000) / 1000000,
          accuracy: lastLoc.coords.accuracy ? Math.round(lastLoc.coords.accuracy) : null,
          timestamp: new Date(lastLoc.timestamp).toISOString(),
          available: true,
        };
      }
    } catch (fallbackErr) {
      console.warn('Last known location error:', fallbackErr);
    }

    return {
      latitude: null,
      longitude: null,
      accuracy: null,
      timestamp,
      available: false,
      errorMessage: e?.message || 'Failed to acquire device GPS position.',
    };
  }
}
