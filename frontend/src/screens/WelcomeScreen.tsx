import React, { useEffect, useRef, useState } from 'react';
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
import { supportedLanguages } from '../i18n';
import { SupportedLanguage } from '../types';
import { FishGroup } from '../components/FishIllustration';
import { WavyTopBorder, OceanBackground } from '../components/WavyBackground';

const { width, height: screenHeight } = Dimensions.get('window');

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

  const currentLangObj = supportedLanguages.find((l) => l.code === currentLanguage);
  const langLabel = currentLangObj ? `${currentLangObj.nativeName}` : '🌐';

  // Entrance & Exit Animated values for each fish (start offscreen for entrance)
  const animFish1 = useRef(new Animated.ValueXY({ x: -width * 1.2, y: 0 })).current;
  const animFish2 = useRef(new Animated.ValueXY({ x: width * 1.2, y: 0 })).current;
  const animFish3 = useRef(new Animated.ValueXY({ x: -width * 1.2, y: 0 })).current;
  const animFish4 = useRef(new Animated.ValueXY({ x: width * 1.2, y: 0 })).current;

  // Title & Button Entrance Animation Values
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(24)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(0.85)).current;
  const btnPressScale = useRef(new Animated.Value(1)).current;
  const btnPulseAnim = useRef(new Animated.Value(1)).current;

  // Continuous Idle Floating Loop Animation Values
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;
  const floatAnim3 = useRef(new Animated.Value(0)).current;
  const floatAnim4 = useRef(new Animated.Value(0)).current;

  // Continuous Tail-Wiggle Swimming Oscillation Values
  const wiggleAnim1 = useRef(new Animated.Value(0)).current;
  const wiggleAnim2 = useRef(new Animated.Value(0)).current;
  const wiggleAnim3 = useRef(new Animated.Value(0)).current;
  const wiggleAnim4 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start continuous button pulse aura immediately
    Animated.loop(
      Animated.sequence([
        Animated.timing(btnPulseAnim, {
          toValue: 1.04,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(btnPulseAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 1. Entrance Staggered Animation Sequence at screen load
    Animated.sequence([
      // Title fade & slide up
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
      ]),
      // Staggered Fish Entrance (swimming gently into position with spring fluidness)
      Animated.stagger(140, [
        Animated.spring(animFish1, {
          toValue: { x: 0, y: 0 },
          friction: 6.5,
          tension: 38,
          useNativeDriver: true,
        }),
        Animated.spring(animFish2, {
          toValue: { x: 0, y: 0 },
          friction: 6.5,
          tension: 38,
          useNativeDriver: true,
        }),
        Animated.spring(animFish3, {
          toValue: { x: 0, y: 0 },
          friction: 6.5,
          tension: 38,
          useNativeDriver: true,
        }),
        Animated.spring(animFish4, {
          toValue: { x: 0, y: 0 },
          friction: 6.5,
          tension: 38,
          useNativeDriver: true,
        }),
      ]),
      // Button Entrance
      Animated.parallel([
        Animated.timing(btnOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.spring(btnScale, {
          toValue: 1,
          friction: 5.5,
          tension: 50,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      startIdleFloatingAnimations();
    });
  }, []);

  const startIdleFloatingAnimations = () => {
    const createFloatLoop = (animVal: Animated.Value, duration: number, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animVal, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(animVal, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    const createWiggleLoop = (animVal: Animated.Value, duration: number, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animVal, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(animVal, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    // Continuous idle floating (vertical bobbing)
    createFloatLoop(floatAnim1, 2800, 0);
    createFloatLoop(floatAnim2, 3200, 300);
    createFloatLoop(floatAnim3, 3000, 600);
    createFloatLoop(floatAnim4, 3400, 200);

    // Continuous tail-wiggling swimming oscillation
    createWiggleLoop(wiggleAnim1, 1400, 0);
    createWiggleLoop(wiggleAnim2, 1600, 200);
    createWiggleLoop(wiggleAnim3, 1300, 400);
    createWiggleLoop(wiggleAnim4, 1500, 100);
  };

  const handlePressIn = () => {
    Animated.spring(btnPressScale, {
      toValue: 0.94,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(btnPressScale, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handleGetStartedPress = () => {
    if (isAnimating) return;
    setIsAnimating(true);

    // Each fish swims away off-screen in its OWN HEAD DIRECTION with authentic swimming propulsion:
    Animated.parallel([
      Animated.timing(animFish1, {
        toValue: { x: width * 1.5, y: -30 },
        duration: 720,
        easing: Easing.bezier(0.3, 0, 0.2, 1.0),
        useNativeDriver: true,
      }),
      Animated.timing(animFish2, {
        toValue: { x: -width * 1.5, y: 25 },
        duration: 780,
        easing: Easing.bezier(0.3, 0, 0.2, 1.0),
        useNativeDriver: true,
      }),
      Animated.timing(animFish3, {
        toValue: { x: width * 1.5, y: -80 },
        duration: 740,
        easing: Easing.bezier(0.3, 0, 0.2, 1.0),
        useNativeDriver: true,
      }),
      Animated.timing(animFish4, {
        toValue: { x: width * 1.5, y: 80 },
        duration: 800,
        easing: Easing.bezier(0.3, 0, 0.2, 1.0),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsAnimating(false);
      setShowRoleModal(true);
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF8F5" />
      
      {/* Top Header Section */}
      <View style={styles.topContainer}>
        {onChangeLanguage && (
          <TouchableOpacity
            style={styles.langPill}
            onPress={onChangeLanguage}
            activeOpacity={0.7}
          >
            <Text style={styles.langPillText}>{langLabel}</Text>
          </TouchableOpacity>
        )}

        <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] }}>
          <Text style={styles.appTitle}>Samudra Kural</Text>
        </Animated.View>
      </View>

      <WavyTopBorder height={screenHeight < 680 ? 32 : 38} />

      {/* Main Sea Section */}
      <View style={styles.seaContainer}>
        {/* Animated ocean wave lines background */}
        <OceanBackground />

        <View style={styles.fishSection}>
          <FishGroup
            animFish1={animFish1}
            animFish2={animFish2}
            animFish3={animFish3}
            animFish4={animFish4}
            floatAnim1={floatAnim1}
            floatAnim2={floatAnim2}
            floatAnim3={floatAnim3}
            floatAnim4={floatAnim4}
            wiggleAnim1={wiggleAnim1}
            wiggleAnim2={wiggleAnim2}
            wiggleAnim3={wiggleAnim3}
            wiggleAnim4={wiggleAnim4}
          />
        </View>

        {/* Footer with animated White Pill GET STARTED Button */}
        <View style={styles.footer}>
          <Animated.View
            style={{
              width: '100%',
              alignItems: 'center',
              opacity: btnOpacity,
              transform: [{ scale: Animated.multiply(Animated.multiply(btnScale, btnPressScale), btnPulseAnim) }],
            }}
          >
            <TouchableOpacity
              style={styles.getPillBtn}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={handleGetStartedPress}
              disabled={isAnimating}
              activeOpacity={0.9}
            >
              <Text style={styles.getPillBtnText}>Get Started</Text>
            </TouchableOpacity>
          </Animated.View>
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
    backgroundColor: '#FAF8F5',
  },
  topContainer: {
    backgroundColor: '#FAF8F5',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 4 : 12,
    paddingBottom: 2,
    alignItems: 'center',
    position: 'relative',
  },
  langPill: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 2,
  },
  langPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  appTitle: {
    fontSize: screenHeight < 680 ? 28 : 32,
    fontWeight: '900',
    color: '#1B382D',
    letterSpacing: 0.6,
    marginBottom: 4,
    textAlign: 'center',
  },
  seaContainer: {
    flex: 1,
    backgroundColor: '#235E4B',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    paddingBottom: screenHeight < 680 ? 16 : 24,
  },
  fishSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  footer: {
    width: '100%',
    paddingBottom: screenHeight < 680 ? 4 : 10,
    alignItems: 'center',
  },
  getPillBtn: {
    backgroundColor: '#FFFFFF',
    width: '90%',
    borderRadius: 40,
    paddingVertical: screenHeight < 680 ? 14 : 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  getPillBtnText: {
    color: '#0F281E',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
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
