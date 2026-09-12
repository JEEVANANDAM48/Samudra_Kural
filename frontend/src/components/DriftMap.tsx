import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
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
  fishermanLat?: number;
  fishermanLon?: number;
  width?: number;
  height?: number;
}

export const DriftMap: React.FC<DriftMapProps> = ({
  points,
  searchArea,
  releaseLat,
  releaseLon,
  fishermanLat,
  fishermanLon,
  width = Dimensions.get('window').width - 48,
  height = 250,
}) => {
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  if (!points || points.length === 0) {
    return (
      <View style={[styles.emptyContainer, { width, height }]}>
        <Text style={styles.emptyText}>Map data unavailable</Text>
      </View>
    );
  }

  const lats = [releaseLat, searchArea.center_latitude, ...points.map((p) => p.latitude)];
  const lons = [releaseLon, searchArea.center_longitude, ...points.map((p) => p.longitude)];

  if (fishermanLat !== undefined && fishermanLon !== undefined) {
    lats.push(fishermanLat);
    lons.push(fishermanLon);
  }

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const baseLatSpan = Math.max(0.015, maxLat - minLat) * 1.5;
  const baseLonSpan = Math.max(0.015, maxLon - minLon) * 1.5;

  const latSpan = baseLatSpan / zoomScale;
  const lonSpan = baseLonSpan / zoomScale;

  const midLat = (minLat + maxLat) / 2.0;
  const midLon = (minLon + maxLon) / 2.0;

  const mapMinLat = midLat - latSpan / 2.0;
  const mapMaxLat = midLat + latSpan / 2.0;
  const mapMinLon = midLon - lonSpan / 2.0;
  const mapMaxLon = midLon + lonSpan / 2.0;

  const padding = 28;
  const projX = (lon: number) => padding + ((lon - mapMinLon) / (mapMaxLon - mapMinLon)) * (width - 2 * padding);
  const projY = (lat: number) => height - padding - ((lat - mapMinLat) / (mapMaxLat - mapMinLat)) * (height - 2 * padding);

  const releaseX = projX(releaseLon);
  const releaseY = projY(releaseLat);

  const predictedX = projX(searchArea.center_latitude);
  const predictedY = projY(searchArea.center_latitude);

  const polyPoints = points.map((p) => `${projX(p.longitude)},${projY(p.latitude)}`).join(' ');

  const radiusKm = searchArea.uncertainty_radius_km || 1.0;
  const latRadiusDeg = radiusKm / 111.0;
  const pixelRadius = Math.max(20, Math.min(width / 2.8, (latRadiusDeg / latSpan) * (height - 2 * padding)));

  // YELLOW / Amber theme for predicted search area
  const searchAreaColor = '#F4D03F';

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="seaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#0B3036" />
            <Stop offset="100%" stopColor="#061B20" />
          </LinearGradient>
          <LinearGradient id="searchGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={searchAreaColor} stopOpacity="0.4" />
            <Stop offset="100%" stopColor={searchAreaColor} stopOpacity="0.08" />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width={width} height={height} rx="16" fill="url(#seaGrad)" />

        {/* Waves effect */}
        <Path
          d={`M0 ${height * 0.3} Q ${width * 0.25} ${height * 0.25}, ${width * 0.5} ${height * 0.3} T ${width} ${height * 0.3}`}
          stroke="rgba(0, 168, 150, 0.15)"
          strokeWidth="1.5"
          fill="none"
        />

        {/* YELLOW: Predicted Search Area Circle */}
        <Circle
          cx={predictedX}
          cy={predictedY}
          r={pixelRadius}
          fill="url(#searchGlow)"
          stroke={searchAreaColor}
          strokeWidth="2.5"
          strokeDasharray="6, 4"
        />

        {/* CYAN: Predicted Trajectory Path */}
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

        {/* Drift direction guide line */}
        <Line
          x1={releaseX}
          y1={releaseY}
          x2={predictedX}
          y2={predictedY}
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth="1.5"
          strokeDasharray="4, 4"
        />

        {/* BLUE: Original Release Point Marker */}
        <Circle cx={releaseX} cy={releaseY} r="10" fill="#3498DB" opacity="0.4" />
        <Circle cx={releaseX} cy={releaseY} r="6" fill="#2980B9" stroke="#FFFFFF" strokeWidth="2" />
        <SvgText x={releaseX} y={releaseY + 18} fill="#5DADE2" fontSize="11" fontWeight="800" textAnchor="middle">
          Release Point
        </SvgText>

        {/* Predicted Point Center */}
        <Circle cx={predictedX} cy={predictedY} r="11" fill={searchAreaColor} opacity="0.4" />
        <Circle cx={predictedX} cy={predictedY} r="6" fill="#F39C12" stroke="#FFFFFF" strokeWidth="2" />
        <SvgText x={predictedX} y={predictedY - 14} fill={searchAreaColor} fontSize="11" fontWeight="900" textAnchor="middle">
          Search Area
        </SvgText>

        {/* GREEN: Current Fisherman GPS Location (if provided) */}
        {fishermanLat !== undefined && fishermanLon !== undefined && (
          <G>
            <Circle cx={projX(fishermanLon)} cy={projY(fishermanLat)} r="10" fill="#2ECC71" opacity="0.3" />
            <Circle cx={projX(fishermanLon)} cy={projY(fishermanLat)} r="5.5" fill="#2ECC71" stroke="#FFFFFF" strokeWidth="2" />
            <SvgText x={projX(fishermanLon)} y={projY(fishermanLat) + 16} fill="#2ECC71" fontSize="10" fontWeight="800" textAnchor="middle">
              You
            </SvgText>
          </G>
        )}

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

      {/* Floating Legend and Zoom Controls */}
      <View style={styles.controlsRow}>
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#2980B9' }]} />
            <Text style={styles.legendTxt}>Release (Blue)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#00E5FF' }]} />
            <Text style={styles.legendTxt}>Trajectory (Cyan)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: searchAreaColor }]} />
            <Text style={styles.legendTxt}>Search Area (Yellow)</Text>
          </View>
        </View>

        <View style={styles.zoomButtons}>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => setZoomScale((prev) => Math.min(2.5, prev + 0.3))}
          >
            <Text style={styles.zoomBtnTxt}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => setZoomScale((prev) => Math.max(0.7, prev - 0.3))}
          >
            <Text style={styles.zoomBtnTxt}>−</Text>
          </TouchableOpacity>
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
  controlsRow: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(5, 20, 24, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 4,
  },
  legendTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E0F2F1',
  },
  zoomButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  zoomBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 95, 96, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  zoomBtnTxt: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 18,
  },
});
