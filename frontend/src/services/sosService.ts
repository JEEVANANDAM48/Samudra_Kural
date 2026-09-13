import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOSPacket, EmergencyType, LocationResult, MockSendResult } from '../types/sos';
import { communicationManager } from './communicationManager';
import { FishermanUser } from '../types';
import { getNearestRescueStation } from '../data/mockRescueStations';

const PENDING_SOS_KEY = '@samudra_kural_pending_sos';
const ACTIVE_SOS_KEY = '@samudra_kural_active_sos';

/**
 * Generates unique SOS ID e.g. SOS-20260913-001
 */
export function generateSOSId(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(100 + Math.random() * 900);
  return `SOS-${dateStr}-${randomNum}`;
}

/**
 * Builds a standardized emergency packet.
 */
export function buildEmergencyPacket(
  location: LocationResult,
  emergencyType: EmergencyType = 'General Emergency',
  user?: FishermanUser | null,
  batteryLevel: number = 88
): SOSPacket {
  const id = generateSOSId();
  const rescueInfo = getNearestRescueStation(location.latitude, location.longitude);

  return {
    id,
    boatId: user?.id || 'BOAT-TN-02-1842',
    userId: user?.phone || 'USER-UNAUTH',
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    timestamp: new Date().toISOString(),
    emergencyType,
    batteryLevel,
    communicationStatus: communicationManager.getStatus(),
    status: 'pending',
    rescueStationRouted: rescueInfo.station.name,
  };
}

// --- Local Storage Management (AsyncStorage) ---

export async function savePendingSOS(packet: SOSPacket): Promise<void> {
  try {
    const updatedPacket: SOSPacket = { ...packet, status: 'pending' };
    await AsyncStorage.setItem(PENDING_SOS_KEY, JSON.stringify(updatedPacket));
  } catch (err) {
    console.error('Error saving pending SOS:', err);
  }
}

export async function getPendingSOS(): Promise<SOSPacket | null> {
  try {
    const json = await AsyncStorage.getItem(PENDING_SOS_KEY);
    return json ? JSON.parse(json) : null;
  } catch (err) {
    console.error('Error reading pending SOS:', err);
    return null;
  }
}

export async function removePendingSOS(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_SOS_KEY);
  } catch (err) {
    console.error('Error removing pending SOS:', err);
  }
}

export async function saveActiveSOS(packet: SOSPacket): Promise<void> {
  try {
    const activePacket: SOSPacket = { ...packet, status: 'active' };
    await AsyncStorage.setItem(ACTIVE_SOS_KEY, JSON.stringify(activePacket));
  } catch (err) {
    console.error('Error saving active SOS:', err);
  }
}

export async function getActiveSOS(): Promise<SOSPacket | null> {
  try {
    const json = await AsyncStorage.getItem(ACTIVE_SOS_KEY);
    return json ? JSON.parse(json) : null;
  } catch (err) {
    console.error('Error reading active SOS:', err);
    return null;
  }
}

export async function clearActiveSOS(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ACTIVE_SOS_KEY);
  } catch (err) {
    console.error('Error clearing active SOS:', err);
  }
}

// --- SOS Dispatch Operations ---

export async function sendSOS(packet: SOSPacket): Promise<MockSendResult> {
  const commStatus = communicationManager.getStatus();

  if (commStatus === 'offline') {
    await savePendingSOS(packet);
    throw new Error('OFFLINE_STORED');
  }

  try {
    const result = await communicationManager.sendPacket(packet);
    const activePacket: SOSPacket = { ...packet, status: 'active' };
    await saveActiveSOS(activePacket);
    await removePendingSOS();
    return result;
  } catch (error) {
    // Save as pending if communication dispatch failed
    await savePendingSOS(packet);
    throw error;
  }
}

/**
 * Called when connection is restored to automatically attempt retry of pending SOS packets.
 */
export async function retryPendingSOS(): Promise<SOSPacket | null> {
  const pending = await getPendingSOS();
  if (!pending) return null;

  const commStatus = communicationManager.getStatus();
  if (commStatus === 'offline') return null;

  try {
    await communicationManager.sendPacket(pending);
    const activePacket: SOSPacket = { ...pending, status: 'active' };
    await saveActiveSOS(activePacket);
    await removePendingSOS();
    return activePacket;
  } catch (e) {
    console.error('Retry pending SOS failed:', e);
    return null;
  }
}

/**
 * Updates location for an active SOS session.
 */
export async function updateSOSLocation(
  sosId: string,
  newLocation: LocationResult
): Promise<SOSPacket | null> {
  const activeSOS = await getActiveSOS();
  if (!activeSOS || activeSOS.id !== sosId) return null;

  const updatedPacket: SOSPacket = {
    ...activeSOS,
    latitude: newLocation.latitude ?? activeSOS.latitude,
    longitude: newLocation.longitude ?? activeSOS.longitude,
    accuracy: newLocation.accuracy ?? activeSOS.accuracy,
    timestamp: new Date().toISOString(),
  };

  const commStatus = communicationManager.getStatus();
  if (commStatus === 'online') {
    try {
      await communicationManager.sendLocationUpdate(sosId, newLocation);
    } catch (e) {
      console.warn('Location update online dispatch error:', e);
    }
  }

  await saveActiveSOS(updatedPacket);
  return updatedPacket;
}

/**
 * Cancels an active SOS alert.
 */
export async function cancelSOS(sosId: string): Promise<boolean> {
  try {
    await communicationManager.sendCancellation(sosId);
  } catch (e) {
    console.warn('Cancellation dispatch warning:', e);
  }

  await clearActiveSOS();
  await removePendingSOS();
  return true;
}
