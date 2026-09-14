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
  Modal,
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
  const [showRoleModal, setShowRoleModal] = useState(false);

  // Find native name of current language
  const currentLangObj = supportedLanguages.find((l) => l.code === currentLanguage);
  const langLabel = currentLangObj ? `${currentLangObj.nativeName}` : '🌐';

  // Animated values for each fish's (x, y) displacement
  const animFish1 = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const animFish2 = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const animFish3 = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const animFish4 = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const handleGetStartedPress = () => {
    if (isAnimating) return;
    setIsAnimating(true);

    Animated.parallel([
      Animated.timing(animFish1, {
        toValue: { x: width * 1.4, y: 0 },
        duration: 600,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(animFish2, {
        toValue: { x: -width * 1.4, y: 0 },
        duration: 600,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(animFish3, {
        toValue: { x: width * 1.4, y: -80 },
        duration: 650,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(animFish4, {
        toValue: { x: -width * 1.4, y: 80 },
        duration: 650,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsAnimating(false);
      setShowRoleModal(true);
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

      <WavyTopBorder height={40} />

      {/* Main Sea Section */}
      <View style={styles.seaContainer}>
        <View style={styles.fishSection}>
          <FishGroup
            animFish1={animFish1}
            animFish2={animFish2}
            animFish3={animFish3}
            animFish4={animFish4}
          />
        </View>

        {/* Footer with GET STARTED Button */}
        <View style={styles.footer}>
          <PrimaryButton
            title={t('getStarted', currentLanguage)}
            onPress={handleGetStartedPress}
            disabled={isAnimating}
            variant="secondary"
            textStyle={styles.buttonText}
          />
        </View>
      </View>

      {/* Login Portal Selection Modal */}
      <Modal
        visible={showRoleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRoleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>SELECT LOGIN PORTAL</Text>
              <TouchableOpacity onPress={() => setShowRoleModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Choose your account portal to proceed to login:
            </Text>

            {/* 1. Fisherman Login Option */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.portalOptionBtn}
              onPress={() => {
                setShowRoleModal(false);
                onGetStarted();
              }}
            >
              <Text style={styles.optionIcon}>🎣</Text>
              <View style={styles.optionTextCol}>
                <Text style={styles.portalOptionTitle}>Fisherman Login</Text>
              </View>
              <Text style={styles.optionArrow}>➔</Text>
            </TouchableOpacity>

            {/* 2. Coastal Guard Login Option */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.portalOptionBtn}
              onPress={() => {
                setShowRoleModal(false);
                if (onOpenCoastalGuard) {
                  onOpenCoastalGuard();
                }
              }}
            >
              <Text style={styles.optionIcon}>🛡️</Text>
              <View style={styles.optionTextCol}>
                <Text style={styles.portalOptionTitle}>Coastal Guard Login</Text>
              </View>
              <Text style={styles.optionArrow}>➔</Text>
            </TouchableOpacity>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 30, 45, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: 0.8,
  },
  closeBtn: {
    backgroundColor: '#F1F5F9',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnTxt: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748B',
  },
  modalSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
    fontWeight: '600',
  },
  portalOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F4F1',
    borderColor: Colors.primary,
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
  },
  optionIcon: {
    fontSize: 32,
    marginRight: 14,
  },
  optionTextCol: {
    flex: 1,
  },
  portalOptionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  optionArrow: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.primary,
  },
});
