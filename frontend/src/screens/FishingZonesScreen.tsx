import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '../theme/colors';
import {
  fetchAutoPFZ,
  fetchNearbyPFZ,
  fetchPFZLayers,
  getInitialPFZAdvisory,
  getRealSatellitePFZHotspots,
  SectorAdvisoryResponse,
  HotspotInfo,
  INCOISWMSLayersResponse,
} from '../services/pfzService';
import * as Location from 'expo-location';
import { INCOISMapComponent } from '../components/INCOISMapComponent';
import { BottomNavBar } from '../components/BottomNavBar';
import { SupportedLanguage } from '../types';
import { useLanguage } from '../i18n';
import { checkIBLProximity } from '../services/iblService';

const { width } = Dimensions.get('window');

interface FishingZonesScreenProps {
  currentLanguage?: string;
  initialTarget?: HotspotInfo | null;
  onBack?: () => void;
  onNavigateToHotspot?: (hotspot: HotspotInfo) => void;
  onTabPress?: (tabId: string) => void;
  hideTopHeader?: boolean;
}

export const FishingZonesScreen: React.FC<FishingZonesScreenProps> = ({
  currentLanguage = 'ta',
  initialTarget,
  onBack,
  onNavigateToHotspot,
  onTabPress,
  hideTopHeader = false,
}) => {
  const { t, tDirection, language } = useLanguage();
  const [userLocation, setUserLocation] = useState({ lat: 13.0827, lon: 80.3800 });
  const [advisory, setAdvisory] = useState<SectorAdvisoryResponse>(() => getInitialPFZAdvisory(13.0827, 80.3800));
  const [wmsLayers, setWmsLayers] = useState<INCOISWMSLayersResponse | null>(null);
  const [activeLayer, setActiveLayer] = useState<'chl' | 'sst' | 'bathymetry' | 'ibl'>('chl');
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotInfo | null>(null);
  const [selectedNavigationTarget, setSelectedNavigationTarget] = useState<HotspotInfo | null>(initialTarget || null);
  const [showAllZones, setShowAllZones] = useState<boolean>(false);

  const [liveSpeedKnots, setLiveSpeedKnots] = useState<number>(0.0);

  const scrollViewRef = useRef<ScrollView>(null);

  // Fetch real device GPS position on mount
  useEffect(() => {
    let isMounted = true;
    const getDeviceLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const lastLoc = await Location.getLastKnownPositionAsync();
          if (lastLoc && lastLoc.coords && isMounted) {
            setUserLocation({ lat: lastLoc.coords.latitude, lon: lastLoc.coords.longitude });
            const speedKts = (lastLoc.coords.speed && lastLoc.coords.speed > 0.2) ? Number((lastLoc.coords.speed * 1.94384).toFixed(1)) : 0.0;
            setLiveSpeedKnots(speedKts);
          }
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (loc && loc.coords && isMounted) {
            setUserLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude });
            const speedKts = (loc.coords.speed && loc.coords.speed > 0.2) ? Number((loc.coords.speed * 1.94384).toFixed(1)) : 0.0;
            setLiveSpeedKnots(speedKts);
          }
        }
      } catch (err) {
        console.log('Error getting device location:', err);
      }
    };
    getDeviceLocation();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (initialTarget) {
      setSelectedNavigationTarget(initialTarget);
    }
  }, [initialTarget]);

  useEffect(() => {
    loadLocationPFZData();
    const timer = setInterval(() => {
      loadLocationPFZData();
    }, 4000);
    return () => clearInterval(timer);
  }, [userLocation.lat, userLocation.lon]);

  const loadLocationPFZData = async () => {
    if (!advisory) setLoading(true);
    try {
      const [advData, layerData, nearbySpots] = await Promise.all([
        fetchAutoPFZ(userLocation.lat, userLocation.lon),
        fetchPFZLayers().catch(() => null),
        fetchNearbyPFZ(userLocation.lat, userLocation.lon).catch(() => []),
      ]);

      const allSpots = getRealSatellitePFZHotspots(undefined, userLocation.lat, userLocation.lon);
      advData.hotspots = allSpots;
      setAdvisory(advData);
      if (layerData) {
        setWmsLayers(layerData);
      }
    } catch (error) {
      console.error('Failed to load location PFZ data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCoordinates = async (spot: HotspotInfo) => {
    const coordStr = `${spot.latitude.toFixed(4)}, ${spot.longitude.toFixed(4)}`;
    try {
      await Clipboard.setStringAsync(coordStr);
      Alert.alert(
        t('coordinatesCopied'),
        `${t('vesselCoordinates')}: ${coordStr}`
      );
    } catch (err) {
      Alert.alert(t('coordinatesCopied'), coordStr);
    }
  };

  const handleStartNavigation = (spot: HotspotInfo) => {
    setSelectedHotspot(null);
    setSelectedNavigationTarget(spot);

    // Scroll to top where map is located to display live route trajectory
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  // Route metrics calculations
  const routeDistanceKm = selectedNavigationTarget
    ? calculateHaversineKm(userLocation.lat, userLocation.lon, selectedNavigationTarget.latitude, selectedNavigationTarget.longitude)
    : 0;
  const routeDistanceNM = routeDistanceKm / 1.852;
  const cruiseSpeedKnots = 8.5;
  const vesselSpeedKnots = liveSpeedKnots;
  const effectiveSpeedKnots = liveSpeedKnots > 0 ? liveSpeedKnots : cruiseSpeedKnots;
  const routeEtaMins = routeDistanceNM > 0 ? Math.round((routeDistanceNM / effectiveSpeedKnots) * 60) : 0;
  const routeBearing = selectedNavigationTarget
    ? calculateBearingDeg(userLocation.lat, userLocation.lon, selectedNavigationTarget.latitude, selectedNavigationTarget.longitude)
    : 0;
  const routeCardinal = degreesToCardinal(routeBearing);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* Header */}
      {!hideTopHeader && (
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Potential Fishing Zone</Text>
            <Text style={styles.headerSubtitle}>INCOIS Oceansat-3 & Marine Data</Text>
          </View>
        </View>
      )}

      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Loading Indicator */}
        {loading && (
          <View style={styles.refreshingBar}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.refreshingText}>{t('loading')}</Text>
          </View>
        )}

        {/* 1. LIVE ROUTE & SPEED TELEMETRY PANEL (WHEN NAVIGATING TO A ZONE) */}
        {selectedNavigationTarget && (
          <View style={styles.routeTelemetryCard}>
            <View style={styles.routeHeaderRow}>
              <View style={styles.routeLiveBadge}>
                <View style={styles.routeLiveDot} />
                <Text style={styles.routeLiveTxt}>{t('mapRouteActive')}</Text>
              </View>
              <TouchableOpacity
                style={styles.stopRouteBtn}
                onPress={() => setSelectedNavigationTarget(null)}
              >
                <Text style={styles.stopRouteTxt}>✕ {t('stopNavigation')}</Text>
              </TouchableOpacity>
            </View>

            {/* From - To Box */}
            <View style={styles.fromToContainer}>
              <View style={styles.fromToItem}>
                <Text style={styles.fromToLabel}>📍 {t('fromGps')}</Text>
                <Text style={styles.fromToVal}>{userLocation.lat.toFixed(4)}° N, {userLocation.lon.toFixed(4)}° E</Text>
              </View>

              <Text style={styles.fromToArrow}>➔</Text>

              <View style={styles.fromToItem}>
                <Text style={styles.fromToLabel}>🎯 {t('toFishingZone')}</Text>
                <Text style={styles.fromToVal} numberOfLines={1}>{selectedNavigationTarget.name}</Text>
                <Text style={styles.fromToSub}>{selectedNavigationTarget.latitude.toFixed(4)}° N, {selectedNavigationTarget.longitude.toFixed(4)}° E</Text>
              </View>
            </View>

            {/* Route Metrics Row: Distance, Speed, ETA, Bearing */}
            <View style={styles.routeMetricsRow}>
              <View style={styles.routeMetricItem}>
                <Text style={styles.routeMetricIcon}>📏</Text>
                <Text style={styles.routeMetricVal}>{routeDistanceKm.toFixed(1)} km</Text>
                <Text style={styles.routeMetricSub}>({routeDistanceNM.toFixed(1)} NM)</Text>
                <Text style={styles.routeMetricLabel}>{t('distance')}</Text>
              </View>

              <View style={styles.routeMetricItem}>
                <Text style={styles.routeMetricIcon}>🛥️</Text>
                <Text style={styles.routeMetricVal}>{vesselSpeedKnots > 0 ? `${vesselSpeedKnots} knots` : '0.0 knots'}</Text>
                <Text style={styles.routeMetricSub}>{vesselSpeedKnots > 0 ? `(${(vesselSpeedKnots * 1.852).toFixed(1)} km/h)` : '(On Shore / Parked)'}</Text>
                <Text style={styles.routeMetricLabel}>{t('vesselSpeed')}</Text>
              </View>

              <View style={styles.routeMetricItem}>
                <Text style={styles.routeMetricIcon}>⏱️</Text>
                <Text style={styles.routeMetricVal}>{routeEtaMins} mins</Text>
                <Text style={styles.routeMetricSub}>(~{(routeEtaMins / 60).toFixed(1)} hrs)</Text>
                <Text style={styles.routeMetricLabel}>{t('estTravelTime')}</Text>
              </View>

              <View style={styles.routeMetricItem}>
                <Text style={styles.routeMetricIcon}>🧭</Text>
                <Text style={styles.routeMetricVal}>{routeBearing.toFixed(0)}° {tDirection(routeCardinal)}</Text>
                <Text style={styles.routeMetricSub}>{t('compassCourse')}</Text>
                <Text style={styles.routeMetricLabel}>{t('bearing')}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Potential Fishing Zones (PFZ) Top Banner Card */}
        <View style={styles.pfzTopBannerCard}>
          <View style={styles.pfzHeaderRow}>
            <View style={styles.pfzTitleGroup}>
              <Text style={styles.pfzTitleIcon}>🐟</Text>
              <View>
                <Text style={styles.pfzMainTitle}>{t('pfzTitle')}</Text>
                <Text style={styles.pfzMainSub}>{t('pfzSubtitle')}</Text>
              </View>
            </View>
          </View>

          {advisory && (
            <View style={styles.pfzMetricsRow}>
              <View style={styles.pfzMetricBox}>
                <Text style={styles.pfzMetricValue}>{advisory.hotspots?.length ?? 0}</Text>
                <Text style={styles.pfzMetricLabel}>{t('hotspotsFound')}</Text>
              </View>
              <View style={styles.pfzMetricBox}>
                <Text style={styles.pfzMetricValue}>{advisory.oceanographic_indicators?.chlorophyll_a ?? '1.45'}</Text>
                <Text style={styles.pfzMetricLabel}>{t('chlorophyllA')}</Text>
              </View>
              <View style={styles.pfzMetricBox}>
                <Text style={styles.pfzMetricValue}>{advisory.oceanographic_indicators?.sea_surface_temperature ?? '28.5°C'}</Text>
                <Text style={styles.pfzMetricLabel}>{t('sstLayer')}</Text>
              </View>
            </View>
          )}
        </View>

        {/* 2. MAP SECTION: Layer Selector & Interactive Ocean Map */}
        <View style={styles.layerSelectorSection}>
          <Text style={styles.sectionTitle}>{t('incoisOceanMap')}</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layerToggleScroll}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.layerToggleBtn, activeLayer === 'chl' ? styles.layerToggleBtnActive : styles.layerToggleBtnInactive]}
              onPress={() => setActiveLayer('chl')}
            >
              <Text style={[styles.layerToggleText, activeLayer === 'chl' ? styles.layerToggleTextActive : styles.layerToggleTextInactive]}>
                Chlorophyll-a
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.layerToggleBtn, activeLayer === 'sst' ? styles.layerToggleBtnActive : styles.layerToggleBtnInactive]}
              onPress={() => setActiveLayer('sst')}
            >
              <Text style={[styles.layerToggleText, activeLayer === 'sst' ? styles.layerToggleTextActive : styles.layerToggleTextInactive]}>
                SST Heatmap
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.layerToggleBtn, activeLayer === 'bathymetry' ? styles.layerToggleBtnActive : styles.layerToggleBtnInactive]}
              onPress={() => setActiveLayer('bathymetry')}
            >
              <Text style={[styles.layerToggleText, activeLayer === 'bathymetry' ? styles.layerToggleTextActive : styles.layerToggleTextInactive]}>
                Bathymetry
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.layerToggleBtn, activeLayer === 'ibl' ? styles.layerToggleBtnActive : styles.layerToggleBtnInactive]}
              onPress={() => setActiveLayer('ibl')}
            >
              <Text style={[styles.layerToggleText, activeLayer === 'ibl' ? styles.layerToggleTextActive : styles.layerToggleTextInactive]}>
                IBL Boundary
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Interactive Ocean Map with Route Line & Copying */}
          {advisory && (
            <INCOISMapComponent
              center={{ lat: userLocation.lat, lon: userLocation.lon }}
              hotspots={advisory.hotspots}
              activeLayer={activeLayer}
              selectedNavigationTarget={selectedNavigationTarget}
              onNavigateToHotspot={handleStartNavigation}
              onSelectHotspot={(spot) => setSelectedHotspot(spot)}
            />
          )}
        </View>

        {/* 3. ACTIVE POTENTIAL FISHING ZONES LIST */}
        {advisory && advisory.hotspots && advisory.hotspots.length > 0 && (
          <View style={styles.hotspotsSection}>
            <Text style={styles.sectionTitle}>
              {t('activeFishingZones')} ({showAllZones ? advisory.hotspots.length : Math.min(12, advisory.hotspots.length)} of {advisory.hotspots.length})
            </Text>

            {(showAllZones ? advisory.hotspots : advisory.hotspots.slice(0, 12)).map((spot) => {
              const distanceKm = spot.distance_meters
                ? (spot.distance_meters / 1000.0).toFixed(1)
                : '12.4';
              const directionTxt = spot.direction
                ? `${directionTxtFormatted(spot.direction, spot.bearing_degrees)}`
                : tDirection('Northeast');

              const isTargeted = selectedNavigationTarget?.id === spot.id;

              return (
                <TouchableOpacity
                  key={spot.id}
                  style={[styles.hotspotCard, isTargeted && styles.hotspotCardTargeted]}
                  activeOpacity={0.85}
                  onPress={() => setSelectedHotspot(spot)}
                >
                  <View style={styles.hotspotHeader}>
                    <View style={styles.hotspotTitleGroup}>
                      <Text style={styles.hotspotName}>🐟 {spot.name}</Text>
                      <Text style={styles.hotspotCoords}>
                        {t('latitude')}: {spot.latitude.toFixed(4)}° N, {t('longitude')}: {spot.longitude.toFixed(4)}° E
                      </Text>
                    </View>
                  </View>

                  {/* Distance & Depth Info Bar */}
                  <View style={styles.distanceBar}>
                    <Text style={styles.distanceTxt}>
                      📏 {t('distance')}: {distanceKm} km
                    </Text>
                    <Text style={styles.distanceTxt}>
                      ⚓ {t('depth')}: {spot.depth_meters}m
                    </Text>
                  </View>

                  {/* Action Buttons Row: Copy GPS & Navigate */}
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity
                      style={styles.copyBtnCard}
                      onPress={() => handleCopyCoordinates(spot)}
                    >
                      <Text style={styles.copyBtnCardTxt}>Copy GPS</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.navigateButton, isTargeted && styles.navigateButtonActive]}
                      onPress={() => handleStartNavigation(spot)}
                    >
                      <Text style={styles.navigateButtonText}>
                        {isTargeted ? '✓ MAP ROUTE ACTIVE' : 'NAVIGATE'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}

            {advisory.hotspots.length > 12 && (
              <TouchableOpacity
                style={styles.viewAllBtn}
                activeOpacity={0.85}
                onPress={() => setShowAllZones(!showAllZones)}
              >
                <Text style={styles.viewAllBtnTxt}>
                  {showAllZones
                    ? '▲ Show Less'
                    : `🌊 View All (${advisory.hotspots.length} Active Centers) ➔`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Hotspot Full Detail Modal with Copy & Navigation */}
      {selectedHotspot && (
        <Modal
          visible={!!selectedHotspot}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedHotspot(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>🐟 {selectedHotspot.name}</Text>
                  <Text style={styles.modalSub}>
                    {t('pfzSubtitle')}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setSelectedHotspot(null)}
                >
                  <Text style={styles.closeTxt}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Reliability & Distance Banner */}
                <View style={styles.modalBanner}>
                  <View style={styles.modalBannerCol}>
                    <Text style={styles.bannerLabel}>{t('reliability')}</Text>
                    <Text style={styles.bannerScore}>{selectedHotspot.reliability_score}</Text>
                  </View>
                  <View style={styles.modalBannerDivider} />
                  <View style={styles.modalBannerCol}>
                    <Text style={styles.bannerLabel}>{t('distance')} & {t('bearing')}</Text>
                    <Text style={styles.bannerDistance}>
                      {selectedHotspot.distance_meters
                        ? `${(selectedHotspot.distance_meters / 1000.0).toFixed(1)} km`
                        : `${selectedHotspot.latitude.toFixed(3)}°N`}
                    </Text>
                    {selectedHotspot.direction && (
                      <Text style={styles.bannerBearing}>
                        {tDirection(selectedHotspot.direction)} ({selectedHotspot.bearing_degrees?.toFixed(0)}°)
                      </Text>
                    )}
                  </View>
                </View>

                {/* Coordinates Box with Copy Button */}
                <View style={styles.coordBox}>
                  <Text style={styles.coordBoxTitle}>{t('vesselCoordinates')}</Text>
                  <Text style={styles.coordBoxVal}>
                    {t('latitude')}: {selectedHotspot.latitude.toFixed(4)}° N
                  </Text>
                  <Text style={styles.coordBoxVal}>
                    {t('longitude')}: {selectedHotspot.longitude.toFixed(4)}° E
                  </Text>

                  <TouchableOpacity
                    style={styles.modalCopyBtn}
                    onPress={() => handleCopyCoordinates(selectedHotspot)}
                  >
                    <Text style={styles.modalCopyBtnTxt}>
                      📋 {t('copyCoordinates')} ({selectedHotspot.latitude.toFixed(4)}, {selectedHotspot.longitude.toFixed(4)})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Oceanographic Parameters */}
                <Text style={styles.modalSecTitle}>{t('oceanAndVesselTelemetry')}</Text>
                <View style={styles.paramGrid}>
                  <View style={styles.paramItem}>
                    <Text style={styles.paramIcon}>🌡️</Text>
                    <Text style={styles.paramVal}>{selectedHotspot.sst_celsius}°C</Text>
                    <Text style={styles.paramLabel}>{t('sstLayer')}</Text>
                  </View>

                  <View style={styles.paramItem}>
                    <Text style={styles.paramIcon}>🌿</Text>
                    <Text style={styles.paramVal}>{selectedHotspot.chlorophyll_mg_m3} mg/m³</Text>
                    <Text style={styles.paramLabel}>{t('chlorophyllA')}</Text>
                  </View>

                  <View style={styles.paramItem}>
                    <Text style={styles.paramIcon}>⚓</Text>
                    <Text style={styles.paramVal}>{selectedHotspot.depth_meters}m</Text>
                    <Text style={styles.paramLabel}>{t('waterDepth')}</Text>
                  </View>

                  <View style={styles.paramItem}>
                    <Text style={styles.paramIcon}>📡</Text>
                    <Text style={styles.paramVal}>INCOIS</Text>
                    <Text style={styles.paramLabel}>Satellite Data</Text>
                  </View>
                </View>

                {/* Target Fish Species */}
                {selectedHotspot.target_species && (
                  <View style={styles.speciesSection}>
                    <Text style={styles.modalSecTitle}>{t('placeholderFishing')}</Text>
                    <View style={styles.speciesRow}>
                      {selectedHotspot.target_species.map((sp, idx) => (
                        <View key={idx} style={styles.speciesChip}>
                          <Text style={styles.speciesChipTxt}>🐟 {sp}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Direction & Navigation Button */}
                <TouchableOpacity
                  style={styles.modalNavBtn}
                  activeOpacity={0.8}
                  onPress={() => handleStartNavigation(selectedHotspot)}
                >
                  <Text style={styles.modalNavBtnTxt}>
                    🧭 {t('navigateAndShowRoute')}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Floating Bottom Navigation Bar (Only rendered when screen is standalone) */}
      {!hideTopHeader && (
        <BottomNavBar
          activeTab="fishing"
          onTabPress={(tabId) => {
            if (onTabPress) {
              onTabPress(tabId);
            } else if (tabId === 'nav' && onBack) {
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

function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
  return R * c;
}

function calculateBearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

function degreesToCardinal(deg: number): string {
  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
  const index = Math.round((deg % 360) / 45);
  return cardinals[index];
}

function directionTxtFormatted(direction: string, bearing?: number): string {
  if (bearing !== undefined) {
    return `${bearing.toFixed(0)}° ${direction}`;
  }
  return direction;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
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
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#D4F2F0',
    fontSize: 12,
  },
  incoisBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: '#FFFFFF',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  incoisBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 120,
  },

  /* Potential Fishing Zones Top Banner Styles */
  pfzTopBannerCard: {
    backgroundColor: '#E0F2F1',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#0D9488',
    marginBottom: 12,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  pfzHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pfzTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  pfzTitleIcon: {
    fontSize: 22,
  },
  pfzMainTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#042F2C',
    letterSpacing: 0.3,
  },
  pfzMainSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D6E6E',
    marginTop: 1,
  },
  pfzLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 148, 136, 0.15)',
    borderColor: '#0D9488',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  pfzPulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
  },
  pfzBadgeTxt: {
    color: '#042F2C',
    fontSize: 9,
    fontWeight: '800',
  },
  pfzMetricsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(13, 148, 136, 0.25)',
    gap: 6,
  },
  pfzMetricBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.2)',
  },
  pfzMetricValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#042F2C',
    textAlign: 'center',
  },
  pfzMetricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0D6E6E',
    marginTop: 2,
    textAlign: 'center',
  },

  /* Live Route Telemetry Card Styles */
  routeTelemetryCard: {
    backgroundColor: '#0D2526',
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.secondary,
    marginBottom: 16,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  routeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  routeLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 245, 212, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  routeLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.secondary,
    marginRight: 6,
  },
  routeLiveTxt: {
    color: Colors.secondary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  stopRouteBtn: {
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    borderColor: '#E74C3C',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  stopRouteTxt: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '900',
  },
  fromToContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  fromToItem: {
    flex: 1,
  },
  fromToLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#8AC4C1',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  fromToVal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  fromToSub: {
    fontSize: 11,
    color: Colors.secondary,
    fontWeight: '700',
    marginTop: 1,
  },
  fromToArrow: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.secondary,
    marginHorizontal: 10,
  },
  routeMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  routeMetricItem: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  routeMetricIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  routeMetricVal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  routeMetricSub: {
    fontSize: 10,
    color: Colors.secondary,
    fontWeight: '700',
    marginBottom: 2,
    textAlign: 'center',
  },
  routeMetricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8AC4C1',
    textAlign: 'center',
    textTransform: 'uppercase',
  },

  sectionTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 8,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  refreshingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  refreshingText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  advisoryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  advisoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  advisorySectorName: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  advisoryState: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  metricsHeader: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  metricItem: {
    width: '48.5%',
    backgroundColor: Colors.background,
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    elevation: 2,
  },
  metricIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  metricValue: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  metricLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 1,
  },
  layerSelectorSection: {
    marginBottom: 12,
  },
  layerToggleScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 16,
    marginBottom: 10,
  },
  layerToggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  layerToggleBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
  },
  layerToggleBtnInactive: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  layerToggleText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  layerToggleTextActive: {
    color: '#FFFFFF',
  },
  layerToggleTextInactive: {
    color: Colors.text,
  },
  hotspotsSection: {
    marginTop: 6,
  },
  hotspotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderLeftWidth: 5,
    borderLeftColor: Colors.primary,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  hotspotCardTargeted: {
    borderColor: Colors.primary,
    borderLeftColor: Colors.primaryDark,
    borderWidth: 2.5,
    backgroundColor: '#F0FDFA',
  },
  hotspotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  hotspotTitleGroup: {
    flex: 1,
    marginRight: 8,
  },
  hotspotName: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  hotspotCoords: {
    color: Colors.primaryDark,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  reliabilityBadge: {
    backgroundColor: '#E8F8F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.success,
  },
  reliabilityScore: {
    color: Colors.success,
    fontSize: 14,
    fontWeight: '900',
  },
  reliabilityLabel: {
    color: Colors.success,
    fontSize: 10,
    fontWeight: '800',
  },
  distanceBar: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  distanceTxt: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0369A1',
  },
  hotspotDetailsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  detailPill: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailPillLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  detailPillValue: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  copyBtnCard: {
    backgroundColor: '#EBF5FB',
    borderColor: '#3498DB',
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBtnCardTxt: {
    color: '#2980B9',
    fontSize: 13,
    fontWeight: '900',
  },
  navigateButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigateButtonActive: {
    backgroundColor: Colors.primaryDark,
  },
  navigateButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  viewAllBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  viewAllBtnTxt: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  bottomSpacer: {
    height: 40,
  },

  /* Hotspot Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  modalSub: {
    fontSize: 12,
    color: '#B0ECE8',
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTxt: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  modalBody: {
    padding: 18,
  },
  modalBanner: {
    flexDirection: 'row',
    backgroundColor: '#E8F8F5',
    borderWidth: 1.5,
    borderColor: '#2ECC71',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  modalBannerCol: {
    flex: 1,
  },
  modalBannerDivider: {
    width: 1.5,
    backgroundColor: '#2ECC71',
    marginHorizontal: 12,
  },
  bannerLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bannerScore: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E824C',
  },
  bannerDistance: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E824C',
  },
  bannerBearing: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  coordBox: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  coordBoxTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  coordBoxVal: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  modalCopyBtn: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondaryDark,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  modalCopyBtnTxt: {
    color: Colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  modalSecTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  paramGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  paramItem: {
    width: '48%',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  paramIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  paramVal: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.text,
  },
  paramLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  speciesSection: {
    marginBottom: 20,
  },
  speciesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  speciesChip: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.secondaryDark,
  },
  speciesChipTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  modalNavBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  modalNavBtnTxt: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
