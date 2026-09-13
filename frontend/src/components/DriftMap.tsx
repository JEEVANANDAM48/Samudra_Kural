import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
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
  width = Dimensions.get('window').width - 32,
  height = 320,
}) => {
  const webViewRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);

  if (!points || points.length === 0) {
    return (
      <View style={[styles.emptyContainer, { width, height }]}>
        <Text style={styles.emptyText}>Map data unavailable</Text>
      </View>
    );
  }

  // Trajectory coordinates array for Leaflet: [[lat, lon], ...]
  const trajCoords = points.map((p) => [p.latitude, p.longitude]);

  // Intermediate checkpoints
  const checkpoints = points.map((p, idx) => ({
    lat: p.latitude,
    lon: p.longitude,
    step: p.step_number,
    time: p.prediction_time_ist,
    dist: p.cumulative_distance_km,
    speed: p.drift_speed_mps,
    dir: p.drift_direction_cardinal,
    isRelease: idx === 0,
    isFinal: idx === points.length - 1,
  }));

  const radiusMeters = (searchArea.uncertainty_radius_km || 1.0) * 1000;
  const searchCenterLat = searchArea.center_latitude || points[points.length - 1]?.latitude || releaseLat;
  const searchCenterLon = searchArea.center_longitude || points[points.length - 1]?.longitude || releaseLon;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
      background-color: #E6F2F5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .leaflet-control-attribution {
      font-size: 8px !important;
      background: rgba(255,255,255,0.7) !important;
    }
    .custom-popup .leaflet-popup-content-wrapper {
      background: #004D40;
      color: #FFFFFF;
      border-radius: 8px;
      padding: 2px;
      font-size: 11px;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .custom-popup .leaflet-popup-tip {
      background: #004D40;
    }
    .pulse-marker {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pulse-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 0 8px rgba(0,0,0,0.4);
    }
    .pulse-ring {
      position: absolute;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      animation: pulsate 2s infinite ease-out;
      opacity: 0;
    }
    @keyframes pulsate {
      0% { transform: scale(0.3); opacity: 0.9; }
      100% { transform: scale(1.6); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Initialize map
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: true
    }).setView([${releaseLat}, ${releaseLon}], 13);

    // High quality OpenStreetMap standard tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    var bounds = L.latLngBounds();

    // 1. Probable Search Area (Yellow semi-transparent circle)
    var searchCircle = L.circle([${searchCenterLat}, ${searchCenterLon}], {
      radius: ${radiusMeters},
      color: '#D4AC0D',
      weight: 2.5,
      dashArray: '6, 6',
      fillColor: '#F4D03F',
      fillOpacity: 0.28
    }).addTo(map);
    searchCircle.bindPopup("<b>🎯 Predicted Search Area</b><br>±${searchArea.uncertainty_radius_km} km radius<br>${searchArea.sector_description}", { className: 'custom-popup' });
    bounds.extend(searchCircle.getBounds());

    // 2. Trajectory Polyline (Cyan glow)
    var trajCoords = ${JSON.stringify(trajCoords)};
    
    // Polyline shadow
    L.polyline(trajCoords, {
      color: '#006064',
      weight: 6,
      opacity: 0.5,
      lineCap: 'round'
    }).addTo(map);

    // Main Polyline
    var polyline = L.polyline(trajCoords, {
      color: '#00BCD4',
      weight: 4,
      opacity: 1.0,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);
    bounds.extend(polyline.getBounds());

    // 3. Intermediate Checkpoint markers
    var checkpoints = ${JSON.stringify(checkpoints)};
    checkpoints.forEach(function(cp) {
      if (!cp.isRelease && !cp.isFinal) {
        var marker = L.circleMarker([cp.lat, cp.lon], {
          radius: 4,
          fillColor: '#00BCD4',
          color: '#FFFFFF',
          weight: 2,
          fillOpacity: 1
        }).addTo(map);
        marker.bindPopup("<b>⏱️ Step " + cp.step + " (" + cp.time + ")</b><br>+" + cp.dist + " km • " + cp.dir + " (" + cp.speed.toFixed(2) + " m/s)", { className: 'custom-popup' });
      }
    });

    // 4. Blue Marker: Original Net Release Point
    var releaseIcon = L.divIcon({
      className: 'pulse-marker',
      html: '<div class="pulse-ring" style="border: 2px solid #2980B9; background: rgba(41,128,185,0.2);"></div><div class="pulse-dot" style="background: #2980B9;"></div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
    var releaseMarker = L.marker([${releaseLat}, ${releaseLon}], { icon: releaseIcon }).addTo(map);
    releaseMarker.bindPopup("<b>📍 Net Release Point</b><br>Lat: ${releaseLat.toFixed(4)}<br>Lon: ${releaseLon.toFixed(4)}", { className: 'custom-popup' });
    bounds.extend([${releaseLat}, ${releaseLon}]);

    // 5. Predicted Endpoint Marker (Target Pin)
    var finalCp = checkpoints[checkpoints.length - 1];
    if (finalCp) {
      var endIcon = L.divIcon({
        className: 'pulse-marker',
        html: '<div class="pulse-ring" style="border: 2px solid #D4AC0D; background: rgba(244,208,63,0.3);"></div><div class="pulse-dot" style="background: #D4AC0D;"></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      var endMarker = L.marker([finalCp.lat, finalCp.lon], { icon: endIcon }).addTo(map);
      endMarker.bindPopup("<b>🎯 Final Predicted Center</b><br>Movement: ~" + finalCp.dist + " km " + finalCp.dir + "<br>Time: " + finalCp.time, { className: 'custom-popup' });
      bounds.extend([finalCp.lat, finalCp.lon]);
    }

    // 6. Green Marker: Current Fisherman GPS (if available)
    ${fishermanLat !== undefined && fishermanLon !== undefined ? `
    var fishermanIcon = L.divIcon({
      className: 'pulse-marker',
      html: '<div class="pulse-ring" style="border: 2px solid #2ECC71; background: rgba(46,204,113,0.25);"></div><div class="pulse-dot" style="background: #2ECC71;"></div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
    var fishermanMarker = L.marker([${fishermanLat}, ${fishermanLon}], { icon: fishermanIcon }).addTo(map);
    fishermanMarker.bindPopup("<b>👤 Your Current Location (Boat)</b><br>Lat: ${fishermanLat.toFixed(4)}<br>Lon: ${fishermanLon.toFixed(4)}", { className: 'custom-popup' });
    bounds.extend([${fishermanLat}, ${fishermanLon}]);
    ` : ''}

    // Fit map to show all points with comfortable padding
    map.fitBounds(bounds, { padding: [35, 35] });

    // Function to re-center
    window.resetMapBounds = function() {
      map.fitBounds(bounds, { padding: [35, 35] });
    };
  </script>
</body>
</html>
  `;

  return (
    <View style={[styles.cardContainer, { width }]}>
      <View style={[styles.mapWrapper, { height }]}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onLoadEnd={() => setMapLoaded(true)}
        />

        {!mapLoaded && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.mapLoadingText}>Loading live map...</Text>
          </View>
        )}

        {/* Floating Reset Button */}
        <TouchableOpacity
          style={styles.recenterBtn}
          activeOpacity={0.8}
          onPress={() => {
            webViewRef.current?.injectJavaScript('window.resetMapBounds && window.resetMapBounds(); true;');
          }}
        >
          <Text style={styles.recenterIcon}>🎯 Center</Text>
        </TouchableOpacity>
      </View>

      {/* Map Legend Banner */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#2980B9' }]} />
          <Text style={styles.legendLabel}>Release (Blue)</Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: '#00BCD4' }]} />
          <Text style={styles.legendLabel}>Trajectory (Cyan)</Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F4D03F', borderColor: '#D4AC0D', borderWidth: 1 }]} />
          <Text style={styles.legendLabel}>Search Area (Yellow)</Text>
        </View>

        {fishermanLat !== undefined && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#2ECC71' }]} />
            <Text style={styles.legendLabel}>You (Green)</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D8ECE8',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  mapWrapper: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#E6F2F5',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#E6F2F5',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  mapLoadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  recenterBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B2DFDB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  recenterIcon: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F7FCFB',
    borderTopWidth: 1,
    borderTopColor: '#E0F2F1',
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  legendLine: {
    width: 14,
    height: 3.5,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyContainer: {
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
});
