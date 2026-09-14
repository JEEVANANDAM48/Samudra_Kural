import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../theme/colors';
import { SupportedLanguage } from '../types';
import {
  SOSStatus,
  EmergencyType,
  CommunicationStatus,
  LocationResult,
  SOSPacket,
} from '../types/sos';
import {
  getCurrentLocation,
  getRealBatteryLevel,
  isDemoGpsAvailable,
  setDemoGpsAvailable,
} from '../services/locationService';
import {
  communicationManager,
  setDemoCommunicationStatus,
} from '../services/communicationManager';
import {
  buildEmergencyPacket,
  sendSOS,
  savePendingSOS,
  getPendingSOS,
  getActiveSOS,
  retryPendingSOS,
  updateSOSLocation,
  cancelSOS,
} from '../services/sosService';
import { getUserSession } from '../storage/storage';
import { getNearestRescueStation } from '../data/mockRescueStations';
import { findNearbyRegisteredBoats } from '../data/mockBoats';
import { coastalGuardService } from '../services/coastalGuardService';

import { SOSButton } from './components/SOSButton';
import { SOSStatusCard } from './components/SOSStatusCard';
import { SOSLocationCard } from './components/SOSLocationCard';
import { SOSEmergencyTypeSelector } from './components/SOSEmergencyTypeSelector';
import { SOSConfirmationModal } from './components/SOSConfirmationModal';

interface SOSScreenProps {
  currentLanguage?: SupportedLanguage;
}

