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
  useBatteryLevel,
  useLocation,
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
import { fetchLiveRegisteredBoats, RegisteredBoat } from '../data/mockBoats';
import { coastalGuardService, RescueMissionItem } from '../services/coastalGuardService';
import { playEmergencyBuzzerSound } from '../utils/speech';

import { SOSButton } from './components/SOSButton';
import { SOSStatusCard } from './components/SOSStatusCard';
import { SOSLocationCard } from './components/SOSLocationCard';
import { SOSEmergencyTypeSelector } from './components/SOSEmergencyTypeSelector';
import { SOSConfirmationModal } from './components/SOSConfirmationModal';

interface SOSScreenProps {
  currentLanguage?: SupportedLanguage;
}

export const SOSScreen: React.FC<SOSScreenProps> = () => {
  const realBatteryLevel = useBatteryLevel();
  const liveLocation = useLocation();
  const [sosStatus, setSosStatus] = useState<SOSStatus>('idle');
  const [emergencyType, setEmergencyType] = useState<EmergencyType>('General Emergency');
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [communicationStatus, setCommunicationStatus] = useState<CommunicationStatus>('online');
  const [gpsAvailable, setGpsAvailable] = useState<boolean>(true);
  const [activeSOSPacket, setActiveSOSPacket] = useState<SOSPacket | null>(null);
  const [pendingSOSPacket, setPendingSOSPacket] = useState<SOSPacket | null>(null);
  const [activeMission, setActiveMission] = useState<RescueMissionItem | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isUpdatingLocation, setIsUpdatingLocation] = useState<boolean>(false);
  const [nearbyBoats, setNearbyBoats] = useState<RegisteredBoat[]>([]);

  useEffect(() => {
    initSOSScreen();
  }, []);

  useEffect(() => {
    const updateLiveBoats = async () => {
      try {
        const currentLat = activeSOSPacket?.latitude ?? location?.latitude ?? liveLocation?.latitude ?? null;
        const currentLon = activeSOSPacket?.longitude ?? location?.longitude ?? liveLocation?.longitude ?? null;
        const boats = await fetchLiveRegisteredBoats(currentLat, currentLon, 35);
        setNearbyBoats(boats);
      } catch (e) {
        console.log('[SOSScreen] Live boats update error:', e);
      }
    };

    updateLiveBoats();
    const interval = setInterval(updateLiveBoats, 3500);
    return () => clearInterval(interval);
  }, [activeSOSPacket, location, liveLocation]);

  useEffect(() => {
    const pollMissionUpdates = async () => {
      try {
        const missions = await coastalGuardService.getLocalMissions();
        const alerts = await coastalGuardService.getLocalAlerts();
        
        // Find mission linked to active or pending SOS of current user
        const activeTarget = activeSOSPacket || pendingSOSPacket || (await getActiveSOS());
        if (activeTarget) {
          const targetIdStr = String(activeTarget.id);
          const userSession = await getUserSession();
          const linkedAlert = alerts.find(
            a => String(a.id) === targetIdStr || (userSession?.name && a.fisherman?.name === userSession.name && a.status !== 'RESOLVED' && a.status !== 'CANCELLED')
          );
          const targetAlertId = linkedAlert ? linkedAlert.id : Number(targetIdStr);

          const linkedMission = missions.find(
            m => m.sos_alert_id === targetAlertId || String(m.sos_alert_id) === targetIdStr
          );

          if (linkedMission && linkedMission.status !== 'CANCELLED') {
            setActiveMission(linkedMission);
          } else if (linkedAlert && linkedAlert.rescue_mission) {
            setActiveMission({
              id: linkedAlert.rescue_mission.id,
              sos_alert_id: linkedAlert.id,
              officer_name: 'Cmdr. Rajesh Kumar (ICG)',
              rescue_team: linkedAlert.rescue_mission.rescue_team,
              rescue_vessel: linkedAlert.rescue_mission.rescue_vessel,
              status: linkedAlert.rescue_mission.status as any,
              eta_minutes: linkedAlert.rescue_mission.eta_minutes,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          } else {
            // NO mission assigned by Coastal Guard yet!
            setActiveMission(null);
          }
        } else {
          // NO active or pending SOS for this fisherman!
          setActiveMission(null);
        }
      } catch (e) {
        console.log('[SOSScreen] Error polling mission updates:', e);
      }
    };

    pollMissionUpdates();
    const interval = setInterval(pollMissionUpdates, 2500);
    return () => clearInterval(interval);
  }, [activeSOSPacket, pendingSOSPacket]);

  useEffect(() => {
    if (liveLocation && liveLocation.available && liveLocation.latitude !== null && liveLocation.longitude !== null) {
      setLocation(liveLocation);
    }
  }, [liveLocation]);

  const initSOSScreen = async () => {
    setCommunicationStatus(communicationManager.getStatus());
    setGpsAvailable(isDemoGpsAvailable());

    // Instantly request location permission and fetch real GPS
    const realLoc = await getCurrentLocation();
    setLocation(realLoc);

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

  const handleRefreshGps = async () => {
    setIsUpdatingLocation(true);
    const freshLoc = await getCurrentLocation();
    setLocation(freshLoc);
    setIsUpdatingLocation(false);
  };

  // Main Hold-to-Send trigger flow
  const handleSOSTriggered = async () => {
    try {
      playEmergencyBuzzerSound();
      setSosStatus('getting_location');
      setStatusMessage('Getting GPS coordinates...');

      // 1. Fetch real position & fresh battery
      const [loc, freshBatt] = await Promise.all([
        getCurrentLocation(),
        getRealBatteryLevel(),
      ]);
      const currentBatt = freshBatt > 0 ? freshBatt : realBatteryLevel;
      setLocation(loc);

      // 2. Fetch User Session & Check Connection
      setSosStatus('checking_connection');
      setStatusMessage('Checking communication link...');
      const commStatus = communicationManager.getStatus();
      const userSession = await getUserSession();

      // 3. Build Packet with exact registered user profile
      const packet = buildEmergencyPacket(loc, emergencyType, userSession, currentBatt);

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

      {/* 2. Main 3-Second Hold SOS Button (BEFORE SOS ACTIVATION) */}
      {(sosStatus === 'idle' ||
        sosStatus === 'getting_location' ||
        sosStatus === 'checking_connection' ||
        sosStatus === 'sending' ||
        sosStatus === 'cancelled' ||
        sosStatus === 'error') && (
        <>
          <SOSButton
            onHoldSuccess={handleSOSTriggered}
            disabled={
              sosStatus === 'getting_location' ||
              sosStatus === 'checking_connection' ||
              sosStatus === 'sending'
            }
          />

          {/* Optional Emergency Category Selector (PLACED RIGHT BELOW SOS BUTTON) */}
          <SOSEmergencyTypeSelector
            selectedType={emergencyType}
            onSelectType={(type) => setEmergencyType(type)}
          />
        </>
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

      {/* 2.5 Real-Time Coastal Guard Dispatched Rescue Mission Telemetry Card */}
      {activeMission && (
        <View style={styles.missionDispatchCard}>
          <View style={styles.missionDispatchHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>🛡️</Text>
              <Text style={styles.missionDispatchTitle}>COAST GUARD RESCUE DISPATCHED</Text>
            </View>
            <View style={styles.missionStatusBadge}>
              <Text style={styles.missionStatusBadgeTxt}>
                {activeMission.status.replace('_', ' ')}
              </Text>
            </View>
          </View>

          <View style={styles.missionGrid}>
            <View style={styles.missionGridRow}>
              <Text style={styles.missionLabel}>Commanding Officer:</Text>
              <Text style={styles.missionValueHighlight}>
                {activeMission.officer_name || 'Cmdr. Rajesh Kumar (ICG)'}
              </Text>
            </View>

            <View style={styles.missionGridRow}>
              <Text style={styles.missionLabel}>Assigned Rescue Vessel:</Text>
              <Text style={styles.missionValueBadge}>{activeMission.rescue_vessel}</Text>
            </View>

            <View style={styles.missionGridRow}>
              <Text style={styles.missionLabel}>Estimated Arrival (ETA):</Text>
              <Text style={styles.missionEtaValue}>⏱️ {activeMission.eta_minutes} Minutes</Text>
            </View>

            {/* Origin / Dispatching Base Coordinates */}
            <View style={styles.missionCoordContainer}>
              <Text style={styles.missionCoordLabel}>📍 Arriving From Base Coordinates:</Text>
              <Text style={styles.missionCoordValue}>13.3100° N, 80.3400° E</Text>
            </View>
          </View>
        </View>
      )}

      {/* 3. ACTIVE SOS VIEW (PLACED MOVED UP ABOVE SYSTEM STATUS CARD) */}
      {sosStatus === 'active' && activeSOSPacket && (
        <View style={styles.activeContainer}>
          <View style={[styles.activeBanner, activeMission?.status === 'COMPLETED' && { backgroundColor: '#1E824C', borderColor: '#145A32' }]}>
            <Text style={styles.activeBannerIcon}>
              {activeMission
                ? activeMission.status === 'COMPLETED'
                  ? '✅'
                  : '🛡️'
                : '🚨'}
            </Text>
            <View style={styles.activeBannerTextCol}>
              <Text style={styles.activeBannerTitle}>
                {activeMission
                  ? activeMission.status === 'COMPLETED'
                    ? 'RESCUE COMPLETED & RESOLVED'
                    : 'COAST GUARD RESCUE IN PROGRESS'
                  : 'EMERGENCY SOS IS ACTIVE'}
              </Text>

              <Text style={styles.activeBannerSubtitle}>
                {activeMission
                  ? `Rescue Status: ${activeMission.status.replace('_', ' ')} • ETA: ${activeMission.eta_minutes} mins`
                  : activeSOSPacket.latitude !== null
                  ? 'SOS SIGNAL TRANSMITTED • AWAITING COAST GUARD MISSION ASSIGNMENT'
                  : 'SOS SENT WITHOUT LOCATION (GPS UNAVAILABLE)'}
              </Text>
            </View>
          </View>

          {/* Rescue Lifecycle Progress Tracker */}
          <View style={styles.trackerCard}>
            <Text style={styles.trackerHeaderTitle}>RESCUE LIFECYCLE PROGRESS</Text>
            <View style={styles.trackerRow}>
              {/* Step 1: Signal Sent */}
              <View style={styles.trackerStep}>
                <View style={[styles.stepDot, styles.stepDotDone]}>
                  <Text style={styles.stepDotTxt}>✓</Text>
                </View>
                <Text style={styles.stepLabel}>Signal Sent</Text>
              </View>

              <View style={[styles.stepLine, activeMission ? styles.stepLineDone : null]} />

              {/* Step 2: Mission Assigned */}
              <View style={styles.trackerStep}>
                <View style={[styles.stepDot, activeMission ? styles.stepDotDone : styles.stepDotActive]}>
                  <Text style={styles.stepDotTxt}>{activeMission ? '✓' : '2'}</Text>
                </View>
                <Text style={styles.stepLabel}>
                  {activeMission ? 'Assigned' : 'Awaiting'}
                </Text>
              </View>

              <View style={[styles.stepLine, (activeMission && activeMission.status !== 'ASSIGNED') ? styles.stepLineDone : null]} />

              {/* Step 3: En Route */}
              <View style={styles.trackerStep}>
                <View style={[styles.stepDot, (activeMission && activeMission.status !== 'ASSIGNED') ? styles.stepDotDone : styles.stepDotInactive]}>
                  <Text style={styles.stepDotTxt}>{(activeMission && activeMission.status !== 'ASSIGNED') ? '✓' : '3'}</Text>
                </View>
                <Text style={styles.stepLabel}>En Route</Text>
              </View>

              <View style={[styles.stepLine, (activeMission && activeMission.status === 'COMPLETED') ? styles.stepLineDone : null]} />

              {/* Step 4: Resolved */}
              <View style={styles.trackerStep}>
                <View style={[styles.stepDot, (activeMission && activeMission.status === 'COMPLETED') ? styles.stepDotDone : styles.stepDotInactive]}>
                  <Text style={styles.stepDotTxt}>{(activeMission && activeMission.status === 'COMPLETED') ? '✓' : '4'}</Text>
                </View>
                <Text style={styles.stepLabel}>Resolved</Text>
              </View>
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

      {/* 4. PENDING SOS VIEW (OFFLINE) */}
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

      {/* 5. System Status Card (MOVED DOWN BELOW EMERGENCY SOS IS ACTIVE CARD IN ACTIVE STATE) */}
      <SOSStatusCard
        gpsAvailable={gpsAvailable}
        communicationStatus={communicationStatus}
        batteryLevel={realBatteryLevel}
        sosId={activeSOSPacket?.id || pendingSOSPacket?.id}
        isPending={sosStatus === 'pending'}
      />

      {/* 6. IDLE & IN-PROGRESS POSITION CARDS */}
      {(sosStatus === 'idle' ||
        sosStatus === 'getting_location' ||
        sosStatus === 'checking_connection' ||
        sosStatus === 'sending' ||
        sosStatus === 'cancelled' ||
        sosStatus === 'error') && (
        <View>
          {/* Location Position Card */}
          <SOSLocationCard
            latitude={location?.latitude ?? liveLocation?.latitude ?? 13.120456}
            longitude={location?.longitude ?? liveLocation?.longitude ?? 80.297412}
            accuracy={location?.accuracy ?? liveLocation?.accuracy ?? 15}
            timestamp={location?.timestamp ?? liveLocation?.timestamp ?? new Date().toISOString()}
            isUnavailable={!gpsAvailable}
            onRefreshLocation={handleRefreshGps}
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
  boatsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  boatsTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  liveIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F8F5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A3D9D5',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#27AE60',
    marginRight: 5,
  },
  liveBadgeTxt: {
    fontSize: 9,
    fontWeight: '900',
    color: '#1E824C',
    letterSpacing: 0.5,
  },
  boatsDisclaimer: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  boatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  boatMainCol: {
    flex: 1,
    paddingRight: 8,
  },
  boatIcon: {
    fontSize: 14,
  },
  boatName: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.text,
  },
  regTag: {
    backgroundColor: '#EBF5FB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#AED6F1',
  },
  regTagTxt: {
    fontSize: 8,
    fontWeight: '900',
    color: '#2980B9',
    letterSpacing: 0.3,
  },
  boatSubText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  boatDistCol: {
    alignItems: 'flex-end',
  },
  boatDist: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.primary,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  statusBadgeActive: {
    backgroundColor: '#E8F8F5',
  },
  statusBadgeReturning: {
    backgroundColor: '#FEF9E7',
  },
  statusBadgeAnchored: {
    backgroundColor: '#EBEDEF',
  },
  statusBadgeTxt: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.primaryDark,
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
  missionDispatchCard: {
    backgroundColor: '#E0F2F1', // Pale teal background
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: '#00796B', // Elegant deep teal border
    marginBottom: 16,
    shadowColor: '#004D40',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  missionDispatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: '#B2DFDB',
    paddingBottom: 10,
  },
  missionDispatchTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#004D40',
    letterSpacing: 0.5,
  },
  missionStatusBadge: {
    backgroundColor: '#004D40',
    borderColor: '#00796B',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  missionStatusBadgeTxt: {
    color: '#E0F2F1',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  missionGrid: {
    gap: 10,
  },
  missionGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  missionLabel: {
    color: '#00695C',
    fontSize: 12,
    fontWeight: '700',
  },
  missionValue: {
    color: '#004D40',
    fontSize: 12,
    fontWeight: '700',
  },
  missionValueHighlight: {
    color: '#004D40',
    fontSize: 13,
    fontWeight: '900',
  },
  missionValueBadge: {
    color: '#004D40',
    backgroundColor: '#B2DFDB',
    fontWeight: '900',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  missionEtaValue: {
    color: '#004D40',
    fontSize: 14,
    fontWeight: '900',
  },
  missionCoordContainer: {
    backgroundColor: '#B2DFDB',
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#80CBC4',
    alignItems: 'center',
  },
  missionCoordLabel: {
    color: '#004D40',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  missionCoordValue: {
    color: '#004D40',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  /* Rescue Tracker Styles */
  trackerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  trackerHeaderTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  trackerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  trackerStep: {
    alignItems: 'center',
    width: 60,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepDotDone: {
    backgroundColor: '#27AE60',
  },
  stepDotActive: {
    backgroundColor: '#E67E22',
  },
  stepDotInactive: {
    backgroundColor: '#BDC3C7',
  },
  stepDotTxt: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  stepLine: {
    flex: 1,
    height: 3,
    backgroundColor: '#ECF0F1',
    marginTop: -16,
  },
  stepLineDone: {
    backgroundColor: '#27AE60',
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
});
