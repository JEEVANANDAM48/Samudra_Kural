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
  CoastalGuardDashboardData,
  SOSAlertItem,
  RiskZoneItem,
  RescueMissionItem,
} from '../../services/coastalGuardService';
import { CoastalGuardMapComponent } from '../../components/CoastalGuardMapComponent';

interface CGDashboardScreenProps {
  onNavigateToSOSList: () => void;
  onNavigateToSOSDetail: (id: number) => void;
  onNavigateToMissions: () => void;
  onNavigateToMarineMap: () => void;
  onNavigateToMarineData: () => void;
  onOpenProfile: () => void;
  hideTopHeader?: boolean;
}

export const CGDashboardScreen: React.FC<CGDashboardScreenProps> = ({
  onNavigateToSOSList,
  onNavigateToSOSDetail,
  onNavigateToMissions,
  onNavigateToMarineMap,
  onNavigateToMarineData,
  onOpenProfile,
  hideTopHeader = false,
}) => {
  const [dashboardData, setDashboardData] = useState<CoastalGuardDashboardData | null>(null);
  const [latestAlerts, setLatestAlerts] = useState<SOSAlertItem[]>([]);
  const [riskZones, setRiskZones] = useState<RiskZoneItem[]>([]);
  const [missions, setMissions] = useState<RescueMissionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('');
  const [newSOSNotification, setNewSOSNotification] = useState<SOSAlertItem | null>(null);

  useEffect(() => {
    fetchData();

    // Subscribe to instant SOS alert transmissions and status updates
    const unsubscribe = coastalGuardService.subscribeToSOS((updatedAlert) => {
      if (updatedAlert.status === 'NEW') {
        setNewSOSNotification(updatedAlert);
      }
      fetchData(true);
    });

    // 20-second automatic polling for live SOS emergency monitoring
    const timer = setInterval(() => {
      fetchData(true);
    }, 20000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const fetchData = async (isSilent: boolean = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [dash, alerts, zones, mList] = await Promise.all([
        coastalGuardService.getDashboard(),
        coastalGuardService.getSOSAlerts('ALL'),
        coastalGuardService.getRiskZones().catch(() => []),
        coastalGuardService.getMissions('ALL').catch(() => []),
      ]);
      setDashboardData(dash);
      setLatestAlerts(alerts);
      setRiskZones(zones);
      setMissions(mList);
      setLastUpdatedTime(new Date().toLocaleTimeString());
    } catch (e) {
      console.log('[CG Dashboard] Fetch failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return { bg: '#FEE2E2', border: '#DC2626', text: '#DC2626' };
      case 'HIGH':
        return { bg: '#FFEDD5', border: '#EA580C', text: '#EA580C' };
      case 'MEDIUM':
        return { bg: '#FEF3C7', border: '#F59E0B', text: '#D97706' };
      default:
        return { bg: '#E0F2FE', border: '#0284C7', text: '#0284C7' };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.cgPrimaryDark} />

      {/* Top Header Banner */}
      {!hideTopHeader && (
        <View style={styles.header}>
          <View>
            <Text style={styles.brandingApp}>SAMUDRA KURAL</Text>
            <Text style={styles.brandingSub}>Coastal Guard Command Center</Text>
            <Text style={styles.brandingTagline}>Safer Seas, Stronger Communities</Text>
          </View>

          <TouchableOpacity style={styles.profileBtn} onPress={onOpenProfile}>
            <Text style={styles.profileIcon}>👮</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.cgPrimary} />
        }
      >
        {/* Instant SOS Distress Alert Notification Banner */}
        {newSOSNotification && (
          <View style={styles.emergencyNotifCard}>
            <View style={styles.emergencyNotifHeader}>
              <View style={styles.emergencyNotifTitleGroup}>
                <Text style={styles.emergencyNotifIcon}>🚨</Text>
                <Text style={styles.emergencyNotifTitle}>CRITICAL SOS DISTRESS ALERT RECEIVED!</Text>
              </View>
              <TouchableOpacity onPress={() => setNewSOSNotification(null)}>
                <Text style={styles.emergencyNotifClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.emergencyNotifBody}>
              Vessel <Text style={{ fontWeight: 'bold' }}>{newSOSNotification.boat?.name || 'Fisherman Unit'}</Text> transmitted <Text style={{ fontWeight: 'bold', color: '#EF4444' }}>{newSOSNotification.emergency_type}</Text> at {newSOSNotification.latitude.toFixed(4)}°N, {newSOSNotification.longitude.toFixed(4)}°E.
            </Text>

            <TouchableOpacity
              style={styles.dispatchActionBtn}
              activeOpacity={0.85}
              onPress={() => {
                const alertId = newSOSNotification.id;
                setNewSOSNotification(null);
                onNavigateToSOSDetail(alertId);
              }}
            >
              <Text style={styles.dispatchActionTxt}>Dispatch Rescue Team & View Incident ➔</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Officer Greeting */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingTitle}>Good Morning, Officer</Text>
        </View>

        {/* Command Center Dashboard Cards Matrix */}
        <View style={styles.metricsGrid}>
          {/* Active SOS Card */}
          <TouchableOpacity
            style={[styles.metricCard, styles.cardCritical]}
            activeOpacity={0.8}
            onPress={onNavigateToSOSList}
          >
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardIcon}>🚨</Text>
              <Text style={styles.cardBadgeTxt}>ACTION REQ</Text>
            </View>
            <Text style={styles.cardVal}>{dashboardData?.active_sos_count ?? 0}</Text>
            <Text style={styles.cardLabel}>Active SOS Alerts</Text>
            <Text style={styles.cardSub}>
              {dashboardData?.critical_alerts_count ?? 0} Critical Emergency
            </Text>
          </TouchableOpacity>

          {/* Rescue Missions Card */}
          <TouchableOpacity
            style={[styles.metricCard, styles.cardNavy]}
            activeOpacity={0.8}
            onPress={onNavigateToMissions}
          >
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardIcon}>🛥️</Text>
            </View>
            <Text style={styles.cardVal}>{dashboardData?.active_rescue_missions_count ?? 0}</Text>
            <Text style={styles.cardLabel}>Rescue Missions</Text>
            <Text style={styles.cardSub}>Vessels Deployed</Text>
          </TouchableOpacity>

          {/* Resolved Incidents Card */}
          <TouchableOpacity
            style={styles.metricCard}
            activeOpacity={0.8}
            onPress={onNavigateToSOSList}
          >
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardIcon}>✅</Text>
            </View>
            <Text style={styles.cardVal}>{dashboardData?.resolved_today_count ?? 0}</Text>
            <Text style={styles.cardLabel}>Resolved Today</Text>
            <Text style={styles.cardSub}>Safely Rescued</Text>
          </TouchableOpacity>

          {/* High-Risk Marine Zones Card */}
          <TouchableOpacity
            style={styles.metricCard}
            activeOpacity={0.8}
            onPress={onNavigateToMarineData}
          >
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardIcon}>⚠️</Text>
            </View>
            <Text style={styles.cardVal}>{dashboardData?.high_risk_zones_count ?? 0}</Text>
            <Text style={styles.cardLabel}>High-Risk Zones</Text>
            <Text style={styles.cardSub}>Sea Swell Hazards</Text>
          </TouchableOpacity>
        </View>

        {/* Live Marine Map Section Card */}
        <View style={styles.mapCardSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderTitleGroup}>
              <Text style={styles.sectionTitle}>🗺️ Live Coastal Satellite Map</Text>
            </View>
            <TouchableOpacity style={styles.viewMapBtn} onPress={onNavigateToMarineMap}>
              <Text style={styles.viewMapTxt}>Full Screen ➔</Text>
            </TouchableOpacity>
          </View>

          <CoastalGuardMapComponent
            height={650}
            sosAlerts={latestAlerts}
            riskZones={riskZones}
            missions={missions}
          />
        </View>
      </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  brandingApp: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandingSub: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  brandingTagline: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '500',
  },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
  },
  profileIcon: {
    fontSize: 20,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F2942',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  livePulseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  statusTxt: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  timeTxt: {
    color: '#94A3B8',
    fontSize: 10,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  /* Emergency Notification Card Styles */
  emergencyNotifCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
    borderWidth: 2,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  emergencyNotifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  emergencyNotifTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  emergencyNotifIcon: {
    fontSize: 22,
  },
  emergencyNotifTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#991B1B',
    letterSpacing: 0.3,
  },
  emergencyNotifClose: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#991B1B',
    padding: 4,
  },
  emergencyNotifBody: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 18,
    marginBottom: 14,
  },
  dispatchActionBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  dispatchActionTxt: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  greetingSection: {
    marginBottom: 16,
  },
  greetingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.cgPrimary,
  },
  greetingSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    width: '48%',
    backgroundColor: Colors.cgSurface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(15, 58, 93, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardCritical: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  cardNavy: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardIcon: {
    fontSize: 20,
  },
  cardBadgeTxt: {
    fontSize: 9,
    fontWeight: '900',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  cardVal: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.cgPrimary,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 2,
  },
  cardSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  mapCardSection: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeaderTitleGroup: {
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.cgPrimary,
  },
  sectionSub: {
    fontSize: 11,
    color: '#64748B',
  },
  viewMapBtn: {
    backgroundColor: Colors.cgPrimary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  viewMapTxt: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  alertsSection: {
    marginBottom: 20,
  },
  viewAllTxt: {
    color: Colors.cgAccent,
    fontSize: 13,
    fontWeight: '700',
  },
  sosCard: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 58, 93, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sosTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sosTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sosTypeIcon: {
    fontSize: 22,
  },
  sosEmergencyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.cgPrimary,
  },
  sosBoatName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginTop: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  priorityTxt: {
    fontSize: 10,
    fontWeight: '900',
  },
  sosDesc: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 10,
  },
  sosFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  sosGpsTxt: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  sosStatusTxt: {
    fontSize: 11,
    color: '#64748B',
  },
  emptyCard: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.cgPrimary,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
});
