import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Colors } from '../theme/colors';
import { SupportedLanguage } from '../types';
import { getLanguagePreference, getAuthToken, saveLanguagePreference } from '../storage/storage';
import { LanguageScreen } from '../screens/LanguageScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { FishingZonesScreen } from '../screens/FishingZonesScreen';
import { NavigationScreen } from '../screens/NavigationScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { HotspotInfo } from '../services/pfzService';

type ScreenState = 'loading' | 'welcome' | 'language' | 'login' | 'register' | 'home' | 'fishing_zones' | 'navigation' | 'profile';

export const AppNavigator: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('loading');
  const [language, setLanguage] = useState<SupportedLanguage>('ta');
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotInfo | null>(null);

  useEffect(() => {
    bootstrapApp();
  }, []);

  const bootstrapApp = async () => {
    try {
      const savedLang = await getLanguagePreference();
      if (savedLang) {
        setLanguage(savedLang);
      }
      // Always ask language selection when app opens
      setCurrentScreen('language');
    } catch (e) {
      setCurrentScreen('language');
    }
  };

  // Step 1: Welcome Screen "GET STARTED" -> Navigates to Language Selection Screen
  const handleGetStarted = () => {
    setCurrentScreen('login');
  };

  // Step 2: Language Selection Screen "Continue" -> Navigates to Welcome Screen or Home Screen
  const handleLanguageSelect = async (selectedLang: SupportedLanguage) => {
    setLanguage(selectedLang);
    try {
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
      'Registration Complete',
      'Account created successfully! Please login with your mobile number and 6-digit PIN.'
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
        />
      )}

      {/* 2. PREFERRED LANGUAGE SELECTION SCREEN */}
      {currentScreen === 'language' && (
        <LanguageScreen onLanguageSelected={handleLanguageSelect} />
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
          onLanguageChange={async (newLang) => {
            setLanguage(newLang);
            await saveLanguagePreference(newLang);
          }}
          initialTab={
            currentScreen === 'fishing_zones'
              ? 'fishing'
              : currentScreen === 'navigation'
              ? 'nav'
              : currentScreen === 'profile'
              ? 'profile'
              : 'nav'
          }
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
