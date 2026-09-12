import React from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Path, Circle, G, Rect } from 'react-native-svg';

const { width } = Dimensions.get('window');

interface FishProps {
  size?: number;
}

// Fish 1 (Top): Horizontal striped fish, Facing RIGHT (Head right, tail left)
export const FishOne: React.FC<FishProps> = ({ size = 260 }) => {
  const height = size * 0.35;
  return (
    <Svg width={size} height={height} viewBox="0 0 260 90" fill="none">
      <G>
        {/* Tail fin on left */}
        <Path d="M10 45 L35 20 L35 70 Z" fill="#FFFFFF" />
        <Path d="M35 25 L45 45 L35 65 Z" fill="#0D2526" />
        
        {/* Main body outline */}
        <Path d="M35 45 C70 15, 170 15, 230 45 C170 75, 70 75, 35 45 Z" fill="#FFFFFF" stroke="#0D2526" strokeWidth="4" />
        
        {/* Dark vertical body stripes */}
        <Path d="M60 27 V63 M80 21 V69 M100 18 V72 M120 17 V73 M140 18 V72 M160 21 V69 M180 26 V64" stroke="#0D2526" strokeWidth="6" strokeLinecap="round" />
        
        {/* Head section on right */}
        <Path d="M195 29 C215 37, 225 43, 230 45 C225 47, 215 53, 195 61 Z" fill="#FFFFFF" />
        
        {/* Eye on right */}
        <Circle cx="215" cy="42" r="5" fill="#0D2526" />
        <Circle cx="216" cy="41" r="1.8" fill="#FFFFFF" />
      </G>
    </Svg>
  );
};

// Fish 2 (Second): Oval fish with curved dark stripes, Facing LEFT (Head left, tail right)
export const FishTwo: React.FC<FishProps> = ({ size = 270 }) => {
  const height = size * 0.45;
  return (
    <Svg width={size} height={height} viewBox="0 0 270 120" fill="none">
      <G>
        {/* Tail fin on right */}
        <Path d="M260 60 L230 30 L230 90 Z" fill="#0D2526" />
        <Path d="M230 40 L215 60 L230 80 Z" fill="#FFFFFF" />

        {/* Main body */}
        <Path d="M230 60 C170 10, 70 10, 30 60 C70 110, 170 110, 230 60 Z" fill="#0D2526" />
        
        {/* White curved side stripes */}
        <Path d="M50 60 C75 25, 175 25, 210 60 C175 95, 75 95, 50 60 Z" fill="none" stroke="#FFFFFF" strokeWidth="5" />
        <Path d="M70 60 C90 35, 160 35, 190 60 C160 85, 90 85, 70 60 Z" fill="#FFFFFF" />
        
        {/* Head section on left */}
        <Path d="M30 60 C40 45, 50 40, 60 60 C50 80, 40 75, 30 60 Z" fill="#FFFFFF" />
        
        {/* Eye on left */}
        <Circle cx="45" cy="58" r="4.5" fill="#0D2526" />
        <Circle cx="44" cy="57" r="1.5" fill="#FFFFFF" />
        
        {/* Mouth line */}
        <Path d="M30 60 L22 60" stroke="#0D2526" strokeWidth="3" strokeLinecap="round" />
      </G>
    </Svg>
  );
};

// Fish 3 (Third): Sleek fish with large top fin, Facing RIGHT (Head right, tail left)
export const FishThree: React.FC<FishProps> = ({ size = 260 }) => {
  const height = size * 0.55;
  return (
    <Svg width={size} height={height} viewBox="0 0 260 140" fill="none">
      <G>
        {/* Large sail-like dorsal fin on top */}
        <Path d="M110 50 C140 10, 170 15, 160 60 Z" fill="#FFFFFF" stroke="#0D2526" strokeWidth="4" />
        <Path d="M130 40 L150 55" stroke="#0D2526" strokeWidth="3" />
        <Path d="M120 48 L140 58" stroke="#0D2526" strokeWidth="3" />
        
        {/* Pelvic fin below */}
        <Path d="M140 90 L160 120 L170 90 Z" fill="#0D2526" />

        {/* Tail fin on left */}
        <Path d="M10 70 L40 40 C30 70, 30 70, 40 100 Z" fill="#FFFFFF" stroke="#0D2526" strokeWidth="3" />
        
        {/* Main body */}
        <Path d="M38 70 C70 40, 160 40, 230 70 C160 100, 70 100, 38 70 Z" fill="#FFFFFF" stroke="#0D2526" strokeWidth="4" />
        
        {/* Body gills & stripes */}
        <Path d="M80 52 C70 70, 70 70, 80 88" stroke="#0D2526" strokeWidth="4" fill="none" />
        <Path d="M95 50 C85 70, 85 70, 95 90" stroke="#0D2526" strokeWidth="3" fill="none" />

        {/* Eye on right */}
        <Circle cx="205" cy="65" r="5" fill="#0D2526" />
        <Circle cx="206" cy="64" r="1.8" fill="#FFFFFF" />
      </G>
    </Svg>
  );
};

