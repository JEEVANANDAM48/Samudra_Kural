import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  Easing,
  Alert,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import {
  NavigationTarget,
  getNavigationDetails,
  CalculatedNavigationData,
} from '../services/navigationService';
import {
  fetchSectorAdvisory,
  fetchLiveMarineTelemetry,
  getRealSatellitePFZHotspots,
  HotspotInfo,
  LiveMarineTelemetry,
} from '../services/pfzService';
import { SupportedLanguage, FishermanUser } from '../types';
import { getUserSession, clearSession } from '../storage/storage';
import * as Location from 'expo-location';
import { BottomNavBar } from '../components/BottomNavBar';
import { useLanguage } from '../i18n';
import { checkIBLProximity } from '../services/iblService';
import { speakNativeText } from '../utils/speech';

interface NavigationScreenProps {
  currentLanguage: string;
  initialTarget?: HotspotInfo | null;
  onBack?: () => void;
  onOpenMap?: () => void;
  onLogout?: () => void;
  onOpenProfile?: () => void;
  onTabPress?: (tabId: string) => void;
  hideTopHeader?: boolean;
}

// Helper to determine state priority order: 1=Tamil Nadu, 2=Andhra Pradesh, 3=Kerala, 4=Others
const getStatePriority = (target: NavigationTarget): number => {
  if (target.is_shore) return 0; // Shore Base (Chennai Harbour, TN)
  const nameUpper = target.name.toUpperCase();
  const idUpper = target.id.toUpperCase();

  if (nameUpper.includes('TAMIL NADU') || nameUpper.includes('TAMILNADU') || idUpper.includes('SEC006') || idUpper.includes('SEC007')) {
    return 1;
  }
  if (nameUpper.includes('ANDHRA') || idUpper.includes('SEC008') || idUpper.includes('SEC009')) {
    return 2;
  }
  if (nameUpper.includes('KERALA') || idUpper.includes('SEC005')) {
    return 3;
  }

  // Geographic coordinate fallbacks
  if (target.longitude > 77.5 && target.latitude <= 13.6) return 1; // Tamil Nadu Coast
  if (target.longitude > 79.0 && target.latitude > 13.6) return 2;  // Andhra Pradesh Coast
  if (target.longitude <= 77.5 && target.latitude <= 13.0) return 3; // Kerala Coast
  return 4;
};

const getStateLabel = (target: NavigationTarget): string => {
  if (target.is_shore) return 'Tamil Nadu Base';
  const prio = getStatePriority(target);
  if (prio === 1) return 'Tamil Nadu';
  if (prio === 2) return 'Andhra Pradesh';
  if (prio === 3) return 'Kerala';
  return 'India Offshore';
};

// Default Shore Base Location (e.g. Chennai Fishing Harbour)
const SHORE_BASE: NavigationTarget = {
  id: 'SHORE_BASE_TN_01',
  name: 'Port of Chennai (Base Shore)',
  latitude: 13.0827,
  longitude: 80.2707,
  depth_meters: 0,
  reliability_score: '100% Base Port',
  is_shore: true,
};

// Default PFZ Hotspot (Tamil Nadu Sector)
const DEFAULT_HOTSPOT: NavigationTarget = {
  id: 'SEC006-TN-01',
  name: 'North Tamil Nadu Coastal Front #1',
  latitude: 13.225,
  longitude: 80.520,
  depth_meters: 26,
  reliability_score: '96%',
  is_shore: false,
};

