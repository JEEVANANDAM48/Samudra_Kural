import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, {
  Circle,
  Line,
  Polyline,
  Text as SvgText,
  G,
  Path,
  Defs,
  LinearGradient,
  Stop,
  Rect
} from 'react-native-svg';
import { Colors } from '../theme/colors';
import { TrajectoryPoint, SearchArea } from '../types/net';

interface DriftMapProps {
  points: TrajectoryPoint[];
  searchArea: SearchArea;
  releaseLat: number;
  releaseLon: number;
  width?: number;
  height?: number;
}

export const DriftMap: React.FC<DriftMapProps> = ({
  points,
  searchArea,
  releaseLat,
  releaseLon,
  width = Dimensions.get('window').width - 48,
  height = 240,
}) => {
  if (!points || points.length === 0) {
    return (
      <View style={[styles.emptyContainer, { width, height }]}>
        <Text style={styles.emptyText}>Map data unavailable</Text>
      </View>
    );
  }

  // Calculate coordinate bounding box for SVG projection
  const lats = [releaseLat, searchArea.center_latitude, ...points.map((p) => p.latitude)];
  const lons = [releaseLon, searchArea.center_longitude, ...points.map((p) => p.longitude)];

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  // Add padding around bounds
  const latSpan = Math.max(0.015, maxLat - minLat) * 1.5;
  const lonSpan = Math.max(0.015, maxLon - minLon) * 1.5;

  const midLat = (minLat + maxLat) / 2.0;
  const midLon = (minLon + maxLon) / 2.0;

  const mapMinLat = midLat - latSpan / 2.0;
  const mapMaxLat = midLat + latSpan / 2.0;
  const mapMinLon = midLon - lonSpan / 2.0;
  const mapMaxLon = midLon + lonSpan / 2.0;

  // Projection from (lat, lon) to SVG (x, y)
  const padding = 28;
  const projX = (lon: number) => {
    return padding + ((lon - mapMinLon) / (mapMaxLon - mapMinLon)) * (width - 2 * padding);
  };
  const projY = (lat: number) => {
    // Latitude increases upwards, SVG Y increases downwards
    return height - padding - ((lat - mapMinLat) / (mapMaxLat - mapMinLat)) * (height - 2 * padding);
  };

  const releaseX = projX(releaseLon);
  const releaseY = projY(releaseLat);

  const predictedX = projX(searchArea.center_latitude);
  const predictedY = projY(searchArea.center_latitude);

  // SVG polyline points string
  const polyPoints = points.map((p) => `${projX(p.longitude)},${projY(p.latitude)}`).join(' ');

  // Approximate search radius in pixels
  const radiusKm = searchArea.uncertainty_radius_km || 1.0;
  const kmPerDegreeLat = 111.0;
  const latRadiusDeg = radiusKm / kmPerDegreeLat;
  const pixelRadius = Math.max(18, Math.min(width / 3.2, (latRadiusDeg / latSpan) * (height - 2 * padding)));

  const confidenceColor =
    searchArea.confidence === 'HIGH'
      ? '#1E824C'
      : searchArea.confidence === 'LOW'
      ? '#D35400'
      : '#D4AC0D';

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          {/* Nautical sea water gradient */}
          <LinearGradient id="seaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#0B3036" />
            <Stop offset="100%" stopColor="#061B20" />
          </LinearGradient>
          {/* Search zone radial glow */}
          <LinearGradient id="searchGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={confidenceColor} stopOpacity="0.35" />
            <Stop offset="100%" stopColor={confidenceColor} stopOpacity="0.08" />
          </LinearGradient>
        </Defs>

        {/* Nautical Sea Background */}
        <Rect x="0" y="0" width={width} height={height} rx="16" fill="url(#seaGrad)" />

        {/* Subtle Depth Waves */}
        <Path
          d={`M0 ${height * 0.3} Q ${width * 0.25} ${height * 0.25}, ${width * 0.5} ${height * 0.3} T ${width} ${height * 0.3}`}
          stroke="rgba(0, 168, 150, 0.12)"
          strokeWidth="1.5"
          fill="none"
        />
        <Path
          d={`M0 ${height * 0.7} Q ${width * 0.25} ${height * 0.65}, ${width * 0.5} ${height * 0.7} T ${width} ${height * 0.7}`}
          stroke="rgba(0, 168, 150, 0.12)"
          strokeWidth="1.5"
          fill="none"
        />

        {/* Uncertainty Search Area Circle */}
        <Circle
          cx={predictedX}
          cy={predictedY}
          r={pixelRadius}
          fill="url(#searchGlow)"
          stroke={confidenceColor}
          strokeWidth="2"
          strokeDasharray="5, 3"
        />

        {/* Trajectory Drift Path */}
        <Polyline
          points={polyPoints}
          fill="none"
          stroke="#00E5FF"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Checkpoint dots */}
        {points.map((p, idx) => {
          if (idx === 0 || idx === points.length - 1) return null;
          const px = projX(p.longitude);
          const py = projY(p.latitude);
          return (
            <Circle
              key={idx}
              cx={px}
              cy={py}
              r="3.5"
              fill="#FFFFFF"
              stroke="#00A896"
              strokeWidth="1.5"
            />
          );
        })}

        {/* Direct Drift Vector Guide Line */}
        <Line
          x1={releaseX}
          y1={releaseY}
          x2={predictedX}
          y2={predictedY}
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth="1.5"
          strokeDasharray="4, 4"
        />

        {/* Release Point Marker (Green Flag / Pulse) */}
        <Circle cx={releaseX} cy={releaseY} r="8" fill="#2ECC71" opacity="0.4" />
        <Circle cx={releaseX} cy={releaseY} r="5" fill="#2ECC71" stroke="#FFFFFF" strokeWidth="2" />
        <SvgText
          x={releaseX}
          y={releaseY + 16}
          fill="#FFFFFF"
          fontSize="11"
          fontWeight="700"
          textAnchor="middle"
        >
          Release
        </SvgText>

        {/* Predicted Point Marker (Search Area Center) */}
        <Circle cx={predictedX} cy={predictedY} r="9" fill={confidenceColor} opacity="0.4" />
        <Circle cx={predictedX} cy={predictedY} r="5.5" fill="#FF5252" stroke="#FFFFFF" strokeWidth="2" />
        <SvgText
          x={predictedX}
          y={predictedY - 12}
          fill="#FFF"
          fontSize="11"
          fontWeight="800"
          textAnchor="middle"
        >
          Predicted Area
        </SvgText>

        {/* Minimal Compass Rose in Top-Right */}
        <G transform={`translate(${width - 32}, 30)`}>
          <Circle cx="0" cy="0" r="14" fill="rgba(0, 30, 35, 0.7)" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" />
          <Line x1="0" y1="9" x2="0" y2="-9" stroke="#FF5252" strokeWidth="2" />
          <Line x1="-9" y1="0" x2="9" y2="0" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="1.5" />
          <SvgText x="0" y="-12" fill="#FF5252" fontSize="9" fontWeight="900" textAnchor="middle">
            N
          </SvgText>
        </G>
      </Svg>

      {/* Floating Legend / Scale Info */}
      <View style={styles.mapOverlay}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#2ECC71' }]} />
          <Text style={styles.legendLabel}>Release Point</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: confidenceColor }]} />
          <Text style={styles.legendLabel}>Search Zone (~{radiusKm} km)</Text>
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
  emptyContainer: {
    borderRadius: 16,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(5, 20, 24, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E0F2F1',
  },
});
