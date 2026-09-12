import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../theme/colors';

const { width } = Dimensions.get('window');

interface WavyHeaderProps {
  height?: number;
}

export const WavyTopBorder: React.FC<WavyHeaderProps> = ({ height = 70 }) => {
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} 70`} preserveAspectRatio="none">
        <Path
          d={`M0,0 L${width},0 L${width},30 Q${width * 0.75},70 ${width * 0.5},35 Q${width * 0.25},0 0,40 Z`}
          fill={Colors.background}
        />
      </Svg>
    </View>
  );
};
