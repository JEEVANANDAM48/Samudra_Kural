import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { FishermanUser, SupportedLanguage } from '../types';
import { getUserSession, saveUserSession, clearSession } from '../storage/storage';
import { supportedLanguages, t } from '../i18n';
import { PrimaryButton } from '../components/PrimaryButton';

interface ProfileScreenProps {
  currentLanguage: SupportedLanguage;
  onBack: () => void;
  onLogout: () => void;
  onLanguageChange?: (lang: SupportedLanguage) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  currentLanguage,
  onBack,
  onLogout,
  onLanguageChange,
}) => {
  const [user, setUser] = useState<FishermanUser>({
    name: 'K. Veeraraghavan',
    phone: '+91 98401 23456',
    emergencyPhone: '+91 94440 99999',
    vesselName: 'Sea King IX (கடல் அரசன் 9)',
    vesselRegistration: 'TN-01-MM-8492',
    vesselType: 'Mechanized Motorized Trawler',
    homePort: 'Kasimedu Fishing Harbour, Chennai',
    licenseNumber: 'IND-TN-2024-94021',
    aadhaarNumber: 'XXXX-XXXX-8492',
    address: 'No. 42, Harbour Main Road, Kasimedu',
    pincode: '600013',
    vhfRadioActive: true,
    lifeJacketsCount: 6,
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  // Form Fields for Editing Profile
  const [editName, setEditName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editEmergencyPhone, setEditEmergencyPhone] = useState<string>('');
  const [editVesselName, setEditVesselName] = useState<string>('');
  const [editVesselRegistration, setEditVesselRegistration] = useState<string>('');
  const [editVesselType, setEditVesselType] = useState<string>('');
  const [editHomePort, setEditHomePort] = useState<string>('');
  const [editAddress, setEditAddress] = useState<string>('');
  const [editPincode, setEditPincode] = useState<string>('');

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const savedUser = await getUserSession();
      if (savedUser) {
        setUser((prev) => ({
          ...prev,
          ...savedUser,
          name: savedUser.name || prev.name,
          phone: savedUser.phone || prev.phone,
          emergencyPhone: savedUser.emergencyPhone || prev.emergencyPhone,
          address: savedUser.address || prev.address,
          pincode: savedUser.pincode || prev.pincode,
          vesselName: savedUser.vesselName || prev.vesselName,
          vesselRegistration: savedUser.vesselRegistration || prev.vesselRegistration,
          vesselType: savedUser.vesselType || prev.vesselType,
          homePort: savedUser.homePort || prev.homePort,
          licenseNumber: savedUser.licenseNumber || prev.licenseNumber,
          aadhaarNumber: savedUser.aadhaarNumber || prev.aadhaarNumber,
        }));
      }
    } catch (err) {}
  };

  const openEditModal = () => {
    setEditName(user.name);
    setEditPhone(user.phone);
    setEditEmergencyPhone(user.emergencyPhone || '');
    setEditVesselName(user.vesselName || '');
    setEditVesselRegistration(user.vesselRegistration || '');
    setEditVesselType(user.vesselType || '');
    setEditHomePort(user.homePort || '');
    setEditAddress(user.address || '');
    setEditPincode(user.pincode || '');
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Required Field', 'Please enter your Full Name.');
      return;
    }

    const updatedUser: FishermanUser = {
      ...user,
      name: editName.trim(),
      phone: editPhone.trim(),
      emergencyPhone: editEmergencyPhone.trim() || user.emergencyPhone,
      vesselName: editVesselName.trim() || user.vesselName,
      vesselRegistration: editVesselRegistration.trim() || user.vesselRegistration,
      vesselType: editVesselType.trim() || user.vesselType,
      homePort: editHomePort.trim() || user.homePort,
      address: editAddress.trim() || user.address,
      pincode: editPincode.trim() || user.pincode,
    };

    setUser(updatedUser);
    await saveUserSession(updatedUser);
    setIsEditModalOpen(false);
    Alert.alert('Profile Saved', 'Your fisherman profile and vessel details have been updated successfully.');
  };

  const handleLogoutPress = async () => {
    Alert.alert(
      'Logout Confirmation',
      'Are you sure you want to log out of SamudraKural?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await clearSession();
            onLogout();
          },
        },
      ]
    );
  };

  const currentLangObj = supportedLanguages.find((l) => l.code === currentLanguage);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Fisherman Profile & Vessel Specs</Text>
          <Text style={styles.headerSubtitle}>Official Identity, Fleet & Marine Safety</Text>
        </View>
        <TouchableOpacity style={styles.editHeaderBtn} onPress={openEditModal}>
          <Text style={styles.editHeaderBtnText}>✏️ Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* 1. HERO FISHERMAN IDENTITY CARD */}
        <View style={styles.profileHeroCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarIcon}>👤</Text>
            </View>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedBadgeText}>✓ VERIFIED FISHERMAN</Text>
            </View>
          </View>

          <Text style={styles.fishermanName}>{user.name}</Text>
          <Text style={styles.fishermanPhone}>📱 {user.phone}</Text>

          <View style={styles.quickGrid}>
            <View style={styles.quickGridBox}>
              <Text style={styles.quickGridLabel}>EMERGENCY SOS</Text>
              <Text style={styles.quickGridValue}>{user.emergencyPhone || '+91 94440 99999'}</Text>
            </View>

            <View style={styles.quickGridBox}>
              <Text style={styles.quickGridLabel}>FISHERMAN ID / AADHAAR</Text>
              <Text style={styles.quickGridValue}>{user.aadhaarNumber || 'XXXX-8492'}</Text>
            </View>
          </View>
        </View>

        {/* 2. VESSEL & FLEET SPECIFICATIONS CARD */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>🛥️ VESSEL & LICENSE DETAILS</Text>
            <TouchableOpacity onPress={openEditModal}>
              <Text style={styles.sectionEditLink}>Edit Vessel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Boat / Vessel Name:</Text>
            <Text style={styles.detailValue}>{user.vesselName || 'Sea King IX'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Vessel Registration #:</Text>
            <Text style={styles.detailValueBadge}>{user.vesselRegistration || 'TN-01-MM-8492'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Boat / Craft Type:</Text>
            <Text style={styles.detailValue}>{user.vesselType || 'Mechanized Trawler'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Home Harbour / Landing:</Text>
            <Text style={styles.detailValue}>{user.homePort || 'Kasimedu Harbour, Chennai'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Fishing License No:</Text>
            <Text style={styles.detailValue}>{user.licenseNumber || 'IND-TN-2024-94021'}</Text>
          </View>
        </View>

        {/* 3. OFFSHORE SAFETY EQUIPMENT CHECKLIST */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🛟 OFFSHORE SAFETY EQUIPMENT</Text>

          <View style={styles.safetyItem}>
            <Text style={styles.safetyIcon}>📡</Text>
            <View style={styles.safetyTextGroup}>
              <Text style={styles.safetyTitle}>VHF Marine Radio Transceiver</Text>
              <Text style={styles.safetyStatusActive}>
                {user.vhfRadioActive !== false ? '✅ Active on Channel 16 Distress Frequency' : '⚠️ Inactive'}
              </Text>
            </View>
          </View>

          <View style={styles.safetyItem}>
            <Text style={styles.safetyIcon}>🛟</Text>
            <View style={styles.safetyTextGroup}>
              <Text style={styles.safetyTitle}>Life Jackets / Floating Gear</Text>
              <Text style={styles.safetyStatusActive}>
                ✅ {user.lifeJacketsCount || 6} SOLAS Verified Jackets Onboard
              </Text>
            </View>
          </View>

          <View style={styles.safetyItem}>
            <Text style={styles.safetyIcon}>📟</Text>
            <View style={styles.safetyTextGroup}>
              <Text style={styles.safetyTitle}>Emergency DAT / EPIRB Transponder</Text>
              <Text style={styles.safetyStatusActive}>✅ Installed (ISRO Satellite Distress Transponder)</Text>
            </View>
          </View>

          <View style={styles.safetyItem}>
            <Text style={styles.safetyIcon}>🧭</Text>
            <View style={styles.safetyTextGroup}>
              <Text style={styles.safetyTitle}>GPS Hardware Navigational Receiver</Text>
              <Text style={styles.safetyStatusActive}>✅ Live Smartphone Hardware Lock Active</Text>
            </View>
          </View>
        </View>

        {/* 4. RESIDENTIAL ADDRESS & PORT LOCATION CARD */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🏠 RESIDENTIAL & PORT ADDRESS</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Street Address:</Text>
            <Text style={styles.detailValue}>{user.address || 'Kasimedu Harbour Road'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Pincode & District:</Text>
            <Text style={styles.detailValue}>{user.pincode || '600013'}, Chennai District</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Maritime State:</Text>
            <Text style={styles.detailValue}>Tamil Nadu, India</Text>
          </View>
        </View>

        {/* 5. APP SETTINGS & LANGUAGE */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>⚙️ APP PREFERENCES & LANGUAGE</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Current App Language:</Text>
            <Text style={styles.detailValueHighlight}>
              {currentLangObj ? `${currentLangObj.nativeName} (${currentLangObj.englishName})` : 'தமிழ் (Tamil)'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>INCOIS Marine Advisories:</Text>
            <Text style={styles.detailValueActive}>✅ Live Regional Alerts Enabled</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Emergency SOS Broadcast:</Text>
            <Text style={styles.detailValueActive}>✅ Auto-Beacon Transmit Enabled</Text>
          </View>
        </View>

        {/* 6. LOGOUT BUTTON */}
        <View style={styles.logoutSection}>
          <PrimaryButton
            title="🚪 Logout Account"
            variant="outline"
            onPress={handleLogoutPress}
            style={styles.logoutButtonOverride}
            textStyle={{ color: '#C0392B', fontWeight: '900' }}
          />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* EDIT PROFILE MODAL */}
      <Modal
        visible={isEditModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit Fisherman Profile</Text>
                <Text style={styles.modalSubtitle}>Update personal, vessel & contact details</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsEditModalOpen(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.formSectionTitle}>PERSONAL & CONTACT INFO</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name*</Text>
                <TextInput
                  style={styles.textInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="e.g. K. Veeraraghavan"
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 6 }]}>
                  <Text style={styles.inputLabel}>Primary Phone*</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editPhone}
                    onChangeText={setEditPhone}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, marginLeft: 6 }]}>
                  <Text style={styles.inputLabel}>Emergency Phone*</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editEmergencyPhone}
                    onChangeText={setEditEmergencyPhone}
                    keyboardType="phone-pad"
                    placeholder="e.g. +91 94440 99999"
                  />
                </View>
              </View>

              <Text style={[styles.formSectionTitle, { marginTop: 14 }]}>VESSEL & HARBOUR SPECS</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Boat / Vessel Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={editVesselName}
                  onChangeText={setEditVesselName}
                  placeholder="e.g. Sea King IX"
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 6 }]}>
                  <Text style={styles.inputLabel}>Vessel Reg #</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editVesselRegistration}
                    onChangeText={setEditVesselRegistration}
                    placeholder="e.g. TN-01-MM-8492"
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, marginLeft: 6 }]}>
                  <Text style={styles.inputLabel}>Craft Type</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editVesselType}
                    onChangeText={setEditVesselType}
                    placeholder="e.g. Motorized Trawler"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Home Harbour / Landing Centre</Text>
                <TextInput
                  style={styles.textInput}
                  value={editHomePort}
                  onChangeText={setEditHomePort}
                  placeholder="e.g. Kasimedu Harbour, Chennai"
                />
              </View>

              <Text style={[styles.formSectionTitle, { marginTop: 14 }]}>ADDRESS & RESIDENCE</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Residential Street Address</Text>
                <TextInput
                  style={styles.textInput}
                  value={editAddress}
                  onChangeText={setEditAddress}
                  placeholder="e.g. Harbour Main Road"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Pincode</Text>
                <TextInput
                  style={styles.textInput}
                  value={editPincode}
                  onChangeText={setEditPincode}
                  keyboardType="numeric"
                  placeholder="e.g. 600013"
                />
              </View>

              <TouchableOpacity style={styles.saveProfileBtn} onPress={handleSaveProfile}>
                <Text style={styles.saveProfileBtnText}>💾 Save Profile Changes</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 12,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: '#B0ECE8',
    fontSize: 12,
    fontWeight: '600',
  },
  editHeaderBtn: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.secondaryDark,
  },
  editHeaderBtnText: {
    color: Colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  container: {
    padding: 16,
  },
  profileHeroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: Colors.primary,
    marginBottom: 6,
  },
  avatarIcon: {
    fontSize: 38,
  },
  verifiedBadge: {
    backgroundColor: 'rgba(0, 168, 150, 0.15)',
    borderColor: Colors.primary,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  verifiedBadgeText: {
    color: Colors.primaryDark,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  fishermanName: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 2,
    textAlign: 'center',
  },
  fishermanPhone: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
  },
  quickGridBox: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickGridLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },
  quickGridValue: {
    color: Colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionEditLink: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECEC',
  },
  detailLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  detailValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    flex: 1.2,
  },
  detailValueBadge: {
    color: Colors.primaryDark,
    fontSize: 14,
    fontWeight: '900',
    backgroundColor: Colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.secondaryDark,
  },
  detailValueHighlight: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  detailValueActive: {
    color: Colors.success,
    fontSize: 13,
    fontWeight: '800',
  },
  safetyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  safetyIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  safetyTextGroup: {
    flex: 1,
  },
  safetyTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  safetyStatusActive: {
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  logoutSection: {
    marginTop: 8,
    marginBottom: 20,
  },
  logoutButtonOverride: {
    borderColor: '#C0392B',
    borderWidth: 2,
  },
  bottomSpacer: {
    height: 40,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 30, 40, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.border,
    marginBottom: 12,
  },
  modalTitle: {
    color: Colors.primaryDark,
    fontSize: 20,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  modalCloseText: {
    color: Colors.textSecondary,
    fontSize: 18,
    fontWeight: '900',
  },
  formScroll: {
    marginTop: 4,
  },
  formSectionTitle: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
    letterSpacing: 0.6,
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderColor: Colors.border,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  saveProfileBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 20,
  },
  saveProfileBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
});
