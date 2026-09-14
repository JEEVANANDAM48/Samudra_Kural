import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import {
  coastalGuardService,
  SOSAlertItem,
  RiskZoneItem,
  RescueMissionItem,
} from '../../services/coastalGuardService';
import { CoastalGuardMapComponent } from '../../components/CoastalGuardMapComponent';

interface CGMarineMapScreenProps {
  onBack: () => void;
}

export const CGMarineMapScreen: React.FC<CGMarineMapScreenProps> = ({ onBack }) => {
  const [sosAlerts, setSosAlerts] = useState<SOSAlertItem[]>([]);
  const [riskZones, setRiskZones] = useState<RiskZoneItem[]>([]);
  const [missions, setMissions] = useState<RescueMissionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchMapData();
  }, []);

  const fetchMapData = async () => {
    setLoading(true);
    try {
      const [alerts, zones, mList] = await Promise.all([
        coastalGuardService.getSOSAlerts('ALL'),
        coastalGuardService.getRiskZones(),
        coastalGuardService.getMissions('ALL'),
      ]);
      setSosAlerts(alerts);
      setRiskZones(zones);
      setMissions(mList);
    } catch (e) {
      console.log('[CGMarineMap] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.cgPrimaryDark} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backTxt}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Full Marine Map</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchMapData}>
          <Text style={styles.refreshIcon}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Map Content */}
      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.cgPrimary} />
            <Text style={styles.loadingTxt}>Loading Tactical Marine Coordinates...</Text>
          </View>
        ) : (
          <CoastalGuardMapComponent
            height="100%"
            sosAlerts={sosAlerts}
            riskZones={riskZones}
            missions={missions}
          />
        )}
      </View>

      {/* Map Legend */}
      <View style={styles.legendBar}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
          <Text style={styles.legendTxt}>SOS Alert</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#0284C7' }]} />
          <Text style={styles.legendTxt}>Patrol Boat</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.legendTxt}>HQ Station</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.legendTxt}>Risk Zone</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.cgBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cgPrimaryDark,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    paddingVertical: 4,
  },
  backTxt: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  refreshBtn: {
    padding: 4,
  },
  refreshIcon: {
    fontSize: 16,
  },
  mapContainer: {
    flex: 1,
    margin: 12,
  },
  loadingBox: {
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
  legendBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.cgSurface,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
});
