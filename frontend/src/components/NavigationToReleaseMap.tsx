import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, {
  Circle,
  Line,
  Text as SvgText,
  G,
  Defs,
  LinearGradient,
  Stop,
  Rect
} from 'react-native-svg';
import { Colors } from '../theme/colors';

interface NavigationToReleaseMapProps {
  fishermanLat: number;
  fishermanLon: number;
  releaseLat: number;
  releaseLon: number;
  distanceKm: number;
  bearingDeg: number;
  width?: number;
  height?: number;
}

export const NavigationToReleaseMap: React.FC<NavigationToReleaseMapProps> = ({
  fishermanLat,
  fishermanLon,
  releaseLat,
  releaseLon,
  distanceKm,
  bearingDeg,
  width = Dimensions.get('window').width - 48,
  height = 230,
}) => {
  const lats = [fishermanLat, releaseLat];
  const lons = [fishermanLon, releaseLon];

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const latSpan = Math.max(0.012, maxLat - minLat) * 1.6;
  const lonSpan = Math.max(0.012, maxLon - minLon) * 1.6;

  const midLat = (minLat + maxLat) / 2.0;
  const midLon = (minLon + maxLon) / 2.0;

  const mapMinLat = midLat - latSpan / 2.0;
  const mapMaxLat = midLat + latSpan / 2.0;
  const mapMinLon = midLon - lonSpan / 2.0;
  const mapMaxLon = midLon + lonSpan / 2.0;

  const padding = 32;
  const projX = (lon: number) => padding + ((lon - mapMinLon) / (mapMaxLon - mapMinLon)) * (width - 2 * padding);
  const projY = (lat: number) => height - padding - ((lat - mapMinLat) / (mapMaxLat - mapMinLat)) * (height - 2 * padding);

  const fishX = projX(fishermanLon);
  const fishY = projY(fishermanLat);
  const relX = projX(releaseLon);
  const relY = projY(releaseLat);

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="navSeaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#092B30" />
            <Stop offset="100%" stopColor="#041518" />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width={width} height={height} rx="16" fill="url(#navSeaGrad)" />

        {/* Navigation Route Line */}
        <Line
          x1={fishX}
          y1={fishY}
          x2={relX}
          y2={relY}
          stroke="#00E5FF"
          strokeWidth="3"
          strokeDasharray="6, 4"
        />

        {/* GREEN Marker: Current Fisherman Location */}
        <Circle cx={fishX} cy={fishY} r="12" fill="#2ECC71" opacity="0.3" />
        <Circle cx={fishX} cy={fishY} r="6.5" fill="#2ECC71" stroke="#FFFFFF" strokeWidth="2" />
        <SvgText x={fishX} y={fishY + 18} fill="#2ECC71" fontSize="11" fontWeight="800" textAnchor="middle">
          You (Boat)
        </SvgText>

        {/* BLUE Marker: Original Net Release Point */}
        <Circle cx={relX} cy={relY} r="12" fill="#3498DB" opacity="0.3" />
        <Circle cx={relX} cy={relY} r="6.5" fill="#2980B9" stroke="#FFFFFF" strokeWidth="2" />
        <SvgText x={relX} y={relY - 12} fill="#5DADE2" fontSize="11" fontWeight="800" textAnchor="middle">
          Release Point
        </SvgText>

        {/* Compass Rose */}
        <G transform={`translate(${width - 30}, 28)`}>
          <Circle cx="0" cy="0" r="13" fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
          <Line x1="0" y1="8" x2="0" y2="-8" stroke="#FF5252" strokeWidth="2" />
          <Line x1="-8" y1="0" x2="8" y2="0" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
          <SvgText x="0" y="-10" fill="#FF5252" fontSize="9" fontWeight="900" textAnchor="middle">
            N
          </SvgText>
        </G>
      </Svg>

      <View style={styles.legendBanner}>
        <View style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: '#2ECC71' }]} />
          <Text style={styles.legendTxt}>Current GPS</Text>
        </View>
        <Text style={styles.distTxt}>📍 {distanceKm.toFixed(2)} km ({bearingDeg.toFixed(0)}°)</Text>
        <View style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: '#2980B9' }]} />
          <Text style={styles.legendTxt}>Release Point</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#071F23',
    alignSelf: 'center',
    marginVertical: 8,
  },
  legendBanner: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 20, 24, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  legendTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E0F2F1',
  },
  distTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00E5FF',
  },
});
