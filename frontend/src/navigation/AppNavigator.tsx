import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Colors } from '../theme/colors';
import { SupportedLanguage } from '../types';
import { getLanguagePreference, getAuthToken } from '../storage/storage';
import { LanguageScreen } from '../screens/LanguageScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { FishingZonesScreen } from '../screens/FishingZonesScreen';
import { NavigationScreen } from '../screens/NavigationScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { BotScreen } from '../screens/BotScreen';
import { HotspotInfo } from '../services/pfzService';

type ScreenState = 'loading' | 'welcome' | 'language' | 'login' | 'register' | 'home' | 'fishing_zones' | 'navigation' | 'profile' | 'bot';

export const AppNavigator: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('loading');
  const [previousScreen, setPreviousScreen] = useState<ScreenState>('welcome');
  const { language, setLanguage, t } = useLanguage();
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotInfo | null>(null);

  useEffect(() => {
    bootstrapApp();
  }, []);

  const bootstrapApp = async () => {
    try {
      const savedLang = await getLanguagePreference();
      const token = await getAuthToken();

      if (savedLang) {
        await setLanguage(savedLang);
        if (token) {
          setCurrentScreen('home');
        } else {
          setCurrentScreen('welcome');
        }
      } else {
        // First launch - show language selection screen
        setCurrentScreen('language');
      }
    } catch (e) {
      setCurrentScreen('welcome');
    }
  };

  const handleOpenLanguage = () => {
    setPreviousScreen(currentScreen);
    setCurrentScreen('language');
  };

  // Step 1: Welcome Screen "GET STARTED" -> Navigates to Login Screen
  const handleGetStarted = () => {
    setCurrentScreen('login');
  };

  // Step 2: Language Selection Screen "Continue" -> Navigates to appropriate destination
  const handleLanguageSelect = async (selectedLang: SupportedLanguage) => {
    await setLanguage(selectedLang);
    try {
      if (previousScreen && previousScreen !== 'loading' && previousScreen !== 'language') {
        setCurrentScreen(previousScreen);
        return;
      }
      const token = await getAuthToken();
      if (token) {
        setCurrentScreen('home');
      } else {
        setCurrentScreen('welcome');
      }
    } catch (e) {
      setCurrentScreen('welcome');
    }
  };

  // Step 3: Register Screen success -> Navigates back to Login Screen
  const handleRegisterSuccess = () => {
    Alert.alert(
      t('registrationComplete'),
      t('registrationSuccessMsg')
    );
    setCurrentScreen('login');
  };

  // Step 4: Login Screen success -> Navigates to Home Screen
  const handleLoginSuccess = () => {
    setCurrentScreen('home');
  };

  // Step 5: Logout -> Returns to Welcome Screen
  const handleLogout = () => {
    setCurrentScreen('welcome');
  };

  const handleStartNavigationToHotspot = (spot: HotspotInfo) => {
    setSelectedHotspot(spot);
    setCurrentScreen('fishing_zones');
  };

  if (currentScreen === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. WELCOME SCREEN */}
      {currentScreen === 'welcome' && (
        <WelcomeScreen
          currentLanguage={language}
          onGetStarted={handleGetStarted}
          onChangeLanguage={handleOpenLanguage}
        />
      )}

      {/* 2. PREFERRED LANGUAGE SELECTION SCREEN */}
      {currentScreen === 'language' && (
        <LanguageScreen
          initialLanguage={language}
          onLanguageSelected={handleLanguageSelect}
          onCancel={previousScreen && previousScreen !== 'loading' && previousScreen !== 'language' ? () => setCurrentScreen(previousScreen) : undefined}
        />
      )}

      {/* 3. LOGIN SCREEN */}
      {currentScreen === 'login' && (
        <LoginScreen
          currentLanguage={language}
          onLoginSuccess={handleLoginSuccess}
          onNavigateToRegister={() => setCurrentScreen('register')}
        />
      )}

      {/* 4. REGISTER SCREEN */}
      {currentScreen === 'register' && (
        <RegisterScreen
          currentLanguage={language}
          onRegisterSuccess={handleRegisterSuccess}
          onNavigateToLogin={() => setCurrentScreen('login')}
        />
      )}

      {/* 5. HOME & AUTHENTICATED APP SCREENS (TOP HEADER BANNER RENDERED ACROSS ALL PAGES) */}
      {(currentScreen === 'home' || currentScreen === 'fishing_zones' || currentScreen === 'navigation' || currentScreen === 'profile') && (
        <HomeScreen
          currentLanguage={language}
          onLogout={handleLogout}
          onOpenFishingZones={() => setCurrentScreen('fishing_zones')}
          onOpenNavigation={() => setCurrentScreen('navigation')}
          onOpenProfile={() => setCurrentScreen('profile')}
        />
      )}

      {/* 6. POTENTIAL FISHING ZONES SCREEN (INCOIS REAL DATA) */}
      {currentScreen === 'fishing_zones' && (
        <FishingZonesScreen
          currentLanguage={language}
          initialTarget={selectedHotspot}
          onBack={() => setCurrentScreen('home')}
          onNavigateToHotspot={handleStartNavigationToHotspot}
        />
      )}

      {/* 7. LIVE MARINE NAVIGATION SCREEN */}
      {currentScreen === 'navigation' && (
        <NavigationScreen
          currentLanguage={language}
          initialTarget={selectedHotspot}
          onBack={() => setCurrentScreen('home')}
          onOpenMap={() => setCurrentScreen('fishing_zones')}
          onLogout={handleLogout}
          onOpenProfile={() => setCurrentScreen('profile')}
        />
      )}

      {/* 8. DEDICATED FISHERMAN PROFILE & SPECS SCREEN */}
      {currentScreen === 'profile' && (
        <ProfileScreen
          currentLanguage={language}
          onBack={() => setCurrentScreen('home')}
          onLogout={handleLogout}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