// Fish 4 (Bottom): Elongated fish with vertical stripes, Facing LEFT (Head left, tail right)
export const FishFour: React.FC<FishProps> = ({ size = 260 }) => {
  const height = size * 0.35;
  return (
    <Svg width={size} height={height} viewBox="0 0 260 90" fill="none">
      <G>
        {/* Tail fin on right */}
        <Path d="M250 45 L225 20 L235 45 L225 70 Z" fill="#FFFFFF" stroke="#0D2526" strokeWidth="3" />

        {/* Main body */}
        <Path d="M225 45 C175 20, 75 20, 30 45 C75 70, 175 70, 225 45 Z" fill="#FFFFFF" stroke="#0D2526" strokeWidth="4" />

        {/* Vertical stripe arches */}
        <Path d="M65 32 C60 45, 60 45, 65 58" stroke="#0D2526" strokeWidth="4" fill="none" />
        <Path d="M80 28 C73 45, 73 45, 80 62" stroke="#0D2526" strokeWidth="4" fill="none" />
        <Path d="M95 26 C87 45, 87 45, 95 64" stroke="#0D2526" strokeWidth="4" fill="none" />
        <Path d="M110 25 C102 45, 102 45, 110 65" stroke="#0D2526" strokeWidth="4" fill="none" />
        <Path d="M125 25 C117 45, 117 45, 125 65" stroke="#0D2526" strokeWidth="4" fill="none" />
        <Path d="M140 26 C132 45, 132 45, 140 64" stroke="#0D2526" strokeWidth="4" fill="none" />
        <Path d="M155 28 C148 45, 148 45, 155 62" stroke="#0D2526" strokeWidth="4" fill="none" />
        <Path d="M170 32 C164 45, 164 45, 170 58" stroke="#0D2526" strokeWidth="4" fill="none" />

        {/* Eye on left */}
        <Circle cx="48" cy="45" r="5" fill="#0D2526" />
        <Circle cx="47" cy="44" r="1.8" fill="#FFFFFF" />
      </G>
    </Svg>
  );
};

interface FishContainerProps {
  animFish1: Animated.ValueXY;
  animFish2: Animated.ValueXY;
  animFish3: Animated.ValueXY;
  animFish4: Animated.ValueXY;
}

export const FishGroup: React.FC<FishContainerProps> = ({
  animFish1,
  animFish2,
  animFish3,
  animFish4,
}) => {
  return (
    <View style={styles.groupContainer}>
      {/* Fish 1 - Facing RIGHT -> Moves Right */}
      <Animated.View style={[styles.fishWrapper, { transform: animFish1.getTranslateTransform() }]}>
        <FishOne size={270} />
      </Animated.View>

      {/* Fish 2 - Facing LEFT -> Moves Left */}
      <Animated.View style={[styles.fishWrapper, { transform: animFish2.getTranslateTransform() }]}>
        <FishTwo size={280} />
      </Animated.View>

      {/* Fish 3 - Facing RIGHT -> Moves Right-Up */}
      <Animated.View style={[styles.fishWrapper, { transform: animFish3.getTranslateTransform() }]}>
        <FishThree size={270} />
      </Animated.View>

      {/* Fish 4 - Facing LEFT -> Moves Left-Down */}
      <Animated.View style={[styles.fishWrapper, { transform: animFish4.getTranslateTransform() }]}>
        <FishFour size={270} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  groupContainer: {
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 10,
  },
  fishWrapper: {
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
