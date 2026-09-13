import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Colors } from '../../theme/colors';

interface CGProfileScreenProps {
  onLogout: () => void;
  onSwitchToFishermanView: () => void;
  hideTopHeader?: boolean;
}

export const CGProfileScreen: React.FC<CGProfileScreenProps> = ({
  onLogout,
  onSwitchToFishermanView,
  hideTopHeader = false,
}) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.cgPrimaryDark} />

      {/* Header */}
      {!hideTopHeader && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Officer Profile & Settings</Text>
          <Text style={styles.headerSub}>Samudra Kural Coastal Guard Command</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Officer Credentials Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarIcon}>👮</Text>
          </View>
          <Text style={styles.officerName}>Cmdr. V. Raman</Text>
          <Text style={styles.officerRank}>Indian Coast Guard Command Officer</Text>
          
          <View style={styles.badgeRow}>
            <View style={styles.idBadge}>
              <Text style={styles.idBadgeTxt}>ID: CG-8841-TN</Text>
            </View>
            <View style={styles.stationBadge}>
              <Text style={styles.stationBadgeTxt}>Chennai HQ Base</Text>
            </View>
          </View>
        </View>

        {/* Official Officer Specifications Card (matching Fisherman Profile Details) */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionHeading}>📋 Official Officer Details</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Emergency Hotline:</Text>
            <Text style={styles.detailValueHighlight}>+91 44 2345 6789</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Command Base HQ:</Text>
            <Text style={styles.detailValue}>Chennai Command Base HQ</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Service Badge ID:</Text>
            <Text style={styles.detailValueBadge}>CG-8841-TN</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Clearance Level:</Text>
            <Text style={styles.detailValue}>Level 5 Master Maritime Command</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Patrol Vessel Unit:</Text>
            <Text style={styles.detailValue}>ICGS Samudra Paheredar (CG-202)</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Officer License No:</Text>
            <Text style={styles.detailValue}>ICG-IND-2024-88410</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Officer Gov Aadhaar:</Text>
            <Text style={styles.detailValue}>XXXX-XXXX-8841</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Base HQ Address:</Text>
            <Text style={styles.detailValue}>Ennore High Road, Kasimedu Port, Chennai</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>HQ Pincode:</Text>
            <Text style={styles.detailValue}>600009</Text>
          </View>
        </View>

        {/* Operational Options */}
        <View style={styles.optionsCard}>
          <Text style={styles.sectionHeading}>⚙️ Operational Settings</Text>

          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => Alert.alert('Officer Profile', 'Officer ID: CG-8841-TN\nStation: Chennai Command HQ')}
          >
            <Text style={styles.optionIcon}>👤</Text>
            <Text style={styles.optionTxt}>Officer Profile & Badges</Text>
            <Text style={styles.arrow}>➔</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => Alert.alert('Emergency Broadcasts', 'Live audio & push siren notifications are ENABLED.')}
          >
            <Text style={styles.optionIcon}>🔔</Text>
            <Text style={styles.optionTxt}>Emergency Siren & Push Alerts</Text>
            <Text style={styles.arrow}>➔</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => Alert.alert('Dispatch Frequency', 'Active SOS polling frequency set to 20 seconds.')}
          >
            <Text style={styles.optionIcon}>📡</Text>
            <Text style={styles.optionTxt}>Live Telemetry Polling Rate</Text>
            <Text style={styles.arrow}>➔</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionItem}
            onPress={onSwitchToFishermanView}
          >
            <Text style={styles.optionIcon}>🎣</Text>
            <Text style={[styles.optionTxt, { color: Colors.primary, fontWeight: '800' }]}>
              Switch to Fisherman App Mode
            </Text>
            <Text style={styles.arrow}>➔</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutItem} onPress={onLogout}>
            <Text style={styles.logoutIcon}>🚪</Text>
            <Text style={styles.logoutTxt}>Log Out of Command Center</Text>
          </TouchableOpacity>
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
  profileCard: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(15, 58, 93, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarBox: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#0284C7',
  },
  avatarIcon: {
    fontSize: 36,
  },
  officerName: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.cgPrimary,
  },
  officerRank: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  idBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  idBadgeTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.cgAccent,
  },
  stationBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  stationBadgeTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  detailsCard: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(15, 58, 93, 0.12)',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
    maxWidth: '60%',
    textAlign: 'right',
  },
  detailValueBadge: {
    fontSize: 11,
    color: '#0284C7',
    backgroundColor: '#E0F2FE',
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  detailValueHighlight: {
    fontSize: 12,
    color: Colors.cgCritical,
    fontWeight: 'bold',
  },
  optionsCard: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(15, 58, 93, 0.12)',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.cgPrimary,
    marginBottom: 14,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  optionIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  optionTxt: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  arrow: {
    fontSize: 12,
    color: '#94A3B8',
  },
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 6,
  },
  logoutIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  logoutTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
});
