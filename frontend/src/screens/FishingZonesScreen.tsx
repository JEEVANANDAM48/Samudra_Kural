import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import {
  fetchAutoPFZ,
  fetchPFZLayers,
  SectorAdvisoryResponse,
  HotspotInfo,
  INCOISWMSLayersResponse,
} from '../services/pfzService';
import * as Location from 'expo-location';
import { INCOISMapComponent } from '../components/INCOISMapComponent';
import { BottomNavBar } from '../components/BottomNavBar';
import { SupportedLanguage } from '../types';

const { width } = Dimensions.get('window');

interface FishingZonesScreenProps {
  currentLanguage?: string;
  onBack?: () => void;
  onNavigateToHotspot?: (hotspot: HotspotInfo) => void;
  onTabPress?: (tabId: string) => void;
}

export const FishingZonesScreen: React.FC<FishingZonesScreenProps> = ({
  currentLanguage = 'ta',
  onBack,
  onNavigateToHotspot,
  onTabPress,
}) => {
  const [userLocation, setUserLocation] = useState({ lat: 13.0827, lon: 80.3800 });
  const [advisory, setAdvisory] = useState<SectorAdvisoryResponse | null>(null);
  const [wmsLayers, setWmsLayers] = useState<INCOISWMSLayersResponse | null>(null);
  const [activeLayer, setActiveLayer] = useState<'chl' | 'sst' | 'bathymetry'>('chl');
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch real device GPS position on mount
  useEffect(() => {
    let isMounted = true;
    const getDeviceLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          if (loc && loc.coords && isMounted) {
            setUserLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude });
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
    loadLocationPFZData();
  }, [userLocation.lat, userLocation.lon]);

  const loadLocationPFZData = async () => {
    setLoading(true);
    try {
      const [advData, layerData] = await Promise.all([
        fetchAutoPFZ(userLocation.lat, userLocation.lon),
        fetchPFZLayers().catch(() => null),
      ]);
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

  const handleStartNavigation = (spot: HotspotInfo) => {
    if (onNavigateToHotspot) {
      onNavigateToHotspot(spot);
    } else {
      Alert.alert(
        'Compass Navigation Initiated',
        `Navigating to ${spot.name}\nLat: ${spot.latitude}°N, Lon: ${spot.longitude}°E`
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Potential Fishing Zones</Text>
          <Text style={styles.headerSubtitle}>INCOIS Oceansat-3 & Marine Data</Text>
        </View>
        <View style={styles.incoisBadge}>
          <Text style={styles.incoisBadgeText}>🌊 LIVE DATA</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Loading Indicator */}
        {loading && (
          <View style={styles.refreshingBar}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.refreshingText}>Locating Nearest Fishing Zones & Marine Data...</Text>
          </View>
        )}

        {/* 1. MAP AT TOP: Layer Selector & 600px High-Clarity Interactive Map */}
        <View style={styles.layerSelectorSection}>
          <Text style={styles.sectionTitle}>INCOIS OCEAN MAP (PINCH-TO-ZOOM)</Text>

          <View style={styles.layerToggleGroup}>
            <TouchableOpacity
              style={[styles.layerToggleBtn, activeLayer === 'chl' ? styles.layerToggleBtnActive : styles.layerToggleBtnInactive]}
              onPress={() => setActiveLayer('chl')}
            >
              <Text style={[styles.layerToggleText, activeLayer === 'chl' ? styles.layerToggleTextActive : styles.layerToggleTextInactive]}>
                🌿 Chlorophyll-a
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.layerToggleBtn, activeLayer === 'sst' ? styles.layerToggleBtnActive : styles.layerToggleBtnInactive]}
              onPress={() => setActiveLayer('sst')}
            >
              <Text style={[styles.layerToggleText, activeLayer === 'sst' ? styles.layerToggleTextActive : styles.layerToggleTextInactive]}>
                🌡️ SST Heatmap
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.layerToggleBtn, activeLayer === 'bathymetry' ? styles.layerToggleBtnActive : styles.layerToggleBtnInactive]}
              onPress={() => setActiveLayer('bathymetry')}
            >
              <Text style={[styles.layerToggleText, activeLayer === 'bathymetry' ? styles.layerToggleTextActive : styles.layerToggleTextInactive]}>
                ⚓ Bathymetry
              </Text>
            </TouchableOpacity>
          </View>

          {/* 600px High-Clarity Interactive Ocean Map */}
          {advisory && (
            <INCOISMapComponent
              center={{ lat: userLocation.lat, lon: userLocation.lon }}
              hotspots={advisory.hotspots}
              activeLayer={activeLayer}
              onNavigateToHotspot={handleStartNavigation}
            />
          )}
        </View>

        {/* 2. Advisory Overview Card & 2x2 Indicators Grid */}
        {advisory && (
          <View style={styles.advisoryCard}>
            <View style={styles.advisoryHeader}>
              <View>
                <Text style={styles.advisorySectorName}>📍 {advisory.sector_name}</Text>
                <Text style={styles.advisoryState}>State: {advisory.state} (Auto-Detected GPS)</Text>
              </View>
            </View>

            {/* Oceanographic Metric Cards Grid: 2x2 Side-by-Side Cards */}
            <Text style={styles.metricsHeader}>Ocean Indicators</Text>
            <View style={styles.metricsGrid}>
              {/* Row 1 Left: Sea Surface Temp */}
              <View style={styles.metricItem}>
                <Text style={styles.metricIcon}>🌡️</Text>
                <Text style={styles.metricValue}>
                  {advisory.oceanographic_indicators.sea_surface_temperature}
                </Text>
                <Text style={styles.metricLabel}>Sea Surface Temp (SST)</Text>
              </View>

              {/* Row 1 Right: Chlorophyll-a */}
              <View style={styles.metricItem}>
                <Text style={styles.metricIcon}>🌿</Text>
                <Text style={styles.metricValue}>
                  {advisory.oceanographic_indicators.chlorophyll_a}
                </Text>
                <Text style={styles.metricLabel}>Chlorophyll-a</Text>
              </View>

              {/* Row 2 Left: Wind Speed */}
              <View style={styles.metricItem}>
                <Text style={styles.metricIcon}>💨</Text>
                <Text style={styles.metricValue}>
                  {advisory.oceanographic_indicators.wind_speed_knots}
                </Text>
                <Text style={styles.metricLabel}>Wind Speed</Text>
              </View>

              {/* Row 2 Right: Wave Height */}
              <View style={styles.metricItem}>
                <Text style={styles.metricIcon}>🌊</Text>
                <Text style={styles.metricValue}>
                  {advisory.oceanographic_indicators.wave_height_meters}
                </Text>
                <Text style={styles.metricLabel}>Wave Height</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Floating Bottom Navigation Bar */}
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
    backgroundColor: Colors.primary, // Deep Marine Teal
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
    padding: 12,
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
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 10,
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
    marginBottom: 6,
  },
  advisorySectorName: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  advisoryState: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 1,
  },
  advisorySummary: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 8,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
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
  layerToggleGroup: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  layerToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
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
    fontSize: 12,
    fontWeight: '900',
  },
  layerToggleTextActive: {
    color: '#FFFFFF',
  },
  layerToggleTextInactive: {
    color: Colors.text,
  },
  wmsInfoCard: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 14,
    borderLeftWidth: 5,
    borderLeftColor: Colors.primary,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  wmsTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  wmsDesc: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    marginBottom: 6,
  },
  wmsSource: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  hotspotCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  hotspotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
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
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 3,
  },
  reliabilityBadge: {
    backgroundColor: '#E8F8F5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.success,
  },
  reliabilityScore: {
    color: Colors.success,
    fontSize: 16,
    fontWeight: '900',
  },
  reliabilityLabel: {
    color: Colors.success,
    fontSize: 11,
    fontWeight: '800',
  },
  hotspotDetailsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  detailPill: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.secondaryDark,
  },
  detailPillLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  detailPillValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  speciesHeader: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '700',
  },
  speciesTagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  speciesTag: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.secondaryDark,
  },
  speciesTagText: {
    color: Colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
  },
  navigateButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  navigateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  bottomSpacer: {
    height: 40,
  },
});
