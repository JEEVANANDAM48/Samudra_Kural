import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  Dimensions,
  Easing,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { t, supportedLanguages } from '../i18n';
import { SupportedLanguage } from '../types';
import { PrimaryButton } from '../components/PrimaryButton';
import { FishGroup } from '../components/FishIllustration';
import { WavyTopBorder } from '../components/WavyBackground';

const { width } = Dimensions.get('window');

interface WelcomeScreenProps {
  currentLanguage: SupportedLanguage;
  onGetStarted: () => void;
  onChangeLanguage?: () => void;
  onOpenCoastalGuard?: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  currentLanguage,
  onGetStarted,
  onChangeLanguage,
  onOpenCoastalGuard,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  // Find native name of current language
  const currentLangObj = supportedLanguages.find((l) => l.code === currentLanguage);
  const langLabel = currentLangObj ? `${currentLangObj.nativeName}` : '🌐';

  // Animated values for each fish's (x, y) displacement
  const animFish1 = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current; // Fish 1: facing RIGHT -> moves RIGHT
  const animFish2 = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current; // Fish 2: facing LEFT -> moves LEFT
  const animFish3 = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current; // Fish 3: facing RIGHT -> moves RIGHT-UP
  const animFish4 = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current; // Fish 4: facing LEFT -> moves LEFT-DOWN

  const handleGetStartedPress = () => {
    if (isAnimating) return;
    setIsAnimating(true);

    // Directional Exit Animations based on each fish's facing heading
    Animated.parallel([
      // Fish 1 (facing right) -> travels right out of screen
      Animated.timing(animFish1, {
        toValue: { x: width * 1.4, y: 0 },
        duration: 700,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      // Fish 2 (facing left) -> travels left out of screen
      Animated.timing(animFish2, {
        toValue: { x: -width * 1.4, y: 0 },
        duration: 700,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      // Fish 3 (facing right) -> travels right-up diagonally
      Animated.timing(animFish3, {
        toValue: { x: width * 1.4, y: -80 },
        duration: 750,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      // Fish 4 (facing left) -> travels left-down diagonally
      Animated.timing(animFish4, {
        toValue: { x: -width * 1.4, y: 80 },
        duration: 750,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onGetStarted();
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      
      {/* Top Section */}
      <View style={styles.topContainer}>
        {onChangeLanguage && (
          <TouchableOpacity
            style={styles.langPill}
            onPress={onChangeLanguage}
            activeOpacity={0.7}
          >
            <Text style={styles.langPillText}>🌐 {langLabel}</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.appTitle}>SAMUDRA KURAL</Text>
        <Text style={styles.appSubtitle}>{t('welcomeSubtitle', currentLanguage)}</Text>
      </View>

      {/* Wavy transition inspired by reference image */}
      <WavyTopBorder height={40} />

      {/* Main Sea Section */}
      <View style={styles.seaContainer}>
        {/* Central Fish Illustration Area */}
        <View style={styles.fishSection}>
          <FishGroup
            animFish1={animFish1}
            animFish2={animFish2}
            animFish3={animFish3}
            animFish4={animFish4}
          />
        </View>

        {/* Footer with GET STARTED Button & Coastal Guard Portal Button */}
        <View style={styles.footer}>
          <PrimaryButton
            title={t('getStarted', currentLanguage)}
            onPress={handleGetStartedPress}
            disabled={isAnimating}
            variant="secondary"
            textStyle={styles.buttonText}
          />

          {onOpenCoastalGuard && (
            <TouchableOpacity
              style={styles.cgWelcomeBtn}
              activeOpacity={0.8}
              onPress={onOpenCoastalGuard}
            >
              <Text style={styles.cgWelcomeTxt}>👮 Coastal Guard Officer Portal ➔</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topContainer: {
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 16 : 24,
    paddingBottom: 10,
    alignItems: 'center',
    position: 'relative',
  },
  langPill: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  langPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  appSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  seaContainer: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingBottom: 30,
  },
  fishSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  footer: {
    width: '100%',
    paddingBottom: 10,
  },
  buttonText: {
    color: Colors.primaryDark,
    fontSize: 20,
    fontWeight: '800',
  },
  cgWelcomeBtn: {
    backgroundColor: '#0F3A5D',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  cgWelcomeTxt: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
