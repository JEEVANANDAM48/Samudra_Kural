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

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.82;

interface HomeScreenProps {
  currentLanguage: SupportedLanguage;
  onLogout: () => void;
  onChangeLanguage?: () => void;
  onOpenFishingZones?: () => void;
  onOpenNavigation?: () => void;
  onOpenProfile?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  currentLanguage,
  onLogout,
  onChangeLanguage,
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
      bot: `${t('askBot', currentLanguage)} (${t('askBotSub', currentLanguage)})`,
      sos: t('placeholderEmergency', currentLanguage),
    };

    if (tabId === 'nav') {
      if (onOpenNavigation) onOpenNavigation();
    } else if (tabId === 'fishing') {
      if (onOpenFishingZones) onOpenFishingZones();
    } else if (tabId === 'bot') {
      Alert.alert(
        `${t('askBot', currentLanguage)} (${t('askBotSub', currentLanguage)})`,
        t('comingSoon', currentLanguage)
      );
    } else {
      Alert.alert(
        tabNames[tabId] || t('appTitle', currentLanguage),
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

  // When active tab is 'fishing', render the full Potential Fishing Zones Screen directly!
  if (activeTab === 'fishing') {
    return (
      <View style={{ flex: 1 }}>
        <FishingZonesScreen
          currentLanguage={currentLanguage}
          onBack={() => setActiveTab('nav')}
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
                    ? `${t('askBot', currentLanguage)} (${t('askBotSub', currentLanguage)})`
                    : t('placeholderEmergency', currentLanguage)}
                </Text>
              </View>

              <View style={styles.noticeBox}>
                <Text style={styles.noticeTitle}>{t('appSubtitle', currentLanguage)}</Text>
                <Text style={styles.noticeText}>
                  {t('comingSoon', currentLanguage)}. {t('pfzSubtitle', currentLanguage)}.
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
                      🧭 {t('navigationTitle', currentLanguage)}
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
                      {t('openIncoisMap', currentLanguage)}
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
                <Text style={styles.drawerHeaderTitle}>{t('menuAndProfile', currentLanguage)}</Text>
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
                      <Text style={styles.infoBoxLabel}>{t('address', currentLanguage)}:</Text>
                      <Text style={styles.infoBoxValue}>{user.address}</Text>
                    </View>
                  )}

                  {user?.pincode && (
                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>{t('pincode', currentLanguage)}:</Text>
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
                        {t('viewEditProfile', currentLanguage)}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Settings / Language Info */}
                <View style={styles.menuSection}>
                  <Text style={styles.menuSectionTitle}>{t('appSettings', currentLanguage)}</Text>
                  
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.menuItem}
                    onPress={() => {
                      closeMenuDrawer();
                      if (onChangeLanguage) {
                        onChangeLanguage();
                      }
                    }}
                  >
                    <Text style={styles.menuItemLabel}>🌐 {t('language', currentLanguage)}</Text>
                    <Text style={styles.menuItemValue}>
                      {currentLangObj ? `${currentLangObj.nativeName} (${currentLangObj.englishName})` : 'தமிழ்'} ➔
                    </Text>
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
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D4F2F0',
    marginTop: 4,
  },
  appSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B0ECE8',
    marginTop: 2,
  },
  hamburgerButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  hamburgerIcon: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 76,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  featureCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 20,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 14,
  },
  featureIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  botFeatureLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.text,
  },
  noticeBox: {
    backgroundColor: Colors.secondary,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.secondaryDark,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginBottom: 6,
  },
  noticeText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 19,
    fontWeight: '500',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  drawerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: DRAWER_WIDTH,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 16,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 16,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.border,
  },
  drawerHeaderTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  closeIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  drawerBody: {
    paddingVertical: 18,
  },
  profileSection: {
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 32,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  profilePhone: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 10,
  },
  infoBox: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  infoBoxLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  infoBoxValue: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '700',
  },
  menuSection: {
    marginBottom: 20,
  },
  menuSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    backgroundColor: Colors.background,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuItemLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  menuItemValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  logoutWrapper: {
    marginTop: 10,
  },
});
