import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Colors } from '../theme/colors';
import { FishingNet, CreateNetPayload } from '../types/net';
import { NetCard } from '../components/NetCard';
import { AddNetModal } from '../components/AddNetModal';
import { NetDriftDetailModal } from '../components/NetDriftDetailModal';
import { fetchActiveNets, createFishingNet } from '../services/netService';

export const MyNetsScreen: React.FC = () => {
  const [nets, setNets] = useState<FishingNet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [selectedNet, setSelectedNet] = useState<FishingNet | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);

  useEffect(() => {
    loadNets();
  }, []);

  const loadNets = async () => {
    try {
      const data = await fetchActiveNets();
      setNets(data);
    } catch (err: any) {
      console.log('Error fetching nets, using offline state:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadNets();
  };

  const handleCreateNet = async (payload: CreateNetPayload) => {
    const created = await createFishingNet(payload);
    setNets((prev) => [created, ...prev]);
    Alert.alert('Net Deployed', `"${created.name}" is now being monitored with drift prediction.`);
  };

  const handleViewDrift = (net: FishingNet) => {
    setSelectedNet(net);
    setDetailModalVisible(true);
  };

  return (
    <View style={styles.container}>
      {/* Top Action Bar */}
      <View style={styles.actionBar}>
        <View>
          <Text style={styles.pageTitle}>MY NETS</Text>
          <Text style={styles.pageSubtitle}>Your active fishing nets & estimated drift</Text>
        </View>

        <TouchableOpacity
          style={styles.addNetBtn}
          activeOpacity={0.8}
          onPress={() => setAddModalVisible(true)}
        >
          <Text style={styles.addNetBtnText}>+ ADD NEW NET</Text>
        </TouchableOpacity>
      </View>

      {/* Nets List */}
      {loading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingLabel}>Loading deployed nets...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollList}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />}
        >
          {nets.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🕸️</Text>
              <Text style={styles.emptyTitle}>No Active Nets Deployed</Text>
              <Text style={styles.emptyDesc}>
                Deploy a floating gill or drifting net to start real-time drift estimation based on INCOIS and Copernicus ocean currents.
              </Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => setAddModalVisible(true)}
              >
                <Text style={styles.emptyActionBtnText}>+ ADD YOUR FIRST NET</Text>
              </TouchableOpacity>
            </View>
          ) : (
            nets.map((item) => (
              <NetCard
                key={item.id}
                net={item}
                onViewDrift={handleViewDrift}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Add Net Modal */}
      <AddNetModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSubmit={handleCreateNet}
      />

      {/* Net Drift Details Modal */}
      <NetDriftDetailModal
        net={selectedNet}
        visible={detailModalVisible}
        onClose={() => setDetailModalVisible(false)}
        onNetUpdated={loadNets}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: 0.5,
  },
  pageSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addNetBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  addNetBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  loadingArea: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLabel: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  scrollList: {
    paddingBottom: 40,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginTop: 10,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyActionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyActionBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
