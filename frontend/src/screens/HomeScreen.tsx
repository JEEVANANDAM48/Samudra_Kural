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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { t, supportedLanguages } from '../i18n';
import { SupportedLanguage, FishermanUser } from '../types';
import { getUserSession, clearSession } from '../storage/storage';
import { PrimaryButton } from '../components/PrimaryButton';
import { BottomNavBar } from '../components/BottomNavBar';

import { NavigationScreen } from './NavigationScreen';
import { FishingZonesScreen } from './FishingZonesScreen';
import { MyNetsScreen } from './MyNetsScreen';
import { BotScreen } from './BotScreen';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.82;

interface HomeScreenProps {
  currentLanguage: SupportedLanguage;
  onLogout: () => void;
  onOpenFishingZones?: () => void;
  onOpenNavigation?: () => void;
  onOpenProfile?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  currentLanguage,
  onLogout,
  onOpenFishingZones,
  onOpenNavigation,
  onOpenProfile,
}) => {
  const [user, setUser] = useState<FishermanUser | null>(null);
  const [activeTab, setActiveTab] = useState<string>('nets');
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Slide animation for side menu drawer
  const drawerAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;

  useEffect(() => {
    loadUser();
  }, []);

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
    if (tabId === 'nets') {
      // Direct view of My Nets
      return;
    }
    const tabNames: Record<string, string> = {
      nav: t('placeholderNav', currentLanguage),
      fishing: t('placeholderFishing', currentLanguage),
      bot: 'Ask Bot (AI Marine Chatbot)',
      sos: 'Emergency SOS',
    };

    if (tabId === 'nav') {
      if (onOpenNavigation) onOpenNavigation();
    } else if (tabId === 'fishing') {
      if (onOpenFishingZones) onOpenFishingZones();
    } else if (tabId === 'bot') {
      // Direct view of Ask Bot AI Assistant
      return;
    } else {
      Alert.alert(
        tabNames[tabId] || 'Feature',
        t('comingSoon', currentLanguage)
      );
    }
  };

  // When active tab is 'nav', render the full Marine Navigation & Telemetry Screen directly!
  if (activeTab === 'nav') {
    return (
      <View style={{ flex: 1 }}>
        <NavigationScreen
          currentLanguage={currentLanguage}
          onBack={() => setActiveTab('fishing')}
          onOpenMap={() => setActiveTab('fishing')}
        />
      </View>
    );
  }

  // When active tab is 'bot', render the ORCA 12-AI Marine Chatbot Screen directly!
  if (activeTab === 'bot') {
    return (
      <View style={{ flex: 1 }}>
        <BotScreen
          currentLanguage={currentLanguage}
          onBack={() => setActiveTab('nets')}
          onNavigateToHotspot={() => {
            if (onOpenFishingZones) onOpenFishingZones();
          }}
          onTabPress={handleTabPress}
        />
      </View>
    );
  }

  // When active tab is 'fishing', render the full Potential Fishing Zones Screen directly!
  if (activeTab === 'fishing') {
    return (
      <View style={{ flex: 1 }}>
        <FishingZonesScreen
          currentLanguage={currentLanguage}
          onBack={() => setActiveTab('nets')}
          onNavigateToHotspot={() => setActiveTab('nav')}
          onTabPress={handleTabPress}
        />
      </View>
    );
  }

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
      
      {/* Top Header Banner with comfortable top spacing and Top-Right Hamburger Menu */}
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
        {activeTab === 'nets' ? (
          <MyNetsScreen />
        ) : (
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
                  <Text style={styles.featureIcon}>
                    {activeTab === 'nav'
                      ? '🧭'
                      : activeTab === 'fishing'
                      ? '🎣'
                      : '🆘'}
                  </Text>
                )}
                <Text style={styles.featureTitle}>
                  {activeTab === 'nav'
                    ? t('placeholderNav', currentLanguage)
                    : activeTab === 'fishing'
                    ? t('placeholderFishing', currentLanguage)
                    : activeTab === 'bot'
                    ? 'Ask Bot (AI Chatbot)'
                    : 'Emergency SOS'}
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

              <ScrollView contentContainerStyle={styles.drawerBody}>
                {/* User Profile Info Card */}
                <View style={styles.profileSection}>
                  <View style={styles.profileAvatar}>
                    <Text style={styles.avatarText}>👤</Text>
                  </View>
                  <Text style={styles.profileName}>{user?.name || 'Fisherman User'}</Text>
                  <Text style={styles.profilePhone}>{user?.phone || '+91 9876543210'}</Text>

                  {user?.address && (
                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Address:</Text>
                      <Text style={styles.infoBoxValue}>{user.address}</Text>
                    </View>
                  )}

                  {user?.pincode && (
                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Pincode:</Text>
                      <Text style={styles.infoBoxValue}>{user.pincode}</Text>
                    </View>
                  )}

                  {onOpenProfile && (
                    <TouchableOpacity
                      style={{
                        backgroundColor: Colors.secondary,
                        borderColor: Colors.secondaryDark,
                        borderWidth: 1.5,
                        borderRadius: 12,
                        paddingVertical: 10,
                        alignItems: 'center',
                        marginTop: 10,
                        width: '100%',
                      }}
                      onPress={() => {
                        closeMenuDrawer();
                        onOpenProfile();
                      }}
                    >
                      <Text style={{ color: Colors.primaryDark, fontSize: 13, fontWeight: '900' }}>
                        👤 View & Edit Full Fisherman Profile
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Settings / Language Info */}
                <View style={styles.menuSection}>
                  <Text style={styles.menuSectionTitle}>App Settings</Text>
                  
                  <View style={styles.menuItem}>
                    <Text style={styles.menuItemLabel}>🌐 Language</Text>
                    <Text style={styles.menuItemValue}>
                      {currentLangObj ? `${currentLangObj.nativeName} (${currentLangObj.englishName})` : 'Tamil'}
                    </Text>
                  </View>
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
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 16 : 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.textLight,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.secondary,
    marginBottom: 2,
  },
  appSubtitle: {
    fontSize: 16,
    color: '#B0ECE8',
    fontWeight: '700',
  },
  hamburgerButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  hamburgerIcon: {
    fontSize: 28,
    color: Colors.textLight,
    fontWeight: '900',
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 90,
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
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0ECEC',
  },
  infoBoxLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  infoBoxValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
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
});
