import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import {
  coastalGuardService,
  MarineConditionsData,
  RiskZoneItem,
} from '../../services/coastalGuardService';

interface CGMarineConditionsScreenProps {
  hideTopHeader?: boolean;
}

export const CGMarineConditionsScreen: React.FC<CGMarineConditionsScreenProps> = ({
  hideTopHeader = false,
}) => {
  const [conditions, setConditions] = useState<MarineConditionsData | null>(null);
  const [riskZones, setRiskZones] = useState<RiskZoneItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    fetchMarineData();
  }, []);

  const fetchMarineData = async () => {
    setLoading(true);
    try {
      const [cond, zones] = await Promise.all([
        coastalGuardService.getMarineConditions(),
        coastalGuardService.getRiskZones(),
      ]);
      setConditions(cond);
      setRiskZones(zones);
    } catch (e) {
      console.log('[CGMarineConditions] Fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMarineData();
  };

  if (loading || !conditions) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.cgPrimary} />
          <Text style={styles.loadingTxt}>Loading Live Satellite Marine Conditions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.cgPrimaryDark} />

      {/* Header */}
      {!hideTopHeader && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Marine Conditions & Risk</Text>
          <Text style={styles.headerSub}>INCOIS Oceansat-3 & Copernicus Satellite Stream</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.cgPrimary} />
        }
      >
        {/* Overall Risk Level Card (Calculated by Backend Risk Engine) */}
        <View style={[styles.riskBannerCard, { borderColor: conditions.risk_color }]}>
          <View style={styles.riskHeaderRow}>
            <View style={[styles.riskLevelBadge, { backgroundColor: conditions.risk_color }]}>
              <Text style={styles.riskLevelTxt}>{conditions.overall_risk_level}</Text>
            </View>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveTxt}>LIVE TELEMETRY</Text>
            </View>
          </View>

          <Text style={styles.riskTitle}>{conditions.risk_title}</Text>
          <Text style={styles.riskReason}>{conditions.risk_reason}</Text>
          <Text style={styles.sourceTxt}>Source: {conditions.data_source} • {conditions.last_updated}</Text>
        </View>

        {/* Telemetry Matrix Grid */}
        <Text style={styles.sectionHeading}>📊 Live Environmental Telemetry</Text>

        {/* Wind Grid */}
        <View style={styles.telemetryCard}>
          <Text style={styles.cardCatTitle}>🌬️ Wind & Gust Telemetry</Text>
          <View style={styles.telemRow}>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Wind Speed</Text>
              <Text style={styles.telemVal}>{conditions.wind.speed_kmh} km/h</Text>
            </View>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Direction</Text>
              <Text style={styles.telemVal}>{conditions.wind.direction}</Text>
            </View>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Peak Gusts</Text>
              <Text style={styles.telemVal}>{conditions.wind.gust_kmh} km/h</Text>
            </View>
          </View>
        </View>

        {/* Wave Grid */}
        <View style={styles.telemetryCard}>
          <Text style={styles.cardCatTitle}>🌊 Sea Swell & Wave Telemetry</Text>
          <View style={styles.telemRow}>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Wave Height</Text>
              <Text style={[styles.telemVal, { color: conditions.waves.height_m >= 1.5 ? '#EA580C' : '#1E293B' }]}>
                {conditions.waves.height_m} meters
              </Text>
            </View>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Wave Period</Text>
              <Text style={styles.telemVal}>{conditions.waves.period_seconds} sec</Text>
            </View>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Swell Direction</Text>
              <Text style={styles.telemVal}>{conditions.waves.direction}</Text>
            </View>
          </View>
        </View>

        {/* Ocean Hydrodynamics Grid */}
        <View style={styles.telemetryCard}>
          <Text style={styles.cardCatTitle}>🛥️ Ocean Hydrodynamics & Currents</Text>
          <View style={styles.telemRow}>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Surface Temp</Text>
              <Text style={styles.telemVal}>{conditions.ocean.surface_temp_c}°C</Text>
            </View>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Current Speed</Text>
              <Text style={styles.telemVal}>{conditions.ocean.current_speed_knots} knots</Text>
            </View>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Drift Course</Text>
              <Text style={styles.telemVal}>{conditions.ocean.current_direction}</Text>
            </View>
          </View>
        </View>

        {/* Weather & Squall Warnings */}
        <View style={styles.telemetryCard}>
          <Text style={styles.cardCatTitle}>🌦️ Coastal Weather & Visibility</Text>
          <View style={styles.telemRow}>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Condition</Text>
              <Text style={styles.telemVal}>{conditions.weather.condition}</Text>
            </View>
            <View style={styles.telemItem}>
              <Text style={styles.telemLabel}>Visibility</Text>
              <Text style={styles.telemVal}>{conditions.weather.visibility_km} km</Text>
            </View>
          </View>
          {conditions.weather.warning ? (
            <View style={styles.warningBox}>
              <Text style={styles.warningTxt}>⚠️ Advisory: {conditions.weather.warning}</Text>
            </View>
          ) : null}
        </View>

        {/* High Risk Marine Zones */}
        <Text style={styles.sectionHeading}>⚠️ High-Risk Marine Polygons</Text>
        {riskZones.map((zone) => (
          <View key={zone.zone_id} style={styles.zoneCard}>
            <View style={styles.zoneHeader}>
              <Text style={styles.zoneName}>{zone.name}</Text>
              <View style={[styles.zoneBadge, { backgroundColor: zone.risk_level === 'HIGH' ? '#FEE2E2' : '#FEF3C7' }]}>
                <Text style={[styles.zoneBadgeTxt, { color: zone.risk_level === 'HIGH' ? '#DC2626' : '#D97706' }]}>
                  {zone.risk_level} RISK
                </Text>
              </View>
            </View>
            <Text style={styles.zoneReason}>Reason: {zone.reason}</Text>
            <Text style={styles.zoneValid}>Valid until: {zone.valid_until}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.cgBackground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingTxt: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.cgPrimary,
    fontWeight: '600',
  },
  header: {
    backgroundColor: Colors.cgPrimaryDark,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  headerSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  riskBannerCard: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  riskHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  riskLevelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  riskLevelTxt: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  riskTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.cgPrimary,
    marginBottom: 4,
  },
  riskReason: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 8,
  },
  sourceTxt: {
    fontSize: 11,
    color: '#64748B',
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.cgPrimary,
    marginBottom: 10,
    marginTop: 6,
  },
  telemetryCard: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 58, 93, 0.12)',
  },
  cardCatTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.cgPrimary,
    marginBottom: 10,
  },
  telemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  telemItem: {
    flex: 1,
  },
  telemLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  telemVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 2,
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 8,
    marginTop: 10,
  },
  warningTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  zoneCard: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  zoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  zoneName: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.cgPrimary,
  },
  zoneBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  zoneBadgeTxt: {
    fontSize: 9,
    fontWeight: '900',
  },
  zoneReason: {
    fontSize: 11,
    color: '#475569',
  },
  zoneValid: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 4,
  },
});
