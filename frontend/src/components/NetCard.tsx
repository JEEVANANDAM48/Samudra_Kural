import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { FishingNet } from '../types/net';
import { useLanguage } from '../i18n';

interface NetCardProps {
  net: FishingNet;
  onViewDrift: (net: FishingNet) => void;
}

export const NetCard: React.FC<NetCardProps> = ({ net, onViewDrift }) => {
  const { t, tNetType } = useLanguage();

  const movementText =
    net.estimated_movement_km !== undefined && net.estimated_movement_km !== null
      ? `~${net.estimated_movement_km} km`
      : t('loading');

  const searchAreaText = net.search_area_description || t('loading');

  const statusKey =
    net.status === 'ACTIVE'
      ? 'active'
      : net.status === 'RETRIEVED'
      ? 'retrieved'
      : net.status === 'LOST'
      ? 'lost'
      : 'archived';

  return (
    <View style={styles.card}>
      {/* Top Header Row */}
      <View style={styles.topRow}>
        <View style={styles.titleArea}>
          <View>
            <Text style={styles.netName}>{net.name}</Text>
            <Text style={styles.netType}>{tNetType(net.net_type_display || net.net_type)}</Text>
          </View>
        </View>

        <View style={[styles.statusBadge, net.status === 'ACTIVE' ? styles.activeBadge : styles.inactiveBadge]}>
          <Text style={[styles.statusText, net.status === 'ACTIVE' ? styles.activeStatusText : styles.inactiveStatusText]}>
            {t(statusKey)}
          </Text>
        </View>
      </View>

      {/* Info Grid */}
      <View style={styles.bodyGrid}>
        <View style={styles.infoCol}>
          <Text style={styles.label}>{t('deployment')}</Text>
          <Text style={styles.valueHighlight}>{net.elapsed_time_formatted}</Text>
        </View>

        <View style={styles.infoCol}>
          <Text style={styles.label}>{t('estimatedMovement')}</Text>
          <Text style={styles.valueHighlight}>{movementText}</Text>
        </View>
      </View>

      {/* Probable Search Area & Likely Direction Side-by-Side Row */}
      <View style={styles.bottomRow}>
        <View style={styles.searchAreaBox}>
          <Text style={styles.searchAreaLabel}>{t('probableSearchArea')}</Text>
          <Text style={styles.searchAreaValue} numberOfLines={2}>{searchAreaText}</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.viewDriftButton}
          onPress={() => onViewDrift(net)}
        >
          <Text style={styles.viewDriftText}>🌊 {t('likelyDirection')} ➔</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginVertical: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF6F6',
    paddingBottom: 10,
  },
  titleArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  netName: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
  },
  netType: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadge: {
    backgroundColor: '#E8F8F5',
  },
  inactiveBadge: {
    backgroundColor: '#EAECEE',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeStatusText: {
    color: '#1E824C',
  },
  inactiveStatusText: {
    color: '#7F8C8D',
  },
  bodyGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoCol: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  valueHighlight: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 2,
  },
  searchAreaBox: {
    flex: 1,
    backgroundColor: Colors.secondary,
    padding: 10,
    borderRadius: 12,
  },
  searchAreaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  searchAreaValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  viewDriftButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewDriftText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
