import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { saveCGOfficerSession } from '../../storage/storage';

interface CGLoginScreenProps {
  onLoginSuccess: (officerData?: any) => void;
  onNavigateToFishermanLogin: () => void;
}

export const CGLoginScreen: React.FC<CGLoginScreenProps> = ({
  onLoginSuccess,
  onNavigateToFishermanLogin,
}) => {
  const [officerId, setOfficerId] = useState<string>('CG-8841-TN');
  const [station, setStation] = useState<string>('Chennai Command HQ Station');
  const [securityPin, setSecurityPin] = useState<string>('884412');
  const [rank, setRank] = useState<string>('Commander (ICG)');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFillDemo = () => {
    setOfficerId('CG-8841-TN');
    setStation('Chennai Command HQ Station');
    setRank('Commander (ICG)');
    setSecurityPin('884412');
    setErrorMsg(null);
  };

  const handleOfficerLogin = async () => {
    setErrorMsg(null);
    if (!officerId.trim()) {
      setErrorMsg('Please enter your Officer Service ID / Badge Number.');
      return;
    }
    if (!securityPin.trim() || securityPin.length < 4) {
      setErrorMsg('Please enter a valid 6-digit Security PIN.');
      return;
    }

    setLoading(true);
    await saveCGOfficerSession({
      officerId: officerId.trim(),
      rank,
      station: station.trim() || 'Chennai Command HQ Station',
    });
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        'Officer Authenticated 🛡️',
        `Welcome, ${rank} (${officerId}). Command HQ System Access Granted.`
      );
      onLoginSuccess({
        officerId,
        rank,
        station,
      });
    }, 600);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.cgPrimaryDark} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header Banner */}
          <View style={styles.header}>
            <Text style={styles.brandingApp}>SAMUDRA KURAL</Text>
            <Text style={styles.brandingSub}>Coastal Guard Officer Portal</Text>
            <Text style={styles.brandingTagline}>Safer Seas, Stronger Communities</Text>
          </View>

          {/* Officer Form Card */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.badgeIcon}>🛡️</Text>
              <View>
                <Text style={styles.cardTitle}>Officer Command Login</Text>
                <Text style={styles.cardSub}>Authorized Maritime Emergency Access</Text>
              </View>
            </View>

            {errorMsg && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
              </View>
            )}

            {/* Quick Demo Fill Button */}
            <TouchableOpacity style={styles.demoFillBtn} activeOpacity={0.8} onPress={handleFillDemo}>
              <Text style={styles.demoFillTxt}>⚡ Auto-Fill Official Demo Credentials</Text>
            </TouchableOpacity>

            {/* 1. Officer Service ID */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Officer Service ID / Badge No.</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. CG-8841-TN"
                placeholderTextColor="#94A3B8"
                value={officerId}
                onChangeText={setOfficerId}
                autoCapitalize="characters"
              />
            </View>

            {/* 2. Officer Rank / Role */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Officer Rank / Designation</Text>
              <View style={styles.rankChipsRow}>
                {['Commander (ICG)', 'Patrol Officer', 'Station Chief'].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.rankChip, rank === r && styles.rankChipActive]}
                    onPress={() => setRank(r)}
                  >
                    <Text style={[styles.rankTxt, rank === r && styles.rankTxtActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 3. Command HQ Station */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Assigned Command Station</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Chennai Command HQ Station"
                placeholderTextColor="#94A3B8"
                value={station}
                onChangeText={setStation}
              />
            </View>

            {/* 4. Security PIN */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>6-Digit Security PIN</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter 6-digit PIN"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                keyboardType="numeric"
                maxLength={6}
                value={securityPin}
                onChangeText={setSecurityPin}
              />
            </View>

            {/* Login Submit Button */}
            <TouchableOpacity
              style={styles.loginBtn}
              activeOpacity={0.8}
              disabled={loading}
              onPress={handleOfficerLogin}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginBtnTxt}>AUTHENTICATE & ENTER COMMAND HQ ➔</Text>
              )}
            </TouchableOpacity>

            {/* Switch to Fisherman Login Link */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.switchLink}
              onPress={onNavigateToFishermanLogin}
            >
              <Text style={styles.switchTxt}>🎣 Switch to Fisherman Login</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Security Notice */}
          <View style={styles.securityNotice}>
            <Text style={styles.noticeIcon}>🔒</Text>
            <Text style={styles.noticeTxt}>
              Restricted to authorized Indian Coast Guard officers and emergency response dispatchers.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.cgPrimaryDark,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 20,
    paddingBottom: 30,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  brandingApp: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  brandingSub: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
    marginTop: 2,
  },
  brandingTagline: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  card: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  badgeIcon: {
    fontSize: 32,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.cgPrimary,
  },
  cardSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 12,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  demoFillBtn: {
    backgroundColor: '#E0F2FE',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  demoFillTxt: {
    color: Colors.cgPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    fontWeight: '600',
  },
  rankChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  rankChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  rankChipActive: {
    backgroundColor: Colors.cgPrimary,
    borderColor: Colors.cgPrimaryDark,
  },
  rankTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  rankTxtActive: {
    color: '#FFFFFF',
  },
  loginBtn: {
    backgroundColor: Colors.cgPrimary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: Colors.cgPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnTxt: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  switchLink: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  switchTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  noticeIcon: {
    fontSize: 14,
  },
  noticeTxt: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
});
