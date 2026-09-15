import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../theme/colors';

const { width } = Dimensions.get('window');

interface WavyHeaderProps {
  height?: number;
}

export const WavyTopBorder: React.FC<WavyHeaderProps> = ({ height = 45 }) => {
  return (
    <View style={{ width, height, backgroundColor: '#235E4B' }}>
      <Svg width={width} height={height} viewBox="0 0 375 45" preserveAspectRatio="none">
        <Path
          d="M0,0 L375,0 L375,10 C325,38 285,5 245,22 C205,38 165,5 125,22 C85,38 45,5 0,22 Z"
          fill="#FAF8F5"
        />
      </Svg>
    </View>
  );
};

export const OceanBackground: React.FC = () => {
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;

  // 6 ambient floating bubbles
  const bubble1 = useRef(new Animated.Value(0)).current;
  const bubble2 = useRef(new Animated.Value(0)).current;
  const bubble3 = useRef(new Animated.Value(0)).current;
  const bubble4 = useRef(new Animated.Value(0)).current;
  const bubble5 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Primary ocean wave current
    Animated.loop(
      Animated.timing(waveAnim1, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Secondary ocean wave current (reverse direction drift)
    Animated.loop(
      Animated.timing(waveAnim2, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Rising ambient ocean bubbles
    const animateBubble = (anim: Animated.Value, duration: number, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animateBubble(bubble1, 6500, 0);
    animateBubble(bubble2, 8000, 1200);
    animateBubble(bubble3, 7200, 2500);
    animateBubble(bubble4, 9000, 800);
    animateBubble(bubble5, 7600, 3200);
  }, []);

  const waveTranslateX1 = waveAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -80],
  });

  const waveTranslateX2 = waveAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 20],
  });

  const createBubbleStyle = (anim: Animated.Value, leftPercent: `${number}%`, size: number) => {
    const translateY = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [400, -80],
    });
    const translateX = anim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, 15, -10],
    });
    const opacity = anim.interpolate({
      inputRange: [0, 0.2, 0.8, 1],
      outputRange: [0, 0.6, 0.6, 0],
    });
    const scale = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.6, 1.2],
    });

    return {
      position: 'absolute' as const,
      left: leftPercent,
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.45)',
      opacity,
      transform: [{ translateY }, { translateX }, { scale }],
    };
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Primary Ocean Current Lines */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            width: width + 160,
            transform: [{ translateX: waveTranslateX1 }],
          },
        ]}
      >
        <Svg width={width + 160} height="100%" viewBox={`0 0 ${width + 160} 600`} preserveAspectRatio="none">
          <Path d="M-40 50 Q100 10 240 50 T520 50 T800 50" stroke="rgba(255,255,255,0.09)" strokeWidth="6" fill="none" />
          <Path d="M-40 160 Q100 120 240 160 T520 160 T800 160" stroke="rgba(255,255,255,0.08)" strokeWidth="5" fill="none" />
          <Path d="M-40 270 Q100 230 240 270 T520 270 T800 270" stroke="rgba(255,255,255,0.09)" strokeWidth="6" fill="none" />
          <Path d="M-40 380 Q100 340 240 380 T520 380 T800 380" stroke="rgba(255,255,255,0.08)" strokeWidth="5" fill="none" />
          <Path d="M-40 490 Q100 450 240 490 T520 490 T800 490" stroke="rgba(255,255,255,0.09)" strokeWidth="6" fill="none" />
        </Svg>
      </Animated.View>

      {/* Secondary Counter-drift Wave Lines */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            width: width + 160,
            transform: [{ translateX: waveTranslateX2 }],
          },
        ]}
      >
        <Svg width={width + 160} height="100%" viewBox={`0 0 ${width + 160} 600`} preserveAspectRatio="none">
          <Path d="M-40 105 Q100 145 240 105 T520 105 T800 105" stroke="rgba(255,255,255,0.04)" strokeWidth="4" fill="none" />
          <Path d="M-40 215 Q100 255 240 215 T520 215 T800 215" stroke="rgba(255,255,255,0.05)" strokeWidth="4" fill="none" />
          <Path d="M-40 325 Q100 365 240 325 T520 325 T800 325" stroke="rgba(255,255,255,0.04)" strokeWidth="4" fill="none" />
          <Path d="M-40 435 Q100 475 240 435 T520 435 T800 435" stroke="rgba(255,255,255,0.05)" strokeWidth="4" fill="none" />
        </Svg>
      </Animated.View>

      {/* Animated Rising Ambient Bubbles */}
      <Animated.View style={createBubbleStyle(bubble1, '12%', 14)} />
      <Animated.View style={createBubbleStyle(bubble2, '35%', 18)} />
      <Animated.View style={createBubbleStyle(bubble3, '65%', 12)} />
      <Animated.View style={createBubbleStyle(bubble4, '82%', 16)} />
      <Animated.View style={createBubbleStyle(bubble5, '50%', 10)} />
    </View>
  );
};

interface HeaderWaveBottomProps {
  color?: string;
  bgColor?: string;
  height?: number;
}

export const HeaderWaveBottom: React.FC<HeaderWaveBottomProps> = ({
  color = Colors.primary,
  bgColor = Colors.background,
  height = 20,
}) => {
  return (
    <View style={{ width: '100%', height, backgroundColor: color, overflow: 'hidden' }}>
      <Svg width="100%" height={height} viewBox="0 0 1440 320" preserveAspectRatio="none">
        <Path
          fill={bgColor}
          d="M0,120 C180,240 360,40 540,140 C720,240 900,40 1080,140 C1260,240 1350,80 1440,120 L1440,320 L0,320 Z"
        />
      </Svg>
    </View>
  );
};
