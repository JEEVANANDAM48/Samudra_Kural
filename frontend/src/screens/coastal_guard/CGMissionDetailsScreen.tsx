import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { coastalGuardService, RescueMissionItem } from '../../services/coastalGuardService';

interface CGMissionDetailsScreenProps {
  missionId: number;
  onBack: () => void;
}

export const CGMissionDetailsScreen: React.FC<CGMissionDetailsScreenProps> = ({
  missionId,
  onBack,
}) => {
  const [mission, setMission] = useState<RescueMissionItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);
  const [logNote, setLogNote] = useState<string>('');

  useEffect(() => {
    fetchMission();
  }, [missionId]);

  const fetchMission = async () => {
    setLoading(true);
    try {
      const data = await coastalGuardService.getMissionDetail(missionId);
      setMission(data);
    } catch (e) {
      console.log('[CGMissionDetails] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (nextStatus: string) => {
    if (!mission) return;
    setUpdating(true);
    try {
      const updated = await coastalGuardService.updateMissionStatus(
        mission.id,
        nextStatus,
        logNote.trim() || undefined
      );
      setMission(updated);
      setLogNote('');
      Alert.alert('Status Updated 🛥️', `Mission status changed to ${nextStatus}.`);
    } catch (e) {
      Alert.alert('Update Failed', 'Could not update mission status.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading || !mission) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.cgPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.cgPrimaryDark} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backTxt}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rescue Mission #{mission.id}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Mission Status Top Card */}
        <View style={styles.statusTopCard}>
          <View style={styles.statusHeaderRow}>
            <Text style={styles.vesselIcon}>🛥️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.vesselTitle}>{mission.rescue_vessel}</Text>
              <Text style={styles.squadronSub}>{mission.rescue_team}</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeTxt}>{mission.status}</Text>
            </View>
          </View>
          <Text style={styles.etaText}>⏱️ Estimated Travel Time: {mission.eta_minutes} mins</Text>
        </View>

        {/* Mission Overview Details */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>📋 Deployment Specifications</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Associated SOS ID:</Text>
              <Text style={styles.val}>SOS Alert #{mission.sos_alert_id}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Commanding Officer:</Text>
              <Text style={styles.val}>{mission.officer_name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Rescue Team:</Text>
              <Text style={styles.val}>{mission.rescue_team}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Patrol Vessel:</Text>
              <Text style={styles.val}>{mission.rescue_vessel}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Departure Time:</Text>
              <Text style={styles.val}>{new Date(mission.created_at).toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Operational Timeline Progress */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>⚓ Mission Progress Flow</Text>
          <View style={styles.progressFlow}>
            {['ASSIGNED', 'DEPARTED', 'APPROACHING', 'VICTIM_LOCATED', 'RETURNING', 'COMPLETED'].map((step, idx) => {
              const isCurrent = mission.status === step;
              return (
                <View key={step} style={[styles.progressStep, isCurrent && styles.progressStepCurrent]}>
                  <Text style={styles.stepNum}>{idx + 1}</Text>
                  <Text style={[styles.stepTxt, isCurrent && styles.stepTxtCurrent]}>{step}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Mission Operational Log */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>📝 Tactical Mission Log</Text>
          <Text style={styles.logText}>{mission.notes || 'No dispatch notes logged.'}</Text>

          <View style={styles.addLogBox}>
            <TextInput
              style={styles.logInput}
              placeholder="Add entry to tactical log..."
              placeholderTextColor="#94A3B8"
              value={logNote}
              onChangeText={setLogNote}
            />
          </View>
        </View>

        {/* Status Advancement Action Buttons */}
        {mission.status !== 'COMPLETED' && mission.status !== 'CANCELLED' && (
          <View style={styles.actionsBox}>
            <Text style={styles.actionsTitle}>Advance Mission Status:</Text>
            <View style={styles.btnGrid}>
              <TouchableOpacity
                style={[styles.statusBtn, { backgroundColor: '#0284C7' }]}
                disabled={updating}
                onPress={() => handleUpdateStatus('DEPARTED')}
              >
                <Text style={styles.btnTxt}>⛵ Departed Base</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusBtn, { backgroundColor: '#D97706' }]}
                disabled={updating}
                onPress={() => handleUpdateStatus('APPROACHING')}
              >
                <Text style={styles.btnTxt}>🎯 Approaching SOS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusBtn, { backgroundColor: '#7C3AED' }]}
                disabled={updating}
                onPress={() => handleUpdateStatus('VICTIM_LOCATED')}
              >
                <Text style={styles.btnTxt}>👀 Victim Located</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusBtn, { backgroundColor: '#10B981' }]}
                disabled={updating}
                onPress={() => handleUpdateStatus('COMPLETED')}
              >
                <Text style={styles.btnTxt}>✅ Complete & Resolve</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  statusTopCard: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  vesselIcon: {
    fontSize: 26,
  },
  vesselTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.cgPrimary,
  },
  squadronSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  statusBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusBadgeTxt: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.cgAccent,
  },
  etaText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.cgPrimary,
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(15, 58, 93, 0.12)',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.cgPrimary,
    marginBottom: 12,
  },
  infoGrid: {
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  label: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  val: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  progressFlow: {
    gap: 8,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  progressStepCurrent: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.cgPrimary,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 22,
  },
  stepTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  stepTxtCurrent: {
    fontWeight: '900',
    color: Colors.cgPrimary,
  },
  logText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  addLogBox: {
    marginTop: 4,
  },
  logInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: '#1E293B',
  },
  actionsBox: {
    marginTop: 10,
  },
  actionsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.cgPrimary,
    marginBottom: 8,
  },
  btnGrid: {
    gap: 8,
  },
  statusBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnTxt: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