export const NavigationScreen: React.FC<NavigationScreenProps> = ({
  currentLanguage = 'ta',
  initialTarget,
  onBack,
  onOpenMap,
  onLogout,
  onOpenProfile,
  onTabPress,
  hideTopHeader = false,
}) => {
  const { t, tDirection, tSeaState, language } = useLanguage();
  // Current Boat Location (Positioned offshore in Bay of Bengal sea)
  const [boatLocation, setBoatLocation] = useState({ lat: 13.0827, lon: 80.3800 });
  const [boatSpeedKnots, setBoatSpeedKnots] = useState<number>(8.5);
  const [isNavigating, setIsNavigating] = useState<boolean>(true);
  const [isVoiceActive, setIsVoiceActive] = useState<boolean>(true);
  const [isPickerVisible, setIsPickerVisible] = useState<boolean>(false);
  const [availableTargets, setAvailableTargets] = useState<NavigationTarget[]>([]);
  const [telemetry, setTelemetry] = useState<LiveMarineTelemetry | null>(null);
  const [telemetryLoading, setTelemetryLoading] = useState<boolean>(true);

  // Active Target (PFZ Hotspot or Shore)
  const [activeTarget, setActiveTarget] = useState<NavigationTarget>(() => {
    if (initialTarget) {
      return {
        id: initialTarget.id,
        name: initialTarget.name,
        latitude: initialTarget.latitude,
        longitude: initialTarget.longitude,
        sst_celsius: initialTarget.sst_celsius,
        chlorophyll_mg_m3: initialTarget.chlorophyll_mg_m3,
        depth_meters: initialTarget.depth_meters,
        target_species: initialTarget.target_species,
        reliability_score: initialTarget.reliability_score,
        is_shore: false,
      };
    }
    return DEFAULT_HOTSPOT;
  });

  const iblTelemetry = checkIBLProximity(boatLocation.lat, boatLocation.lon);
  const prevIblStatus = useRef<string>(iblTelemetry.status);

  useEffect(() => {
    if (isVoiceActive && iblTelemetry.status !== prevIblStatus.current) {
      if (iblTelemetry.status === 'WARNING' || iblTelemetry.status === 'CRITICAL' || iblTelemetry.status === 'CROSSED') {
        const speechMsg = `${iblTelemetry.warningMessage}. Distance is ${iblTelemetry.distanceNm} Nautical Miles.`;
        speakNativeText(speechMsg, language || 'en');
      }
      prevIblStatus.current = iblTelemetry.status;
    }
  }, [iblTelemetry.status, isVoiceActive, language]);

  const [gpsStatus, setGpsStatus] = useState<string>('Initializing Live Smartphone GPS...');
  const [gpsPlaceName, setGpsPlaceName] = useState<string>('Live Smartphone Hardware GPS');
  const [fishermanName, setFishermanName] = useState<string>('Fisherman');
  const [userSession, setUserSession] = useState<FishermanUser | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const session = await getUserSession();
        if (session) {
          setUserSession(session);
          if (session.name) {
            setFishermanName(session.name);
          }
        }
      } catch (err) {}
    };
    loadUserData();
  }, []);

  const handleLogoutPress = async () => {
    setIsProfileModalOpen(false);
    await clearSession();
    if (onLogout) {
      onLogout();
    } else if (onBack) {
      onBack();
    }
  };

  // Custom Coordinate Form State (Only Latitude & Longitude)
  const [isAddCustomVisible, setIsAddCustomVisible] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customLat, setCustomLat] = useState<string>('');
  const [customLon, setCustomLon] = useState<string>('');

  const handleAddCustomCoordinate = () => {
    const latNum = parseFloat(customLat);
    const lonNum = parseFloat(customLon);

    if (isNaN(latNum) || isNaN(lonNum)) {
      Alert.alert(t('genericError'), 'Please enter valid numeric values for Latitude and Longitude.');
      return;
    }

    if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
      Alert.alert(t('genericError'), 'Latitude must be between -90° and 90°, Longitude between -180° and 180°.');
      return;
    }

    const newSpot: NavigationTarget = {
      id: `CUSTOM_${Date.now()}`,
      name: customName.trim() ? `[Custom Target] ${customName.trim()}` : `[Custom Target] (${latNum.toFixed(4)}°N, ${lonNum.toFixed(4)}°E)`,
      latitude: latNum,
      longitude: lonNum,
      depth_meters: 28,
      reliability_score: '100% User Defined',
      is_shore: false,
    };

    setAvailableTargets((prev) => [newSpot, ...prev]);
    setActiveTarget(newSpot);
    setIsNavigating(true);
    setIsAddCustomVisible(false);
    setIsPickerVisible(false);

    setCustomName('');
    setCustomLat('');
    setCustomLon('');

    Alert.alert(
      t('targetWaypoint'),
      `Lat: ${latNum.toFixed(4)}°N, Lon: ${lonNum.toFixed(4)}°E`
    );
  };

  // Real Smartphone GPS Tracking Subscription (No simulation loops!)
  useEffect(() => {
    let locationSub: Location.LocationSubscription | null = null;

    const startGpsTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setGpsStatus('GPS Permission Denied');
          return;
        }

        setGpsStatus('🟢 REAL SMARTPHONE GPS LOCKED');

        // Fetch current device GPS location immediately
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (loc && loc.coords) {
          const latVal = Number(loc.coords.latitude.toFixed(4));
          const lonVal = Number(loc.coords.longitude.toFixed(4));
          setBoatLocation({ lat: latVal, lon: lonVal });

          if (loc.coords.speed && loc.coords.speed > 0) {
            setBoatSpeedKnots(Number((loc.coords.speed * 1.94384).toFixed(1)));
          }

          // Reverse geocode to show real physical location name
          try {
            const places = await Location.reverseGeocodeAsync({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
            if (places && places.length > 0) {
              const p = places[0];
              const placeParts = [p.name, p.district || p.subregion || p.city, p.region].filter(Boolean);
              if (placeParts.length > 0) {
                setGpsPlaceName(placeParts.join(', '));
              }
            }
          } catch (e) {}
        }

        // Subscribe to live GPS updates as boat/device moves physically
        locationSub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000,
            distanceInterval: 3,
          },
          (newLoc) => {
            const updatedLat = Number(newLoc.coords.latitude.toFixed(4));
            const updatedLon = Number(newLoc.coords.longitude.toFixed(4));
            setBoatLocation({ lat: updatedLat, lon: updatedLon });

            if (newLoc.coords.speed && newLoc.coords.speed > 0) {
              setBoatSpeedKnots(Number((newLoc.coords.speed * 1.94384).toFixed(1)));
            }
          }
        );
      } catch (err) {
        console.log('Real GPS tracking error:', err);
      }
    };

    startGpsTracking();

    return () => {
      if (locationSub) {
        locationSub.remove();
      }
    };
  }, []);

  useEffect(() => {
    loadTargetList();
    loadTelemetryData(false);
    const timer = setInterval(() => {
      loadTelemetryData(true);
    }, 4000);
    return () => clearInterval(timer);
  }, [boatLocation.lat, boatLocation.lon]);

  const loadTelemetryData = async (isSilent: boolean = false) => {
    if (!isSilent && !telemetry) setTelemetryLoading(true);
    try {
      const data = await fetchLiveMarineTelemetry(boatLocation.lat, boatLocation.lon);
      setTelemetry(data);
    } catch (err) {
      console.error('Error fetching live marine telemetry:', err);
    } finally {
      setTelemetryLoading(false);
    }
  };

  const loadTargetList = async () => {
    try {
      const allHotspots = getRealSatellitePFZHotspots();
      const rawTargets: NavigationTarget[] = [
        SHORE_BASE,
        ...allHotspots.map((hs) => ({
          id: hs.id,
          name: hs.name,
          latitude: hs.latitude,
          longitude: hs.longitude,
          depth_meters: hs.depth_meters,
          reliability_score: hs.reliability_score,
          is_shore: false,
        })),
      ];

      // Sort strictly: Shore Base -> 1. Tamil Nadu -> 2. Andhra Pradesh -> 3. Kerala -> 4. Others
      rawTargets.sort((a, b) => getStatePriority(a) - getStatePriority(b));

      setAvailableTargets(rawTargets);
    } catch (err) {
      setAvailableTargets([
        SHORE_BASE,
        { ...DEFAULT_HOTSPOT, name: '[Tamil Nadu] ' + DEFAULT_HOTSPOT.name },
      ]);
    }
  };

  // Calculate live navigation metrics
  const navDetails: CalculatedNavigationData = getNavigationDetails(
    boatLocation.lat,
    boatLocation.lon,
    activeTarget.latitude,
    activeTarget.longitude,
    boatSpeedKnots
  );

  // Animated compass needle rotation
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: navDetails.bearing_degrees,
      duration: 600,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [navDetails.bearing_degrees]);

  const spinNeedle = rotateAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  const handleSwitchTargetToShore = () => {
    setActiveTarget(SHORE_BASE);
    setIsNavigating(true);
    Alert.alert(t('returnToShoreBase'), 'Navigation course set to Chennai Fishing Harbour Shore Base.');
  };

  const handleSwitchTargetToPFZ = () => {
    if (initialTarget) {
      setActiveTarget({
        id: initialTarget.id,
        name: initialTarget.name,
        latitude: initialTarget.latitude,
        longitude: initialTarget.longitude,
        sst_celsius: initialTarget.sst_celsius,
        chlorophyll_mg_m3: initialTarget.chlorophyll_mg_m3,
        depth_meters: initialTarget.depth_meters,
        target_species: initialTarget.target_species,
        reliability_score: initialTarget.reliability_score,
        is_shore: false,
      });
    } else {
      setActiveTarget(DEFAULT_HOTSPOT);
    }
    setIsNavigating(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* Header */}
      {!hideTopHeader && (
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => (onOpenProfile ? onOpenProfile() : setIsProfileModalOpen(true))}>
            <Text style={styles.backButtonText}>☰</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>SamudraKural</Text>
            <Text style={styles.headerSubtitle}>Real-time Marine GPS Navigation</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE GPS</Text>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* 1. CENTERED HERO LATITUDE & LONGITUDE DISPLAY */}
        <View style={styles.heroGpsCard}>
          <Text style={styles.heroGpsTitle}>VESSEL CURRENT COORDINATES</Text>

          <View style={styles.heroGpsValueBox}>
            <View style={styles.coordColumn}>
              <Text style={styles.coordLabel}>{t('latitude')}</Text>
              <Text style={styles.coordValue} numberOfLines={1} adjustsFontSizeToFit={true}>
                {boatLocation.lat.toFixed(4)}° N
              </Text>
            </View>

            <View style={styles.coordDivider} />

            <View style={styles.coordColumn}>
              <Text style={styles.coordLabel}>{t('longitude')}</Text>
              <Text style={styles.coordValue} numberOfLines={1} adjustsFontSizeToFit={true}>
                {boatLocation.lon.toFixed(4)}° E
              </Text>
            </View>
          </View>

          <Text style={styles.heroGpsSubText}>📍 {gpsPlaceName}</Text>
        </View>

        {/* 1.5 INTERNATIONAL MARITIME BOUNDARY LINE (IBL) GEO-FENCE CARD */}
        <View style={[
          styles.iblCard,
          iblTelemetry.status === 'CROSSED'
            ? styles.iblCardCrossed
            : iblTelemetry.status === 'CRITICAL'
            ? styles.iblCardCritical
            : iblTelemetry.status === 'WARNING'
            ? styles.iblCardWarning
            : styles.iblCardSafe
        ]}>
          <View style={styles.iblHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Text style={{ fontSize: 22 }}>
                {iblTelemetry.status === 'SAFE' ? '🛡️' : '🚨'}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.iblTitle}>INTERNATIONAL BOUNDARY GEO-FENCE</Text>
                <Text style={styles.iblSub}>India - Sri Lanka IBL Monitoring Zone</Text>
              </View>
            </View>

            <View style={[
              styles.iblStatusBadge,
              iblTelemetry.status === 'CROSSED'
                ? styles.badgeRed
                : iblTelemetry.status === 'CRITICAL'
                ? styles.badgeDarkRed
                : iblTelemetry.status === 'WARNING'
                ? styles.badgeOrange
                : styles.badgeGreen
            ]}>
              <Text style={styles.iblStatusTxt}>
                {iblTelemetry.status === 'CROSSED'
                  ? 'RESTRICTED ZONE 🚨'
                  : iblTelemetry.status === 'CRITICAL'
                  ? 'CRITICAL 🚨'
                  : iblTelemetry.status === 'WARNING'
                  ? 'WARNING ⚠️'
                  : 'SAFE ZONE ✓'}
              </Text>
            </View>
          </View>

          <View style={styles.iblMetricGrid}>
            <View style={styles.iblMetricBox}>
              <Text style={styles.iblMetricLabel}>Distance to Boundary:</Text>
              <Text style={styles.iblMetricVal}>{iblTelemetry.distanceNm} NM ({iblTelemetry.distanceKm} km)</Text>
            </View>

            <View style={styles.iblMetricBox}>
              <Text style={styles.iblMetricLabel}>Heading to Boundary:</Text>
              <Text style={styles.iblMetricVal}>{iblTelemetry.bearingDegrees}°</Text>
            </View>
          </View>

          {iblTelemetry.status !== 'SAFE' && (
            <View style={styles.iblAlertBanner}>
              <Text style={styles.iblAlertBannerTxt}>
                ⚠️ {iblTelemetry.warningMessage}
              </Text>
            </View>
          )}
        </View>

        {/* 2. OCEAN & VESSEL TELEMETRY GRID */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('oceanAndVesselTelemetry')}</Text>
        </View>

        <View style={styles.telemetryGrid}>
          {/* Card 1: Wave Height */}
          <View style={styles.telemetryCard}>
            <Text style={styles.telemetryValue}>{telemetry?.waveHeight || '0.8m'}</Text>
            <Text style={styles.telemetryLabel}>Wave Height</Text>
            <Text style={styles.telemetrySub}>Sea State: {telemetry?.seaState || 'Slight'}</Text>
          </View>

          {/* Card 2: Wind Speed */}
          <View style={styles.telemetryCard}>
            <Text style={styles.telemetryValue}>{telemetry?.windSpeedKnots || '12 kts'}</Text>
            <Text style={styles.telemetryLabel}>{t('windSpeed')}</Text>
            <Text style={styles.telemetrySub}>
              {telemetry?.windDirectionDegrees ? `${t('likelyDirection')}: ${telemetry.windDirectionDegrees}°` : tDirection('Northeast')}
            </Text>
          </View>

          {/* Card 3: Boat Speed */}
          <View style={styles.telemetryCard}>
            <Text style={styles.telemetryValue}>{boatSpeedKnots} knots</Text>
            <Text style={styles.telemetryLabel}>{t('boatSpeed')}</Text>
            <Text style={styles.telemetrySub}>({(boatSpeedKnots * 1.852).toFixed(1)} km/h)</Text>
          </View>

          {/* Card 4: Distance & ETA */}
          <View style={styles.telemetryCard}>
            <Text style={styles.telemetryValue}>{navDetails.distance_nautical_miles} NM</Text>
            <Text style={styles.telemetryLabel}>{t('distanceAndEta')}</Text>
            <Text style={styles.telemetrySub}>{t('eta')} {navDetails.formatted_eta}</Text>
          </View>
        </View>

        {/* 3. TARGET ZONE LATITUDE & LONGITUDE METRICS GRID */}
        {!activeTarget.is_shore && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{t('targetZoneCoordinates')}</Text>
            </View>

            <View style={styles.telemetryGrid}>
              {/* Card 1: Target Latitude */}
              <View style={styles.telemetryCard}>
                <Text style={styles.telemetryValue}>{activeTarget.latitude.toFixed(4)}° N</Text>
                <Text style={styles.telemetryLabel}>{t('targetLatitude')}</Text>
                <Text style={styles.telemetrySub}>{t('degreesNorth')}</Text>
              </View>

              {/* Card 2: Target Longitude */}
              <View style={styles.telemetryCard}>
                <Text style={styles.telemetryValue}>{activeTarget.longitude.toFixed(4)}° E</Text>
                <Text style={styles.telemetryLabel}>{t('targetLongitude')}</Text>
                <Text style={styles.telemetrySub}>{t('degreesEast')}</Text>
              </View>

              {/* Card 3: Distance to Target */}
              <View style={styles.telemetryCard}>
                <Text style={styles.telemetryValue}>{navDetails.distance_nautical_miles} NM</Text>
                <Text style={styles.telemetryLabel}>{t('distanceToTarget')}</Text>
                <Text style={styles.telemetrySub}>({(navDetails.distance_nautical_miles * 1.852).toFixed(1)} km)</Text>
              </View>

              {/* Card 4: Water Depth */}
              <View style={styles.telemetryCard}>
                <Text style={styles.telemetryValue}>{activeTarget.depth_meters ? `${activeTarget.depth_meters}m` : '26m'}</Text>
                <Text style={styles.telemetryLabel}>{t('waterDepth')}</Text>
                <Text style={styles.telemetrySub}>{t('seaFloorBathymetry')}</Text>
              </View>
            </View>
          </>
        )}

        {/* 4. Active Destination Card */}
        <View style={styles.targetCard}>
          <View style={styles.targetHeaderRow}>
            <View style={styles.targetIconBadge}>
              <Text style={styles.targetIcon}>{activeTarget.is_shore ? '🏠' : '🐟'}</Text>
            </View>
            <View style={styles.targetTitleGroup}>
              <Text style={styles.targetLabel}>{t('currentDestination')}</Text>
              <Text style={styles.targetName}>{activeTarget.name}</Text>
              <Text style={styles.targetCoords}>
                {t('targetWaypoint')}: {activeTarget.latitude.toFixed(4)}° N, {activeTarget.longitude.toFixed(4)}° E
              </Text>
            </View>
          </View>

          {/* Destination Badges */}
          <View style={styles.targetDetailsRow}>
            <View style={styles.stateBadge}>
              <Text style={styles.stateBadgeText}>{getStateLabel(activeTarget)}</Text>
            </View>
            {activeTarget.reliability_score && (
              <View style={styles.activeTag}>
                <Text style={styles.activeTagText}>{t('reliability')}: {activeTarget.reliability_score}</Text>
              </View>
            )}
            {activeTarget.depth_meters !== undefined && (
              <View style={styles.detailPill}>
                <Text style={styles.detailPillLabel}>{t('depth')}:</Text>
                <Text style={styles.detailPillValue}>{activeTarget.depth_meters}m</Text>
              </View>
            )}
          </View>

          {/* Switch Button */}
          <View style={styles.switchButtonRow}>
            {activeTarget.is_shore ? (
              <TouchableOpacity style={styles.switchTargetBtn} onPress={handleSwitchTargetToPFZ}>
                <Text style={styles.switchTargetBtnText}>Switch to Fishing Zone Target</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.switchShoreBtn} onPress={handleSwitchTargetToShore}>
                <Text style={styles.switchShoreBtnText}>Return to Shore Base</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* CONTROL ACTION BUTTONS */}
        <View style={styles.controlButtonsGroup}>
          <TouchableOpacity
            style={styles.addCustomMainBtn}
            onPress={() => setIsAddCustomVisible(true)}
          >
            <Text style={styles.addCustomMainBtnText}>Add Custom Coordinates for Fishing Zone</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.changeTargetMainBtn}
            onPress={() => setIsPickerVisible(true)}
          >
            <Text style={styles.changeTargetMainBtnText}>Change Target Destination (Select Hotspot / Shore)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, isNavigating ? styles.pauseBtn : styles.startBtn]}
            onPress={() => setIsNavigating(!isNavigating)}
          >
            <Text style={styles.actionBtnText}>
              {isNavigating ? 'Pause GPS Tracking' : 'Resume GPS Tracking'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mapBtn}
            onPress={onOpenMap}
          >
            <Text style={styles.mapBtnText}>Open Ocean Map</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Target Destination Picker Modal */}
      <Modal
        visible={isPickerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t('selectTargetDestination')}</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsPickerVisible(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.targetListScroll} showsVerticalScrollIndicator={false}>
              {/* Option: Enter Custom Coordinates */}
              <TouchableOpacity
                style={[styles.targetItemCard, styles.customPickerCard]}
                onPress={() => {
                  setIsPickerVisible(false);
                  setIsAddCustomVisible(true);
                }}
              >
                <View style={styles.itemIconContainer}>
                  <Text style={styles.targetItemIcon}>➕</Text>
                </View>
                <View style={styles.targetItemDetails}>
                  <Text style={styles.targetItemName}>{t('enterCustomCoordinates')}</Text>
                </View>
              </TouchableOpacity>

              {/* Option: Pick from Ocean Map */}
              <TouchableOpacity
                style={[styles.targetItemCard, styles.mapPickerCard]}
                onPress={() => {
                  setIsPickerVisible(false);
                  if (onOpenMap) onOpenMap();
                }}
              >
                <View style={styles.itemIconContainer}>
                  <Text style={styles.targetItemIcon}>🗺️</Text>
                </View>
                <View style={styles.targetItemDetails}>
                  <Text style={styles.targetItemName}>{t('selectFromOceanMap')}</Text>
                </View>
              </TouchableOpacity>

              {/* Target List: Shore Base & PFZ Hotspots */}
              {availableTargets.map((target) => {
                const isSelected = target.id === activeTarget.id;
                const itemNav = getNavigationDetails(
                  boatLocation.lat,
                  boatLocation.lon,
                  target.latitude,
                  target.longitude,
                  boatSpeedKnots
                );

                return (
                  <TouchableOpacity
                    key={target.id}
                    style={[styles.targetItemCard, isSelected && styles.selectedItemCard]}
                    onPress={() => {
                      setActiveTarget(target);
                      setIsNavigating(true);
                      setIsPickerVisible(false);
                      Alert.alert(
                        t('targetWaypoint'),
                        `${target.name}\n${t('distance')}: ${itemNav.distance_nautical_miles} NM | ${t('eta')}: ${itemNav.formatted_eta}`
                      );
                    }}
                  >
                    <View style={[styles.itemIconContainer, target.is_shore && styles.shoreIconBg]}>
                      <Text style={styles.targetItemIcon}>{target.is_shore ? '🏠' : '🐟'}</Text>
                    </View>
                    <View style={styles.targetItemDetails}>
                      <View style={styles.targetItemTitleRow}>
                        <Text style={styles.targetItemName} numberOfLines={1}>
                          {target.name}
                        </Text>
                        <View style={styles.stateBadge}>
                          <Text style={styles.stateBadgeText}>📍 {getStateLabel(target)}</Text>
                        </View>
                      </View>
                      <Text style={styles.targetItemSub}>
                        {target.latitude.toFixed(4)}°N, {target.longitude.toFixed(4)}°E • {itemNav.distance_nautical_miles} NM
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Add Custom Coordinates */}
      <Modal
        visible={isAddCustomVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAddCustomVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>📍 {t('enterCustomCoordinates')}</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsAddCustomVisible(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.customFormScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('latitude')} (°N)*</Text>
                <TextInput
                  style={styles.textInput}
                  value={customLat}
                  onChangeText={setCustomLat}
                  placeholder="e.g. 13.0827"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('longitude')} (°E)*</Text>
                <TextInput
                  style={styles.textInput}
                  value={customLon}
                  onChangeText={setCustomLon}
                  placeholder="e.g. 80.3500"
                  keyboardType="numeric"
                />
              </View>

              <TouchableOpacity style={styles.saveCustomBtn} onPress={handleAddCustomCoordinate}>
                <Text style={styles.saveCustomBtnText}>🧭 {t('startNavigation')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* 3. Fisherman Profile & App Settings Modal */}
      <Modal
        visible={isProfileModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsProfileModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t('profileTitle')}</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsProfileModalOpen(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.customFormScroll} showsVerticalScrollIndicator={false}>
              {/* Profile Card */}
              <View style={styles.profileCard}>
                <View style={styles.profileAvatarBg}>
                  <Text style={styles.profileAvatarIcon}>👤</Text>
                </View>
                <Text style={styles.profileNameText}>{userSession?.name || fishermanName || 'Fisherman User'}</Text>
                <Text style={styles.profilePhoneText}>📱 {userSession?.phone || '+91 9876543210'}</Text>

                {userSession?.address && (
                  <View style={styles.profileDetailRow}>
                    <Text style={styles.profileDetailLabel}>{t('address')}:</Text>
                    <Text style={styles.profileDetailValue}>{userSession.address}</Text>
                  </View>
                )}

                {userSession?.pincode && (
                  <View style={styles.profileDetailRow}>
                    <Text style={styles.profileDetailLabel}>{t('pincode')}:</Text>
                    <Text style={styles.profileDetailValue}>{userSession.pincode}</Text>
                  </View>
                )}
              </View>

              {/* Settings Section */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>{t('appSettings')}</Text>
                
                <View style={styles.settingsItem}>
                  <Text style={styles.settingsItemLabel}>🌐 {t('language')}</Text>
                  <Text style={styles.settingsItemValue}>
                    {language === 'ta' ? 'தமிழ் (Tamil)' : language === 'te' ? 'తెలుగు (Telugu)' : language === 'ml' ? 'മലയാളം (Malayalam)' : language === 'hi' ? 'हिन्दी (Hindi)' : language === 'kn' ? 'ಕನ್ನಡ (Kannada)' : language === 'mr' ? 'मराठी (Marathi)' : language === 'gu' ? 'ગુજરાતી (Gujarati)' : language === 'or' ? 'ଓଡ଼ିଆ (Odia)' : language === 'bn' ? 'বাংলা (Bengali)' : 'English'}
                  </Text>
                </View>
              </View>

              {/* Logout Action Button */}
              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={handleLogoutPress}
              >
                <Text style={styles.logoutBtnText}>🚪 {t('logout')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Floating Bottom Navigation Bar (Only rendered when screen is standalone) */}
      {!hideTopHeader && (
        <BottomNavBar
          activeTab="nav"
          onTabPress={(tabId) => {
            if (onTabPress) {
              onTabPress(tabId);
            } else if (tabId === 'fishing' && onOpenMap) {
              onOpenMap();
            } else if (tabId === 'nets' && onBack) {
              onBack();
            } else if (tabId === 'bot') {
              Alert.alert('Ask Bot (AI Chatbot)', 'Samudra Kural AI Voice & Text Marine Assistant will be available in the upcoming release.');
            } else if (tabId === 'sos') {
              Alert.alert('Emergency SOS', 'Distress beacon signal transmitted to Coast Guard and nearest vessels.');
            }
          }}
          currentLanguage={currentLanguage as SupportedLanguage}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background, // #F2F9F9 Light Aqua
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.primary,
  },
  backButton: {
    padding: 6,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  headerSubtitle: {
    color: '#D4F2F0',
    fontSize: 14,
    fontWeight: '700',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00F5D4',
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  container: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 90,
  },
  heroGpsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: Colors.primary,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  heroGpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 95, 96, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 95, 96, 0.25)',
  },
  heroGpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  heroGpsBadgeText: {
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  fishermanWelcomeText: {
    color: Colors.primaryDark,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
    marginBottom: 2,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  heroGpsTitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  heroGpsValueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    width: '100%',
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  coordColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  coordLabel: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 2,
    textAlign: 'center',
  },
  coordValue: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  coordDivider: {
    width: 1.5,
    height: 32,
    backgroundColor: Colors.border,
    marginHorizontal: 4,
  },
  heroGpsSubText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '800',
  },
  targetCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  targetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  targetIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: Colors.secondaryDark,
  },
  targetIcon: {
    fontSize: 18,
  },
  targetTitleGroup: {
    flex: 1,
  },
  targetLabel: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  targetName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginVertical: 1,
  },
  targetCoords: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  targetDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    marginBottom: 4,
  },
  detailPill: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailPillLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  detailPillValue: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  switchButtonRow: {
    marginTop: 4,
  },
  switchShoreBtn: {
    backgroundColor: 'rgba(192, 57, 43, 0.12)',
    borderColor: '#C0392B',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  switchShoreBtnText: {
    color: '#C0392B',
    fontSize: 13,
    fontWeight: '800',
  },
  switchTargetBtn: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondaryDark,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  switchTargetBtnText: {
    color: Colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  telemetryLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 245, 212, 0.18)',
    borderColor: '#00F5D4',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  telemetryLiveBadgeDot: {
    fontSize: 9,
    marginRight: 4,
  },
  telemetryLiveBadgeText: {
    color: '#00F5D4',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  oceanCardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  oceanCardSubBadge: {
    color: '#00F5D4',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    backgroundColor: 'rgba(0, 245, 212, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  telemetryCard: {
    width: '48.5%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  telemetryIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  telemetryValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  telemetryLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  telemetrySub: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 1,
  },
  oceanCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  oceanCardTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  oceanMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  oceanMetric: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  oceanMetricLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  oceanMetricValue: {
    color: Colors.primaryDark,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  speciesContainer: {
    marginTop: 4,
  },
  speciesLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  speciesTagGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  speciesTag: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  speciesTagText: {
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
  },
  controlButtonsGroup: {
    gap: 12,
    marginBottom: 16,
  },
  actionBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  startBtn: {
    backgroundColor: Colors.primary,
  },
  pauseBtn: {
    backgroundColor: '#D35400',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  mapBtn: {
    backgroundColor: Colors.surface,
    borderColor: Colors.primary,
    borderWidth: 1.5,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  mapBtnText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  addCustomMainBtn: {
    backgroundColor: '#00F5D4',
    borderColor: '#00A896',
    borderWidth: 2,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  addCustomMainBtnText: {
    color: '#003840',
    fontSize: 14,
    fontWeight: '900',
  },
  changeTargetMainBtn: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondaryDark,
    borderWidth: 2,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  changeTargetMainBtnText: {
    color: Colors.primaryDark,
    fontSize: 14,
    fontWeight: '900',
  },
  customPickerCard: {
    backgroundColor: 'rgba(0, 245, 212, 0.12)',
    borderColor: '#00A896',
  },
  customFormScroll: {
    marginTop: 6,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderColor: Colors.border,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  submitCustomBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  submitCustomBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  bottomSpacer: {
    height: 10,
  },

  // Target Destination Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 30, 40, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.border,
    marginBottom: 12,
  },
  modalTitle: {
    color: Colors.primaryDark,
    fontSize: 22,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  modalCloseText: {
    color: Colors.textSecondary,
    fontSize: 18,
    fontWeight: '900',
  },
  targetListScroll: {
    marginTop: 6,
  },
  targetItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  mapPickerCard: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  selectedItemCard: {
    backgroundColor: '#E0F2F1',
    borderColor: Colors.primary,
    borderWidth: 2.5,
  },
  itemIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  shoreIconBg: {
    backgroundColor: '#FADBD8',
  },
  targetItemIcon: {
    fontSize: 22,
  },
  targetItemDetails: {
    flex: 1,
  },
  targetItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  targetItemName: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '900',
    flex: 1,
    marginRight: 6,
  },
  activeTag: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  stateBadge: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 4,
    borderWidth: 1,
    borderColor: Colors.secondaryDark,
  },
  stateBadgeText: {
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
  },
  targetItemSub: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 3,
  },
  targetSpeciesText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  profileAvatarBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  profileAvatarIcon: {
    fontSize: 36,
  },
  profileNameText: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  profilePhoneText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  profileDetailRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#E0ECEC',
  },
  profileDetailLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  profileDetailValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  settingsSection: {
    marginBottom: 18,
  },
  settingsSectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.6,
  },
  settingsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  settingsItemLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  settingsItemValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
  },
  logoutBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  logoutBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  saveCustomBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  saveCustomBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  /* International Boundary Line (IBL) Geo-Fence Styles */
  iblCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
  },
  iblCardSafe: {
    backgroundColor: '#F0FDF4',
    borderColor: '#16A34A',
  },
  iblCardWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  iblCardCritical: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
  },
  iblCardCrossed: {
    backgroundColor: '#450A0A',
    borderColor: '#EF4444',
  },
  iblHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iblTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.4,
  },
  iblSub: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  iblStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeGreen: {
    backgroundColor: '#DCFCE7',
  },
  badgeOrange: {
    backgroundColor: '#FEF3C7',
  },
  badgeDarkRed: {
    backgroundColor: '#FEE2E2',
  },
  badgeRed: {
    backgroundColor: '#EF4444',
  },
  iblStatusTxt: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0F172A',
  },
  iblMetricGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  iblMetricBox: {
    flex: 1,
  },
  iblMetricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 2,
  },
  iblMetricVal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  iblAlertBanner: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  iblAlertBannerTxt: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
});
