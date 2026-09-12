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

type ScreenState = 'loading' | 'welcome' | 'language' | 'login' | 'register' | 'home';

export const AppNavigator: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('loading');
  const [language, setLanguage] = useState<SupportedLanguage>('ta');

  useEffect(() => {
    bootstrapApp();
  }, []);

  const bootstrapApp = async () => {
    try {
      const savedLang = await getLanguagePreference();
      const token = await getAuthToken();

      if (savedLang) {
        setLanguage(savedLang);
      }

      if (token) {
        // Authenticated user goes straight to Home
        setCurrentScreen('home');
      } else {
        // Unauthenticated user always starts on Welcome Screen
        setCurrentScreen('welcome');
      }
    } catch (e) {
      setCurrentScreen('welcome');
    }
  };

  // Step 1: Welcome Screen "GET STARTED" -> Navigates to Language Selection Screen
  const handleGetStarted = () => {
    setCurrentScreen('language');
  };

  // Step 2: Language Selection Screen "Continue" -> Navigates to Login Screen
  const handleLanguageSelect = (selectedLang: SupportedLanguage) => {
    setLanguage(selectedLang);
    setCurrentScreen('login');
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

      {/* 5. HOME SCREEN */}
      {currentScreen === 'home' && (
        <HomeScreen
          currentLanguage={language}
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