export const SOSScreen: React.FC<SOSScreenProps> = () => {
  const [sosStatus, setSosStatus] = useState<SOSStatus>('idle');
  const [emergencyType, setEmergencyType] = useState<EmergencyType>('General Emergency');
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [communicationStatus, setCommunicationStatus] = useState<CommunicationStatus>('online');
  const [gpsAvailable, setGpsAvailable] = useState<boolean>(true);
  const [batteryLevel, setBatteryLevel] = useState<number>(88);
  const [activeSOSPacket, setActiveSOSPacket] = useState<SOSPacket | null>(null);
  const [pendingSOSPacket, setPendingSOSPacket] = useState<SOSPacket | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isUpdatingLocation, setIsUpdatingLocation] = useState<boolean>(false);

  useEffect(() => {
    initSOSScreen();
  }, []);

  const initSOSScreen = async () => {
    setCommunicationStatus(communicationManager.getStatus());
    setGpsAvailable(isDemoGpsAvailable());

    // Instantly request location permission and fetch real GPS + real battery
    const [realLoc, realBatt] = await Promise.all([
      getCurrentLocation(),
      getRealBatteryLevel(),
    ]);
    setLocation(realLoc);
    setBatteryLevel(realBatt);

    // Check for existing active or pending SOS in persistent storage
    const active = await getActiveSOS();
    if (active) {
      setActiveSOSPacket(active);
      setSosStatus('active');
      return;
    }

    const pending = await getPendingSOS();
    if (pending) {
      setPendingSOSPacket(pending);
      setSosStatus('pending');
      // If initialized and online, attempt automatic background retry
      if (communicationManager.getStatus() === 'online') {
        attemptAutoRetry(pending);
      }
    }
  };

  const attemptAutoRetry = async (pendingPacket: SOSPacket) => {
    setStatusMessage('Connection restored. Transmitting pending SOS alert...');
    setSosStatus('sending');
    const synced = await retryPendingSOS();
    if (synced) {
      setActiveSOSPacket(synced);
      setPendingSOSPacket(null);
      setSosStatus('active');
      setStatusMessage('SOS sent successfully.');
    } else {
      setSosStatus('pending');
      setStatusMessage('Pending SOS waiting for communication link.');
    }
  };

  // Toggle handlers for communication link & GPS
  const handleToggleCommunication = async (newStatus: CommunicationStatus) => {
    setCommunicationStatus(newStatus);
    setDemoCommunicationStatus(newStatus);

    // If switching to ONLINE while PENDING SOS exists, trigger auto sync
    if (newStatus === 'online' && sosStatus === 'pending') {
      const pending = pendingSOSPacket || (await getPendingSOS());
      if (pending) {
        attemptAutoRetry(pending);
      }
    }
  };

  const handleToggleGps = async (available: boolean) => {
    setGpsAvailable(available);
    setDemoGpsAvailable(available);
    if (!available) {
      setLocation({
        latitude: null,
        longitude: null,
        accuracy: null,
        timestamp: new Date().toISOString(),
        available: false,
        errorMessage: 'GPS Signal Lost',
      });
    } else {
      const freshLoc = await getCurrentLocation();
      setLocation(freshLoc);
    }
  };

  // Main Hold-to-Send trigger flow
  const handleSOSTriggered = async () => {
    try {
      setSosStatus('getting_location');
      setStatusMessage('Getting GPS coordinates...');

      // 1. Fetch real position & fresh battery
      const [loc, freshBatt] = await Promise.all([
        getCurrentLocation(),
        getRealBatteryLevel(),
      ]);
      setLocation(loc);
      setBatteryLevel(freshBatt);

      // 2. Fetch User Session & Check Connection
      setSosStatus('checking_connection');
      setStatusMessage('Checking communication link...');
      const commStatus = communicationManager.getStatus();
      const userSession = await getUserSession();

      // 3. Build Packet with exact registered user profile
      const packet = buildEmergencyPacket(loc, emergencyType, userSession, freshBatt);

      // 4. Send or Store Packet
      setSosStatus('sending');
      setStatusMessage(
        commStatus === 'online'
          ? 'Transmitting emergency alert to rescue network...'
          : 'Saving SOS locally...'
      );

      if (commStatus === 'online') {
        const result = await sendSOS(packet);
        const activePacket: SOSPacket = { ...packet, status: 'active', id: result.referenceId };
        setActiveSOSPacket(activePacket);
        setSosStatus('active');
        setStatusMessage('SOS sent successfully.');

        // Dispatch alert to Coastal Guard Command Center with exact fisherman & boat details
        await coastalGuardService.triggerSOS(
          loc.latitude || 13.0827,
          loc.longitude || 80.3800,
          emergencyType,
          `Fisherman SOS (${emergencyType}) triggered by ${userSession?.name || 'Fisherman'}. Battery: ${freshBatt}%.`,
          1,
          userSession
        ).catch((e) => console.log('[SOSScreen] Coastal Guard sync notice:', e));
      } else {
        await savePendingSOS(packet);
        setPendingSOSPacket(packet);
        setSosStatus('pending');
        setStatusMessage('No connection. SOS saved and waiting for communication link.');

        // Store in Coastal Guard shared registry with exact fisherman & boat details
        await coastalGuardService.triggerSOS(
          loc.latitude || 13.0827,
          loc.longitude || 80.3800,
          emergencyType,
          `Offline SOS (${emergencyType}) saved locally by ${userSession?.name || 'Fisherman'}. Battery: ${freshBatt}%.`,
          1,
          userSession
        ).catch((e) => console.log('[SOSScreen] Offline Coastal Guard sync notice:', e));
      }
    } catch (err: any) {
      if (err.message === 'OFFLINE_STORED') {
        setSosStatus('pending');
      } else {
        console.error('SOS dispatch error:', err);
        setSosStatus('error');
        setStatusMessage('Unable to send SOS. Check connection or tap retry.');
      }
    }
  };

  // Manual Retry for error state
  const handleRetrySending = async () => {
    const packetToRetry = pendingSOSPacket || activeSOSPacket;
    if (packetToRetry) {
      attemptAutoRetry(packetToRetry);
    } else {
      setSosStatus('idle');
    }
  };

  // Update Location in Active SOS state
  const handleUpdateLocation = async () => {
    if (!activeSOSPacket) return;
    setIsUpdatingLocation(true);
    try {
      const freshLoc = await getCurrentLocation();
      setLocation(freshLoc);

      if (!freshLoc.available) {
        Alert.alert('Unable to update location', 'GPS signal unavailable. Previous coordinates retained.');
      } else {
        const updated = await updateSOSLocation(activeSOSPacket.id, freshLoc);
        if (updated) {
          setActiveSOSPacket(updated);
        }
        Alert.alert('Location Updated', 'Your fresh GPS coordinates have been recorded.');
      }
    } catch (e) {
      Alert.alert('Update Failed', 'Could not refresh position.');
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  // Cancel SOS flow
  const handleConfirmCancel = async () => {
    setShowCancelModal(false);
    setSosStatus('cancelling');
    setStatusMessage('Broadcasting SOS cancellation event...');

    if (activeSOSPacket) {
      await cancelSOS(activeSOSPacket.id);
    } else if (pendingSOSPacket) {
      await cancelSOS(pendingSOSPacket.id);
    }

    setActiveSOSPacket(null);
    setPendingSOSPacket(null);
    setSosStatus('cancelled');
    setStatusMessage('SOS alert cancelled successfully.');

    setTimeout(() => {
      setSosStatus('idle');
      setStatusMessage('');
    }, 2500);
  };

  const rescueInfo = getNearestRescueStation(
    activeSOSPacket?.latitude ?? location?.latitude ?? null,
    activeSOSPacket?.longitude ?? location?.longitude ?? null
  );

  const nearbyBoats = findNearbyRegisteredBoats(
    activeSOSPacket?.latitude ?? location?.latitude ?? null,
    activeSOSPacket?.longitude ?? location?.longitude ?? null,
    20
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Header Title Banner */}
      <View style={styles.headerBanner}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitleText}>EMERGENCY SOS</Text>
          <View
            style={[
              styles.statusTag,
              sosStatus === 'active'
                ? styles.tagRed
                : sosStatus === 'pending'
                ? styles.tagOrange
                : styles.tagTeal,
            ]}
          >
            <Text style={styles.statusTagText}>
              {sosStatus === 'active'
                ? 'SOS ACTIVE'
                : sosStatus === 'pending'
                ? 'PENDING SOS'
                : 'READY'}
            </Text>
          </View>
        </View>
        <Text style={styles.headerSubtitleText}>
          Maritime Distress Signal & Spatial Rescue Network
        </Text>
      </View>

      {/* 2. Main 3-Second Hold SOS Button (PLACED AT TOP ABOVE SYSTEM STATUS) */}
      {(sosStatus === 'idle' ||
        sosStatus === 'getting_location' ||
        sosStatus === 'checking_connection' ||
        sosStatus === 'sending' ||
        sosStatus === 'cancelled' ||
        sosStatus === 'error') && (
        <SOSButton
          onHoldSuccess={handleSOSTriggered}
          disabled={
            sosStatus === 'getting_location' ||
            sosStatus === 'checking_connection' ||
            sosStatus === 'sending'
          }
        />
      )}

      {/* Status Message / Progress Feedback */}
      {statusMessage !== '' && (
        <View
          style={[
            styles.messageBanner,
            sosStatus === 'error' ? styles.msgError : styles.msgInfo,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              sosStatus === 'error' ? styles.msgTextError : styles.msgTextInfo,
            ]}
          >
            {statusMessage}
          </Text>

          {sosStatus === 'error' && (
            <TouchableOpacity
              onPress={handleRetrySending}
              style={styles.retryBtn}
            >
              <Text style={styles.retryBtnText}>RETRY</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 3. System Status Card */}
      <SOSStatusCard
        gpsAvailable={gpsAvailable}
        communicationStatus={communicationStatus}
        batteryLevel={activeSOSPacket?.batteryLevel ?? pendingSOSPacket?.batteryLevel ?? batteryLevel}
        sosId={activeSOSPacket?.id || pendingSOSPacket?.id}
        isPending={sosStatus === 'pending'}
      />

      {/* 4. ACTIVE SOS VIEW */}
      {sosStatus === 'active' && activeSOSPacket && (
        <View style={styles.activeContainer}>
          <View style={styles.activeBanner}>
            <Text style={styles.activeBannerIcon}>🚨</Text>
            <View style={styles.activeBannerTextCol}>
              <Text style={styles.activeBannerTitle}>EMERGENCY SOS IS ACTIVE</Text>

              {/* Explicit distinction between location available vs unavailable */}
              {activeSOSPacket.latitude !== null ? (
                <Text style={styles.activeBannerSubtitle}>
                  SOS SENT WITH GPS LOCATION
                </Text>
              ) : (
                <Text style={styles.activeBannerSubtitleWarning}>
                  SOS SENT WITHOUT LOCATION (GPS UNAVAILABLE)
                </Text>
              )}
            </View>
          </View>

          {/* Active Location Info */}
          <SOSLocationCard
            latitude={activeSOSPacket.latitude}
            longitude={activeSOSPacket.longitude}
            accuracy={activeSOSPacket.accuracy}
            timestamp={activeSOSPacket.timestamp}
            isUnavailable={activeSOSPacket.latitude === null}
          />

          {/* Rescue Coordination Centre Routing Card */}
          <View style={styles.rescueCard}>
            <Text style={styles.rescueTitle}>RESCUE COORDINATION ROUTING</Text>
            <Text style={styles.rescueStationName}>{rescueInfo.station.name}</Text>
            <Text style={styles.rescueSubtext}>
              Emergency alert routed to rescue coordination centre ({rescueInfo.station.region}).
            </Text>
            <View style={styles.contactRow}>
              <Text style={styles.contactLabel}>VHF Channel: </Text>
              <Text style={styles.contactValue}>{rescueInfo.station.vhfChannel}</Text>
            </View>
          </View>

          {/* Nearby Boats Section */}
          {nearbyBoats.length > 0 && (
            <View style={styles.boatsCard}>
              <Text style={styles.boatsTitle}>NEARBY REGISTERED BOATS ({nearbyBoats.length})</Text>
              <Text style={styles.boatsDisclaimer}>
                Vessels in proximity (Alert queue):
              </Text>
              {nearbyBoats.slice(0, 3).map((boat) => (
                <View key={boat.id} style={styles.boatRow}>
                  <Text style={styles.boatName}>⛵ {boat.name} ({boat.captainName})</Text>
                  <Text style={styles.boatDist}>{boat.distanceKm} km away</Text>
                </View>
              ))}
            </View>
          )}

          {/* Active Action Buttons */}
          <View style={styles.activeButtonsRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleUpdateLocation}
              disabled={isUpdatingLocation}
              style={styles.updateLocBtn}
            >
              {isUpdatingLocation ? (
                <ActivityIndicator size="small" color="#005F60" />
              ) : (
                <Text style={styles.updateLocBtnText}>📍 UPDATE LOCATION</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShowCancelModal(true)}
              style={styles.cancelSosBtn}
            >
              <Text style={styles.cancelSosBtnText}>❌ CANCEL SOS</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 5. PENDING SOS VIEW (OFFLINE) */}
      {sosStatus === 'pending' && (
        <View style={styles.pendingContainer}>
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingIcon}>📡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingTitle}>NO CONNECTION - SOS SAVED</Text>
              <Text style={styles.pendingText}>
                Your SOS has been saved locally and is waiting for a communication connection. It will transmit automatically when signal is restored.
              </Text>
            </View>
          </View>

          <SOSLocationCard
            latitude={pendingSOSPacket?.latitude ?? location?.latitude ?? null}
            longitude={pendingSOSPacket?.longitude ?? location?.longitude ?? null}
            isUnavailable={(pendingSOSPacket?.latitude ?? location?.latitude) === null}
          />

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setShowCancelModal(true)}
            style={styles.cancelSosBtn}
          >
            <Text style={styles.cancelSosBtnText}>CANCEL PENDING SOS</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 6. IDLE & IN-PROGRESS POSITION AND CATEGORY CARDS */}
      {(sosStatus === 'idle' ||
        sosStatus === 'getting_location' ||
        sosStatus === 'checking_connection' ||
        sosStatus === 'sending' ||
        sosStatus === 'cancelled' ||
        sosStatus === 'error') && (
        <View>
          {/* Location Position Card */}
          <SOSLocationCard
            latitude={location?.latitude ?? null}
            longitude={location?.longitude ?? null}
            accuracy={location?.accuracy ?? null}
            timestamp={location?.timestamp}
            isUnavailable={!gpsAvailable || Boolean(location && !location.available)}
          />

          {/* Optional Emergency Category Selector */}
          <SOSEmergencyTypeSelector
            selectedType={emergencyType}
            onSelectType={(type) => setEmergencyType(type)}
          />
        </View>
      )}

      {/* 7. Cancellation Safety Confirmation Modal */}
      <SOSConfirmationModal
        visible={showCancelModal}
        onConfirmCancel={handleConfirmCancel}
        onKeepActive={() => setShowCancelModal(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
  },
  headerBanner: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerTitleText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  statusTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagTeal: {
    backgroundColor: Colors.accent,
  },
  tagRed: {
    backgroundColor: '#C0392B',
  },
  tagOrange: {
    backgroundColor: '#E67E22',
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerSubtitleText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.secondary,
  },
  activeContainer: {
    marginBottom: 16,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C0392B',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#902B20',
  },
  activeBannerIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  activeBannerTextCol: {
    flex: 1,
  },
  activeBannerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  activeBannerSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFD7D7',
    marginTop: 2,
  },
  activeBannerSubtitleWarning: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFEAA7',
    marginTop: 2,
  },
  rescueCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  rescueTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  rescueStationName: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  rescueSubtext: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 18,
    marginBottom: 8,
  },
  contactRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    padding: 8,
    borderRadius: 8,
  },
  contactLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  contactValue: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.primary,
  },
  boatsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  boatsTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  boatsDisclaimer: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  boatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  boatName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  boatDist: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  activeButtonsRow: {
    flexDirection: 'column',
  },
  updateLocBtn: {
    backgroundColor: Colors.secondary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  updateLocBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  cancelSosBtn: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#C0392B',
  },
  cancelSosBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#C0392B',
  },
  pendingContainer: {
    marginBottom: 16,
  },
  pendingBanner: {
    flexDirection: 'row',
    backgroundColor: '#FEF9E7',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F39C12',
    marginBottom: 16,
  },
  pendingIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#D35400',
    marginBottom: 4,
  },
  pendingText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 18,
  },
  messageBanner: {
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  msgInfo: {
    backgroundColor: '#E8F8F5',
    borderWidth: 1,
    borderColor: '#A3D9D5',
  },
  msgError: {
    backgroundColor: '#FDEDEC',
    borderWidth: 1,
    borderColor: '#F5B7B1',
  },
  messageText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  msgTextInfo: {
    color: Colors.primaryDark,
  },
  msgTextError: {
    color: '#C0392B',
  },
  retryBtn: {
    backgroundColor: '#C0392B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
});
