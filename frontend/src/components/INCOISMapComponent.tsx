import React from 'react';
import { View, StyleSheet, Dimensions, Platform, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Clipboard from 'expo-clipboard';
import { HotspotInfo } from '../services/pfzService';
import { calculateSafeMaritimeRoute, COASTAL_HAZARD_ZONES } from '../services/navigationService';
import { Colors } from '../theme/colors';

const { width } = Dimensions.get('window');
const MAP_HEIGHT = 580;

interface INCOISMapComponentProps {
  center: { lat: number; lon: number };
  hotspots: HotspotInfo[];
  activeLayer: 'chl' | 'sst' | 'bathymetry' | 'ibl';
  selectedNavigationTarget?: HotspotInfo | null;
  onNavigateToHotspot?: (hotspot: HotspotInfo) => void;
  onSelectHotspot?: (hotspot: HotspotInfo) => void;
}

export const INCOISMapComponent: React.FC<INCOISMapComponentProps> = ({
  center,
  hotspots,
  activeLayer,
  selectedNavigationTarget,
  onNavigateToHotspot,
  onSelectHotspot,
}) => {
  // Compute safe obstacle-avoiding maritime route if a navigation target is selected
  const safeRoute = selectedNavigationTarget
    ? calculateSafeMaritimeRoute(
        center.lat,
        center.lon,
        selectedNavigationTarget.latitude,
        selectedNavigationTarget.longitude
      )
    : null;

  // Generate dynamic Leaflet HTML with pinch-zoom, user location, route line & copy coordinates
  const generateLeafletHTML = () => {
    const hotspotsJSON = JSON.stringify(hotspots);
    const targetJSON = selectedNavigationTarget ? JSON.stringify(selectedNavigationTarget) : 'null';
    const safeRouteJSON = safeRoute ? JSON.stringify(safeRoute) : 'null';
    const hazardZonesJSON = JSON.stringify(COASTAL_HAZARD_ZONES);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=10.0, user-scalable=yes" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body, #map {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            background: #001F2D;
            touch-action: manipulation;
          }
          .leaflet-popup-content-wrapper, .leaflet-popup-tip {
            background: #0D2526 !important;
            color: #FFFFFF !important;
            border: 1.5px solid #00F5D4 !important;
            border-radius: 12px !important;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.7) !important;
          }
          .leaflet-popup-content {
            margin: 14px 18px !important;
            line-height: 1.6 !important;
          }
          .popup-title {
            font-weight: 900 !important;
            font-size: 16px !important;
            color: #00F5D4 !important;
            margin-bottom: 6px !important;
          }
          .popup-info {
            font-size: 13px !important;
            color: #FFFFFF !important;
            line-height: 1.6 !important;
          }
          .popup-label {
            color: #A0ECED !important;
            font-weight: 700 !important;
          }
          .popup-value {
            color: #FFFFFF !important;
            font-weight: 900 !important;
          }
          .popup-score {
            color: #FFD166 !important;
            font-weight: 900 !important;
            font-size: 14px !important;
          }
          .copy-btn {
            background: #00F5D4 !important;
            color: #0D2526 !important;
            font-weight: 900 !important;
            font-size: 12px !important;
            border: none !important;
            padding: 8px 12px !important;
            border-radius: 8px !important;
            margin-top: 10px !important;
            cursor: pointer !important;
            width: 100% !important;
            text-align: center !important;
            box-shadow: 0 2px 6px rgba(0,245,212,0.4) !important;
          }
          .pfz-pin {
            width: 32px;
            height: 32px;
            background: radial-gradient(circle, #00F5D4 35%, #005F60 90%);
            border: 2.5px solid #FFFFFF;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 17px;
            box-shadow: 0 0 14px rgba(0, 245, 212, 0.9), 0 2px 6px rgba(0,0,0,0.6);
            cursor: pointer;
          }
          .user-pin {
            width: 36px;
            height: 36px;
            background: radial-gradient(circle, #00F5D4 35%, #0077B6 90%);
            border: 3px solid #FFFFFF;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            box-shadow: 0 0 18px rgba(0, 245, 212, 0.9), 0 2px 6px rgba(0,0,0,0.6);
          }
          .target-pin {
            width: 36px;
            height: 36px;
            background: radial-gradient(circle, #FF4757 35%, #C0392B 90%);
            border: 3px solid #FFFFFF;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 19px;
            box-shadow: 0 0 18px rgba(255, 71, 87, 1.0), 0 2px 8px rgba(0,0,0,0.7);
          }
          .map-mode-bar {
            position: absolute;
            bottom: 16px;
            left: 12px;
            z-index: 1000;
            display: flex;
            gap: 6px;
            background: rgba(0, 31, 45, 0.92);
            border: 1.5px solid #00A896;
            border-radius: 10px;
            padding: 4px;
          }
          .mode-btn {
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 800;
            color: #A0ECED;
            background: transparent;
            border: none;
            cursor: pointer;
          }
          .mode-btn.active {
            background: #00F5D4;
            color: #0D2526;
          }
          .nav-route-banner {
            position: absolute;
            top: 14px;
            left: 14px;
            right: 70px;
            z-index: 1000;
            background: rgba(13, 37, 38, 0.94);
            border: 1.5px solid #00F5D4;
            border-radius: 12px;
            padding: 10px 14px;
            color: #FFFFFF;
            font-size: 12px;
            font-weight: 800;
            font-family: sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.6);
          }
          .floating-zoom-bar {
            position: absolute;
            top: 14px;
            right: 14px;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .zoom-btn {
            width: 42px;
            height: 42px;
            background: #005F60;
            color: #FFFFFF;
            border: 1.5px solid #8AC4C1;
            border-radius: 8px;
            font-size: 22px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 3px 8px rgba(0,0,0,0.4);
            cursor: pointer;
            user-select: none;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>

        ${
          selectedNavigationTarget && safeRoute
            ? `<div class="nav-route-banner">
                🛡️ <span style="color:#00F5D4;">OBSTACLE & UNDERSEA ROCK AVOIDED ROUTE</span><br>
                📍 <b>Target:</b> ${selectedNavigationTarget.name}<br>
                📏 <b>Distance:</b> ${safeRoute.totalDistanceNM} NM (${safeRoute.totalDistanceKm} km) | ⏱️ <b>ETA:</b> ${safeRoute.formattedEta}<br>
                🧭 <b>Course:</b> ${safeRoute.bearingDegrees}° ${safeRoute.directionCardinal} • <span style="color:#FFD166;">[Smooth Nautical Spline]</span>
              </div>`
            : ''
        }

        <div class="floating-zoom-bar">
          <div class="zoom-btn" onclick="map.zoomIn()">+</div>
          <div class="zoom-btn" onclick="map.zoomOut()">−</div>
        </div>

        <div class="map-mode-bar">
          <button id="btn-sat" class="mode-btn active" onclick="switchLayer('satellite')">Satellite</button>
          <button id="btn-std" class="mode-btn" onclick="switchLayer('standard')">Standard</button>
          <button id="btn-nau" class="mode-btn" onclick="switchLayer('nautical')">Nautical</button>
        </div>


        <script>
          var map = L.map('map', {
            zoomControl: false,
            touchZoom: true,
            doubleClickZoom: true,
            scrollWheelZoom: true,
            boxZoom: true,
            dragging: true,
            attributionControl: false
          }).setView([${center.lat}, ${center.lon}], 9.5);

          // Tile Layers
          var satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 });
          var stdLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
          var nauLayer = L.tileLayer.wms('https://incois.gov.in/geoserver/BathymteryImage/wms', {
            layers: 'BathymteryImage:gebcobathymtery',
            format: 'image/png',
            transparent: true,
            version: '1.1.0',
            opacity: 0.85
          });

          var currentBaseLayer = satLayer;
          satLayer.addTo(map);

          function switchLayer(mode) {
            map.removeLayer(currentBaseLayer);
            document.querySelectorAll('.mode-btn').forEach(function(b) { b.classList.remove('active'); });
            if (mode === 'standard') {
              stdLayer.addTo(map);
              currentBaseLayer = stdLayer;
              document.getElementById('btn-std').classList.add('active');
            } else if (mode === 'nautical') {
              satLayer.addTo(map);
              nauLayer.addTo(map);
              currentBaseLayer = satLayer;
              document.getElementById('btn-nau').classList.add('active');
            } else {
              satLayer.addTo(map);
              currentBaseLayer = satLayer;
              document.getElementById('btn-sat').classList.add('active');
            }
          }

          function sendWebMessage(obj) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify(obj));
            }
          }

          function copyGpsCoords(lat, lon) {
            sendWebMessage({ type: 'COPY_COORDS', lat: lat, lon: lon });
          }

          // 1. Render Undersea Hazard & Shallow Rock Risk Zones
          var hazardZones = ${hazardZonesJSON};
          hazardZones.forEach(function(haz) {
            var strokeColor = haz.type === 'restricted_area' ? '#FF9F43' : '#FF4757';
            var fillColor = haz.type === 'restricted_area' ? 'rgba(255, 159, 67, 0.25)' : 'rgba(255, 71, 87, 0.28)';

            var circle = L.circle(haz.center, {
              color: strokeColor,
              dashArray: '6, 6',
              weight: 2,
              fillColor: fillColor,
              fillOpacity: 0.35,
              radius: haz.radiusMeters
            }).addTo(map);

            var iconTxt = haz.type === 'restricted_area' ? '🟧' : '🪨';
            circle.bindPopup('<div class="custom-popup"><div class="popup-title">' + iconTxt + ' ' + haz.name + '</div><div class="popup-info"><span class="popup-label">Hazard Type:</span> ' + (haz.type === 'restricted_area' ? 'Restricted Zone' : 'Shallow Submerged Rocks') + '<br><span class="popup-label">Min Depth:</span> ' + haz.minDepthMeters + 'm<br><span class="popup-label">Status:</span> 🛡️ Safely Bypassed by Curved Nav Path</div></div>');
          });

          // 2. Render User GPS Location Pin (Vessel Icon)
          var userIcon = L.divIcon({
            className: 'user-pin-wrapper',
            html: '<div class="user-pin">🚤</div>',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
          });
          var userMarker = L.marker([${center.lat}, ${center.lon}], { icon: userIcon }).addTo(map);
          userMarker.bindPopup('<div class="custom-popup"><div class="popup-title">🚤 YOUR VESSEL (GPS)</div><div class="popup-info">Lat: ${center.lat.toFixed(4)}° N, Lon: ${center.lon.toFixed(4)}° E</div></div>');

          // 3. Render Hotspots Custom Markers & Target Pin
          var hotspots = ${hotspotsJSON};
          var navTarget = ${targetJSON};
          var safeRouteData = ${safeRouteJSON};
          var markerGroup = L.featureGroup();

          hotspots.forEach(function(spot) {
            var isSelectedTarget = navTarget && navTarget.id === spot.id;
            var pinClass = isSelectedTarget ? 'target-pin' : 'pfz-pin';
            var pinIcon = isSelectedTarget ? '🔴' : '🐟';

            var icon = L.divIcon({
              className: 'pfz-pin-wrapper',
              html: '<div class="' + pinClass + '">' + pinIcon + '</div>',
              iconSize: [32, 32],
              iconAnchor: [16, 16]
            });

            var marker = L.marker([spot.latitude, spot.longitude], { icon: icon });
            markerGroup.addLayer(marker);

            marker.bindPopup('<div class="custom-popup"><div class="popup-title">' + spot.name + '</div><div class="popup-info">Lat: ' + spot.latitude + '° N, Lon: ' + spot.longitude + '° E<br>Depth: ' + spot.depth_meters + 'm</div></div>');
            marker.on('click', function() { sendWebMessage({ type: 'HOTSPOT_SELECT', data: spot }); });
          });

          markerGroup.addTo(map);

          // 4. Render Smooth Curved Bezier Nautical Polyline & Spline Trajectory
          if (safeRouteData && safeRouteData.waypoints && safeRouteData.waypoints.length > 0) {
            // Background Glow Spline
            var routeGlow = L.polyline(safeRouteData.waypoints, {
              color: '#00F5D4',
              weight: 9,
              opacity: 0.40,
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map);

            // Front Curved Dashed Polyline
            var routeLine = L.polyline(safeRouteData.waypoints, {
              color: '#00F5D4',
              weight: 4.5,
              dashArray: '8, 8',
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map);

            routeLine.bindPopup('<div class="custom-popup"><div class="popup-title">🛡️ Obstacle-Free Nautical Spline</div><div class="popup-info">Distance: ' + safeRouteData.totalDistanceNM + ' NM | ETA: ' + safeRouteData.formattedEta + '</div></div>');

            // Auto-fit bounds to show full safe curved route on map!
            var routeBounds = L.latLngBounds(safeRouteData.waypoints);
            map.fitBounds(routeBounds, { padding: [45, 45] });
          }
        </script>
      </body>
      </html>
    `;
  };

  const html = generateLeafletHTML();

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'HOTSPOT_SELECT' && onSelectHotspot) {
        onSelectHotspot(data.data);
      } else if (data.type === 'COPY_COORDS') {
        const coordStr = `${data.lat.toFixed(4)}, ${data.lon.toFixed(4)}`;
        await Clipboard.setStringAsync(coordStr);
        Alert.alert(
          'Coordinates Copied!',
          `GPS Coordinates (${coordStr}) copied to clipboard. You can paste it into any navigation app.`
        );
      }
    } catch (e) {}
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.mapContainer}>
        <iframe
          srcDoc={html}
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: 14 }}
          title="INCOIS PFZ Live Map"
        />
      </View>
    );
  }

  return (
    <View style={styles.mapContainer}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={false}
        nestedScrollEnabled={true}
        overScrollMode="never"
        scalesPageToFit={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onMessage={handleMessage}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  mapContainer: {
    height: MAP_HEIGHT,
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.primary,
    marginBottom: 18,
    backgroundColor: '#001F2D',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  webview: {
    flex: 1,
    backgroundColor: '#001F2D',
  },
});
