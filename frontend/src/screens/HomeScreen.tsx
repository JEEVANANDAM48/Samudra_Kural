import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  Platform,
  Animated,
  Dimensions,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { t, supportedLanguages } from '../i18n';
import { SupportedLanguage, FishermanUser } from '../types';
import { getUserSession, clearSession, saveLanguagePreference } from '../storage/storage';
import { PrimaryButton } from '../components/PrimaryButton';
import { BottomNavBar } from '../components/BottomNavBar';

import { NavigationScreen } from './NavigationScreen';
import { FishingZonesScreen } from './FishingZonesScreen';
import { MyNetsScreen } from './MyNetsScreen';
import { ProfileScreen } from './ProfileScreen';
import { HotspotInfo } from '../services/pfzService';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.82;

interface HomeScreenProps {
  currentLanguage: SupportedLanguage;
  onLogout: () => void;
  onLanguageChange?: (lang: SupportedLanguage) => void;
  onOpenFishingZones?: () => void;
  onOpenNavigation?: () => void;
  onOpenProfile?: () => void;
  initialTab?: string;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  currentLanguage,
  onLogout,
  onLanguageChange,
  onOpenFishingZones,
  onOpenNavigation,
  onOpenProfile,
  initialTab,
}) => {
  const [user, setUser] = useState<FishermanUser | null>(null);
  const [activeTab, setActiveTab] = useState<string>(initialTab || 'nav');
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotInfo | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isLangModalOpen, setIsLangModalOpen] = useState<boolean>(false);

  // Slide animation for side menu drawer
  const drawerAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;

  useEffect(() => {
    loadUser();
  }, [activeTab]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const loadUser = async () => {
    const session = await getUserSession();
    if (session) {
      setUser(session);
    }
  };

  const openMenuDrawer = () => {
    setIsDrawerOpen(true);
    Animated.timing(drawerAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeMenuDrawer = () => {
    Animated.timing(drawerAnim, {
      toValue: DRAWER_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setIsDrawerOpen(false);
    });
  };

  const handleTabPress = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === 'bot') {
      Alert.alert(
        'Ask Bot (AI Chatbot)',
        'Samudra Kural AI Voice & Text Marine Assistant will be available in the upcoming release.'
      );
    } else if (tabId === 'sos') {
      Alert.alert(
        'Emergency SOS',
        'Distress beacon signal transmitted to Coast Guard and nearest vessels.'
      );
    }
  };

  const handleLogout = async () => {
    closeMenuDrawer();
    await clearSession();
    onLogout();
  };

  // Find native name of current language
  const currentLangObj = supportedLanguages.find((l) => l.code === currentLanguage);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} translucent={false} />
      
      {/* Top Header Banner with comfortable top spacing and Top-Right Hamburger Menu on ALL pages */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.titleContainer}>
            <Text style={styles.appTitle}>{t('homeTitle', currentLanguage)}</Text>
            <Text style={styles.welcomeText}>
              {t('homeWelcome', currentLanguage)}, {user?.name || 'Fisherman User'}!
            </Text>
            <Text style={styles.appSubtitle}>{t('homeSubtitle', currentLanguage)}</Text>
          </View>

          {/* Three Lines Top-Right Hamburger Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={openMenuDrawer}
            style={styles.hamburgerButton}
          >
            <Text style={styles.hamburgerIcon}>☰</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.mainContainer}>
        {activeTab === 'nets' && <MyNetsScreen />}
        
        {activeTab === 'nav' && (
          <NavigationScreen
            currentLanguage={currentLanguage}
            initialTarget={selectedHotspot}
            onBack={() => setActiveTab('nets')}
            onOpenMap={() => setActiveTab('fishing')}
            onOpenProfile={openMenuDrawer}
            onTabPress={handleTabPress}
            hideTopHeader={true}
          />
        )}
        
        {activeTab === 'fishing' && (
          <FishingZonesScreen
            currentLanguage={currentLanguage}
            initialTarget={selectedHotspot}
            onBack={() => setActiveTab('nav')}
            onNavigateToHotspot={(spot) => {
              setSelectedHotspot(spot);
              setActiveTab('nav');
            }}
            onTabPress={handleTabPress}
            hideTopHeader={true}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileScreen
            currentLanguage={currentLanguage}
            onBack={() => setActiveTab('nets')}
            onLogout={handleLogout}
            hideTopHeader={true}
          />
        )}

        {activeTab !== 'nets' && activeTab !== 'nav' && activeTab !== 'fishing' && activeTab !== 'profile' && (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.featureCard}>
              <View style={styles.cardTop}>
                {activeTab === 'bot' ? (
                  <Image
                    source={require('../../assets/chatbot-logo.png')}
                    style={styles.botFeatureLogo}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.featureIcon}>🆘</Text>
                )}
                <Text style={styles.featureTitle}>
                  {activeTab === 'bot' ? 'Ask Bot (AI Chatbot)' : 'Emergency SOS'}
                </Text>
              </View>

              <View style={styles.noticeBox}>
                <Text style={styles.noticeTitle}>Marine Utility Portal</Text>
                <Text style={styles.noticeText}>
                  {t('comingSoon', currentLanguage)}. Access official INCOIS ocean forecasts, Sea Surface Temperature (SST), Chlorophyll-a layers, and Potential Fishing Zones.
                </Text>

                {onOpenNavigation && (
                  <TouchableOpacity
                    style={{
                      backgroundColor: Colors.primary,
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      marginTop: 14,
                      alignItems: 'center',
                      width: '100%',
                    }}
                    onPress={onOpenNavigation}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' }}>
                      🧭 Open Marine Navigation & Destination Target
                    </Text>
                  </TouchableOpacity>
                )}

                {onOpenFishingZones && (
                  <TouchableOpacity
                    style={{
                      backgroundColor: Colors.secondary,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 10,
                      marginTop: 10,
                      alignItems: 'center',
                      width: '100%',
                    }}
                    onPress={onOpenFishingZones}
                  >
                    <Text style={{ color: Colors.primaryDark, fontSize: 14, fontWeight: 'bold' }}>
                      🐟 Open INCOIS Fishing Zones Map
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>
        )}
      </View>

      {/* Floating Bottom Navigation Bar */}
      <BottomNavBar
        activeTab={activeTab}
        onTabPress={handleTabPress}
        currentLanguage={currentLanguage}
      />

      {/* Side Menu Drawer Slide Overlay */}
      {isDrawerOpen && (
        <View style={StyleSheet.absoluteFill}>
          {/* Backdrop Overlay */}
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={closeMenuDrawer}
          />

          {/* Sliding Menu Drawer */}
          <Animated.View
            style={[
              styles.drawerContainer,
              { transform: [{ translateX: drawerAnim }] },
            ]}
          >
            <SafeAreaView style={{ flex: 1 }}>
              {/* Drawer Header */}
              <View style={styles.drawerHeader}>
                <Text style={styles.drawerHeaderTitle}>Menu & Profile</Text>
                <TouchableOpacity
                  onPress={closeMenuDrawer}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.drawerBody} showsVerticalScrollIndicator={false}>
                {/* Complete Fisherman Profile Info Card */}
                <View style={styles.profileSection}>
                  <View style={styles.profileAvatar}>
                    <Text style={styles.avatarText}>👤</Text>
                  </View>

                  <View style={styles.verifiedBadgeDrawer}>
                    <Text style={styles.verifiedBadgeDrawerTxt}>✓ VERIFIED FISHERMAN</Text>
                  </View>

                  <Text style={styles.profileName}>{user?.name || 'K. Veeraraghavan'}</Text>
                  <Text style={styles.profilePhone}>{user?.phone || '+91 98401 23456'}</Text>

                  <TouchableOpacity
                    style={styles.fullProfileDrawerBtn}
                    onPress={() => {
                      closeMenuDrawer();
                      setActiveTab('profile');
                    }}
                  >
                    <Text style={styles.fullProfileDrawerBtnTxt}>
                      View & Edit Full Fisherman Profile
                    </Text>
                  </TouchableOpacity>

                  {/* Official Fisherman Specs List */}
                  <View style={{ width: '100%', marginTop: 12 }}>
                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Emergency SOS:</Text>
                      <Text style={styles.infoBoxValueHighlight}>{user?.emergencyPhone || '+91 94440 99999'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Vessel / Boat:</Text>
                      <Text style={styles.infoBoxValue}>{user?.vesselName || 'Sea King IX'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Registration Number:</Text>
                      <Text style={styles.infoBoxValueBadge}>{user?.vesselRegistration || 'TN-01-MM-8492'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Home Port:</Text>
                      <Text style={styles.infoBoxValue}>{user?.homePort || 'Kasimedu Harbour, Chennai'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>License Number:</Text>
                      <Text style={styles.infoBoxValue}>{user?.licenseNumber || 'IND-TN-2024-94021'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Aadhaar / ID:</Text>
                      <Text style={styles.infoBoxValue}>{user?.aadhaarNumber || 'XXXX-XXXX-8492'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Address:</Text>
                      <Text style={styles.infoBoxValue}>{user?.address || 'Harbour Main Road'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Pincode:</Text>
                      <Text style={styles.infoBoxValue}>{user?.pincode || '600013'}</Text>
                    </View>
                  </View>
                </View>

                {/* Settings / Language Info */}
                <View style={styles.menuSection}>
                  <Text style={styles.menuSectionTitle}>App Settings</Text>
                  
                  <TouchableOpacity
                    style={styles.menuItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      setIsLangModalOpen(true);
                    }}
                  >
                    <Text style={styles.menuItemLabel}>Language</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.menuItemValue}>
                        {currentLangObj ? `${currentLangObj.nativeName} (${currentLangObj.englishName})` : 'Tamil'}
                      </Text>
                      <Text style={{ color: Colors.primary, fontSize: 16, fontWeight: '900' }}>›</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Logout Action */}
                <View style={styles.logoutWrapper}>
                  <PrimaryButton
                    title={t('logout', currentLanguage)}
                    variant="outline"
                    onPress={handleLogout}
                  />
                </View>
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </View>
      )}

      {/* Interactive App Language Selection Modal */}
      <Modal
        visible={isLangModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsLangModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select App Language</Text>
                <Text style={styles.modalSubtitle}>Choose your preferred marine portal language</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsLangModalOpen(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.langListScroll} showsVerticalScrollIndicator={false}>
              {supportedLanguages.map((langOption) => {
                const isSelected = langOption.code === currentLanguage;
                return (
                  <TouchableOpacity
                    key={langOption.code}
                    style={[
                      styles.langCard,
                      isSelected && styles.langCardSelected,
                    ]}
                    activeOpacity={0.8}
                    onPress={async () => {
                      setIsLangModalOpen(false);
                      if (onLanguageChange) {
                        onLanguageChange(langOption.code);
                      } else {
                        await saveLanguagePreference(langOption.code);
                      }
                      Alert.alert(
                        'Language Updated',
                        `Samudra Kural app language set to ${langOption.nativeName} (${langOption.englishName}).`
                      );
                    }}
                  >
                    <View style={styles.langTextGroup}>
                      <Text style={[styles.langNativeName, isSelected && styles.langTextSelected]}>
                        {langOption.nativeName}
                      </Text>
                      <Text style={[styles.langEnglishName, isSelected && styles.langSubSelected]}>
                        {langOption.englishName}
                      </Text>
                    </View>

                    {isSelected && (
                      <View style={styles.checkBadge}>
                        <Text style={styles.checkBadgeTxt}>✓ ACTIVE</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
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
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 6 : 10,
    paddingBottom: 12,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flex: 1,
    marginRight: 10,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.textLight,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  welcomeText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.secondary,
    marginBottom: 1,
  },
  appSubtitle: {
    fontSize: 12,
    color: '#B0ECE8',
    fontWeight: '600',
  },
  hamburgerButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  hamburgerIcon: {
    fontSize: 22,
    color: Colors.textLight,
    fontWeight: '900',
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  scrollContent: {
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 110,
  },
  featureCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 2,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardTop: {
    alignItems: 'center',
    marginBottom: 20,
  },
  featureIcon: {
    fontSize: 58,
    marginBottom: 12,
  },
  botFeatureLogo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    marginBottom: 12,
    borderWidth: 2.5,
    borderColor: Colors.primary,
  },
  featureTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
  },
  noticeBox: {
    backgroundColor: Colors.secondary,
    padding: 18,
    borderRadius: 18,
    width: '100%',
    alignItems: 'center',
  },
  noticeTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.primaryDark,
    marginBottom: 6,
  },
  noticeText: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '600',
  },

  /* Side Menu Drawer Styles */
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(13, 37, 38, 0.65)',
  },
  drawerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: DRAWER_WIDTH,
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 20,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.secondaryDark,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 24,
  },
  drawerHeaderTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.textLight,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.textLight,
  },
  drawerBody: {
    padding: 20,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: Colors.background,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  profileAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2.5,
    borderColor: Colors.primary,
  },
  avatarText: {
    fontSize: 38,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  profilePhone: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  infoBox: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0ECEC',
  },
  infoBoxLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textSecondary,
    flex: 1,
  },
  infoBoxValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'right',
    flex: 1.2,
  },
  verifiedBadgeDrawer: {
    backgroundColor: 'rgba(0, 168, 150, 0.15)',
    borderColor: Colors.primary,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 6,
  },
  verifiedBadgeDrawerTxt: {
    color: Colors.primaryDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  fullProfileDrawerBtn: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondaryDark,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginTop: 6,
    width: '100%',
  },
  fullProfileDrawerBtnTxt: {
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
  },
  infoBoxValueHighlight: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.error,
    textAlign: 'right',
  },
  infoBoxValueBadge: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.primaryDark,
    backgroundColor: Colors.secondary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  infoBoxValueActive: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.success,
  },
  menuSection: {
    marginBottom: 24,
  },
  menuSectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  menuItemLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  menuItemValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  logoutWrapper: {
    marginTop: 10,
  },
  /* Language Modal Styles */
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
    maxHeight: '82%',
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
  langListScroll: {
    marginTop: 8,
  },
  langCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderColor: Colors.border,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  langCardSelected: {
    backgroundColor: 'rgba(0, 95, 96, 0.1)',
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  langTextGroup: {
    flex: 1,
  },
  langNativeName: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 2,
  },
  langEnglishName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  langTextSelected: {
    color: Colors.primaryDark,
  },
  langSubSelected: {
    color: Colors.primary,
  },
  checkBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  checkBadgeTxt: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
});
