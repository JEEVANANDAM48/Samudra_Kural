import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Colors } from '../theme/colors';
import { FishingNet, TrajectoryResponse, EnvironmentalState } from '../types/net';
import { DriftMap } from './DriftMap';
import { EnvironmentCard } from './EnvironmentCard';
import { DataSourceCard } from './DataSourceCard';
import { fetchNetDetails, regeneratePrediction } from '../services/netService';

interface NetDriftDetailModalProps {
  net: FishingNet | null;
  visible: boolean;
  onClose: () => void;
  onNetUpdated?: () => void;
}

export const NetDriftDetailModal: React.FC<NetDriftDetailModalProps> = ({
  net,
  visible,
  onClose,
  onNetUpdated,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState<number>(0);
  const [trajectory, setTrajectory] = useState<TrajectoryResponse | null>(null);
  const [environment, setEnvironment] = useState<EnvironmentalState | null>(null);

  const loadingMessages = [
    'Reading ocean conditions...',
    'Calculating net drift...',
    'Preparing search area...',
  ];

  useEffect(() => {
    if (visible && net) {
      loadDetails();
    }
  }, [visible, net]);

  useEffect(() => {
    let interval: any;
    if (loading || refreshing) {
      interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 1200);
    }
    return () => clearInterval(interval);
  }, [loading, refreshing]);

  const loadDetails = async () => {
    if (!net) return;
    setLoading(true);
    try {
      const data = await fetchNetDetails(net.id);
      setTrajectory(data.trajectory);
      setEnvironment(data.current_environment);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to load drift details.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshPrediction = async () => {
    if (!net) return;
    setRefreshing(true);
    try {
      const updatedTraj = await regeneratePrediction(net.id);
      setTrajectory(updatedTraj);
      if (onNetUpdated) onNetUpdated();
      Alert.alert('Drift Updated', 'Recalculated trajectory using latest ocean forecasts.');
    } catch (err: any) {
      Alert.alert('Refresh Failed', err.message || 'Could not update prediction.');
    } finally {
      setRefreshing(false);
    }
  };

  if (!net) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleArea}>
            <Text style={styles.headerTitle}>{net.name}</Text>
            <Text style={styles.headerSubtitle}>{net.net_type_display}</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={handleRefreshPrediction}
              disabled={refreshing}
            >
              <Text style={styles.refreshText}>{refreshing ? '⏳' : '🔄 Refresh'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>{loadingMessages[loadingMessageIndex]}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Safety Disclaimer Banner */}
            <View style={styles.warningCard}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <Text style={styles.warningText}>
                This is a predicted drift area, not an exact net location. Actual drift may vary with local sea conditions.
              </Text>
            </View>

            {/* Quick Status Highlights */}
            <View style={styles.statusGrid}>
              <View style={styles.statusTile}>
                <Text style={styles.tileLabel}>Deployment</Text>
                <Text style={styles.tileValue}>{net.elapsed_time_formatted}</Text>
              </View>

              <View style={styles.statusTile}>
                <Text style={styles.tileLabel}>Est. Movement</Text>
                <Text style={styles.tileValue}>
                  {trajectory ? `~${trajectory.latest_predicted_point.cumulative_distance_km} km` : '--'}
                </Text>
              </View>

              <View style={styles.statusTile}>
                <Text style={styles.tileLabel}>Confidence</Text>
                <Text style={[styles.tileValue, { color: Colors.primary }]}>
                  {trajectory ? trajectory.search_area.confidence : 'MEDIUM'}
                </Text>
              </View>
            </View>

            {/* Probable Search Area Callout */}
            {trajectory && (
              <View style={styles.searchCallout}>
                <Text style={styles.searchCalloutTitle}>🎯 Probable Search Area</Text>
                <Text style={styles.searchCalloutSector}>
                  {trajectory.search_area.sector_description}
                </Text>
                <Text style={styles.searchCalloutRadius}>
                  Uncertainty radius: ±{trajectory.search_area.uncertainty_radius_km} km around predicted coordinate
                </Text>
              </View>
            )}

            {/* Interactive Drift Map */}
            {trajectory && (
              <DriftMap
                points={trajectory.points}
                searchArea={trajectory.search_area}
                releaseLat={net.release_latitude}
                releaseLon={net.release_longitude}
              />
            )}

            {/* Ocean Conditions Card */}
            <EnvironmentCard environment={environment} />

            {/* Checkpoint Timeline */}
            {trajectory && trajectory.points.length > 0 && (
              <View style={styles.timelineCard}>
                <Text style={styles.timelineHeader}>⏱️ Drift Progress Checkpoints</Text>
                {trajectory.points.map((pt, idx) => (
                  <View key={pt.step_number} style={styles.timelineItem}>
                    <View style={styles.timelineBullet}>
                      <View style={[styles.bulletInner, idx === trajectory.points.length - 1 && styles.bulletActive]} />
                    </View>
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineRowTop}>
                        <Text style={styles.timelineTime}>{pt.prediction_time_ist}</Text>
                        <Text style={styles.timelineDist}>
                          {idx === 0 ? 'Released' : `+${pt.cumulative_distance_km} km`}
                        </Text>
                      </View>
                      <Text style={styles.timelineSub}>
                        {pt.drift_direction_cardinal} at {pt.drift_speed_mps.toFixed(2)} m/s ({pt.drift_speed_kmh.toFixed(0)} km/h)
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Data Provenance Card */}
            <DataSourceCard
              dataSources={trajectory?.data_sources}
              dataAgeMinutes={environment?.data_age_minutes || 10}
              modelVersion={trajectory?.model_version}
            />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.primary,
  },
  titleArea: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B0ECE8',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  scrollBody: {
    padding: 18,
    paddingBottom: 40,
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: '#FEF9E7',
    borderWidth: 1.5,
    borderColor: '#F9E79F',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#7D6608',
    lineHeight: 17,
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statusTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  tileValue: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.text,
  },
  searchCallout: {
    backgroundColor: Colors.secondary,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.secondaryDark,
    marginBottom: 12,
  },
  searchCalloutTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  searchCalloutSector: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 2,
  },
  searchCalloutRadius: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginVertical: 8,
  },
  timelineHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  timelineBullet: {
    width: 14,
    alignItems: 'center',
    marginRight: 10,
    marginTop: 4,
  },
  bulletInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  bulletActive: {
    backgroundColor: '#FF5252',
    transform: [{ scale: 1.3 }],
  },
  timelineContent: {
    flex: 1,
  },
  timelineRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  timelineTime: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  timelineDist: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  timelineSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
