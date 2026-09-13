import React from 'react';
import { View, StyleSheet, Dimensions, Platform, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Clipboard from 'expo-clipboard';
import { HotspotInfo } from '../services/pfzService';
import { Colors } from '../theme/colors';

const { width } = Dimensions.get('window');
const MAP_HEIGHT = 580;

interface INCOISMapComponentProps {
  center: { lat: number; lon: number };
  hotspots: HotspotInfo[];
  activeLayer: 'chl' | 'sst' | 'bathymetry';
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
  // Generate dynamic Leaflet HTML with pinch-zoom, user location, route line & copy coordinates
  const generateLeafletHTML = () => {
    const hotspotsJSON = JSON.stringify(hotspots);
    const targetJSON = selectedNavigationTarget ? JSON.stringify(selectedNavigationTarget) : 'null';

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
            font-size: 17px !important;
            color: #00F5D4 !important;
            margin-bottom: 6px !important;
          }
          .popup-info {
            font-size: 14px !important;
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
            font-size: 15px !important;
          }
          .copy-btn {
            background: #00F5D4 !important;
            color: #0D2526 !important;
            font-weight: 900 !important;
            font-size: 13px !important;
            border: none !important;
            padding: 8px 12px !important;
            border-radius: 8px !important;
            margin-top: 10px !important;
            cursor: pointer !important;
            width: 100% !important;
            text-align: center !important;
            box-shadow: 0 2px 6px rgba(0,245,212,0.4) !important;
          }
          .copy-btn:active {
            opacity: 0.8;
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
            width: 34px;
            height: 34px;
            background: radial-gradient(circle, #FF4757 35%, #C0392B 90%);
            border: 2.5px solid #FFFFFF;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            box-shadow: 0 0 16px rgba(255, 71, 87, 0.9), 0 2px 6px rgba(0,0,0,0.6);
          }
          .target-pin {
            width: 36px;
            height: 36px;
            background: radial-gradient(circle, #FFD166 35%, #D4AC0D 90%);
            border: 3px solid #FFFFFF;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 19px;
            box-shadow: 0 0 18px rgba(255, 209, 102, 1.0), 0 2px 8px rgba(0,0,0,0.7);
          }
          .legend-box {
            position: absolute;
            bottom: 16px;
            right: 12px;
            z-index: 1000;
            background: rgba(0, 31, 45, 0.92);
            border: 1.5px solid #00A896;
            border-radius: 10px;
            padding: 10px 14px;
            color: #FFFFFF;
            font-size: 12px;
            font-weight: 700;
            font-family: sans-serif;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          }
          .nav-route-banner {
            position: absolute;
            top: 14px;
            left: 14px;
            right: 70px;
            z-index: 1000;
            background: rgba(13, 37, 38, 0.92);
            border: 1.5px solid #00F5D4;
            border-radius: 10px;
            padding: 10px 14px;
            color: #FFFFFF;
            font-size: 13px;
            font-weight: 800;
            font-family: sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
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
            -webkit-user-select: none;
          }
          .zoom-btn:active {
            background: #00A896;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>

        ${
          selectedNavigationTarget
            ? `<div class="nav-route-banner">
                🧭 <b>LIVE NAVIGATION ROUTE</b><br>
                From: My Location (${center.lat.toFixed(3)}°N, ${center.lon.toFixed(3)}°E)<br>
                To: ${selectedNavigationTarget.name} (${selectedNavigationTarget.latitude.toFixed(3)}°N, ${selectedNavigationTarget.longitude.toFixed(3)}°E)
              </div>`
            : ''
        }

        <div class="floating-zoom-bar">
          <div class="zoom-btn" onclick="map.zoomIn()">+</div>
          <div class="zoom-btn" onclick="map.zoomOut()">−</div>
        </div>
        <div class="legend-box">
          <b>INCOIS Layer:</b> ${
            activeLayer === 'chl'
              ? '🌱 Chlorophyll-a'
              : activeLayer === 'sst'
              ? '🌡️ SST Temp Fronts'
              : '⚓ Gebco Bathymetry'
          }
        </div>
        <script>
          var map = L.map('map', {
            zoomControl: false,
            touchZoom: true,
            doubleClickZoom: true,
            scrollWheelZoom: true,
            boxZoom: true,
            dragging: true,
            tap: true,
            tapTolerance: 15,
            inertia: true,
            inertiaDeceleration: 2500,
            attributionControl: false
          }).setView([${center.lat}, ${center.lon}], 9.5);

          // Base Satellite / Ocean Map Layer
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            minZoom: 3
          }).addTo(map);

          // INCOIS GeoServer WMS Tile Layers
          var activeWMSLayer;
          ${
            activeLayer === 'chl'
              ? `
                activeWMSLayer = L.tileLayer.wms('https://incois.gov.in/geoserver/PFZ-TUNA-SST-CHL/wms', {
                  layers: 'PFZ-TUNA-SST-CHL:chl',
                  format: 'image/png',
                  transparent: true,
                  version: '1.1.0',
                  opacity: 0.75
                }).addTo(map);
              `
              : activeLayer === 'sst'
              ? `
                activeWMSLayer = L.tileLayer.wms('https://incois.gov.in/geoserver/PFZ-TUNA-SST-CHL/wms', {
                  layers: 'PFZ-TUNA-SST-CHL:sst',
                  format: 'image/png',
                  transparent: true,
                  version: '1.1.0',
                  opacity: 0.70
                }).addTo(map);
              `
              : `
                activeWMSLayer = L.tileLayer.wms('https://incois.gov.in/geoserver/BathymteryImage/wms', {
                  layers: 'BathymteryImage:gebcobathymtery',
                  format: 'image/png',
                  transparent: true,
                  version: '1.1.0',
                  opacity: 0.65
                }).addTo(map);
              `
          }

          function sendWebMessage(obj) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify(obj));
            }
          }

          function copyGpsCoords(lat, lon) {
            sendWebMessage({ type: 'COPY_COORDS', lat: lat, lon: lon });
          }

          // 1. Render User GPS Location Pin
          var userIcon = L.divIcon({
            className: 'user-pin-wrapper',
            html: '<div class="user-pin">🚤</div>',
            iconSize: [34, 34],
            iconAnchor: [17, 17]
          });
          var userMarker = L.marker([${center.lat}, ${center.lon}], { icon: userIcon }).addTo(map);
          userMarker.bindPopup('<div class="custom-popup"><div class="popup-title">🚤 MY LOCATION (GPS)</div><div class="popup-info"><span class="popup-label">Latitude:</span> <span class="popup-value">${center.lat.toFixed(4)}° N</span><br><span class="popup-label">Longitude:</span> <span class="popup-value">${center.lon.toFixed(4)}° E</span></div><button class="copy-btn" onclick="copyGpsCoords(${center.lat}, ${center.lon})">📋 Copy My GPS (${center.lat.toFixed(4)}, ${center.lon.toFixed(4)})</button></div>');

          // 2. Render Hotspots Custom Markers & INCOIS PFZ Vector Boundary Lines
          var hotspots = ${hotspotsJSON};
          var navTarget = ${targetJSON};
          var markerGroup = L.featureGroup();
          var sectorGroups = {};

          hotspots.forEach(function(spot) {
            var secId = spot.id.split('-')[0];
            if (!sectorGroups[secId]) sectorGroups[secId] = [];
            sectorGroups[secId].push([spot.latitude, spot.longitude]);

            var isSelectedTarget = navTarget && navTarget.id === spot.id;
            var pinClass = isSelectedTarget ? 'target-pin' : 'pfz-pin';
            var pinIcon = isSelectedTarget ? '🎯' : '🐟';

            var icon = L.divIcon({
              className: 'pfz-pin-wrapper',
              html: '<div class="' + pinClass + '">' + pinIcon + '</div>',
              iconSize: [32, 32],
              iconAnchor: [16, 16]
            });

            var marker = L.marker([spot.latitude, spot.longitude], { icon: icon });
            markerGroup.addLayer(marker);

            var popupContent = '<div class="custom-popup">' +
              '<div class="popup-title">' + pinIcon + ' ' + spot.name + '</div>' +
              '<div class="popup-info">' +
                '<span class="popup-label">📍 Latitude:</span> <span class="popup-value">' + spot.latitude + '° N</span><br>' +
                '<span class="popup-label">📍 Longitude:</span> <span class="popup-value">' + spot.longitude + '° E</span><br>' +
                '<span class="popup-label">⚓ Depth:</span> <span class="popup-value">' + spot.depth_meters + 'm</span><br>' +
                '<span class="popup-label">⏱️ Validity:</span> <span class="popup-value">' + spot.valid_until + '</span><br>' +
                '<span class="popup-label">🎯 Reliability:</span> <span class="popup-score">' + spot.reliability_score + '</span>' +
              '</div>' +
              '<button class="copy-btn" onclick="copyGpsCoords(' + spot.latitude + ', ' + spot.longitude + ')">📋 Copy GPS (' + spot.latitude + ', ' + spot.longitude + ')</button>' +
            '</div>';

            marker.bindPopup(popupContent);

            marker.on('click', function() {
              sendWebMessage({ type: 'HOTSPOT_SELECT', data: spot });
            });
          });

          markerGroup.addTo(map);

          // 3. Render Navigation Route Polyline if target is selected!
          if (navTarget) {
            var routeCoords = [
              [${center.lat}, ${center.lon}],
              [navTarget.latitude, navTarget.longitude]
            ];

            var routeLine = L.polyline(routeCoords, {
              color: '#00F5D4',
              weight: 4,
              dashArray: '8, 8',
              opacity: 0.95
            }).addTo(map);

            routeLine.bindPopup('<div class="custom-popup"><div class="popup-title">🧭 Live Navigation Route</div><div class="popup-info">My Location ➔ ' + navTarget.name + '</div></div>');

            // Auto-fit bounds to show BOTH My Location & Target Fishing Zone on map!
            var bounds = L.latLngBounds(routeCoords);
            map.fitBounds(bounds, { padding: [50, 50] });
          }

          // Draw INCOIS PFZ Convergence Vector Lines for all sectors
          Object.keys(sectorGroups).forEach(function(secId) {
            var coords = sectorGroups[secId];
            if (coords.length > 1) {
              coords.sort(function(a, b) { return a[0] - b[0]; });
              var polyline = L.polyline(coords, {
                color: '#3498DB',
                weight: 1.5,
                dashArray: '4, 4',
                opacity: 0.60
              }).addTo(map);
            }
          });
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
