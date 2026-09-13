import React from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { HotspotInfo } from '../services/pfzService';
import { Colors } from '../theme/colors';

const { width } = Dimensions.get('window');
const MAP_HEIGHT = 580;

interface INCOISMapComponentProps {
  center: { lat: number; lon: number };
  hotspots: HotspotInfo[];
  activeLayer: 'chl' | 'sst' | 'bathymetry';
  onNavigateToHotspot?: (hotspot: HotspotInfo) => void;
}

export const INCOISMapComponent: React.FC<INCOISMapComponentProps> = ({
  center,
  hotspots,
  activeLayer,
}) => {
  // Generate dynamic Leaflet HTML with pinch-zoom, floating controls & INCOIS WMS
  const generateLeafletHTML = () => {
    const hotspotsJSON = JSON.stringify(hotspots);

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
            font-size: 18px !important;
            color: #00F5D4 !important;
            margin-bottom: 8px !important;
          }
          .popup-info {
            font-size: 15px !important;
            color: #FFFFFF !important;
            line-height: 1.7 !important;
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
            font-size: 16px !important;
          }
          .pfz-pin {
            width: 30px;
            height: 30px;
            background: radial-gradient(circle, #00F5D4 35%, #005F60 90%);
            border: 2.5px solid #FFFFFF;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            box-shadow: 0 0 12px rgba(0, 245, 212, 0.9), 0 2px 6px rgba(0,0,0,0.6);
            cursor: pointer;
          }
          .legend-box {
            position: absolute;
            bottom: 16px;
            right: 12px;
            z-index: 1000;
            background: rgba(0, 31, 45, 0.90);
            border: 1.5px solid #00A896;
            border-radius: 10px;
            padding: 10px 14px;
            color: #FFFFFF;
            font-size: 13px;
            font-weight: 700;
            font-family: sans-serif;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
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

          // Hotspots Custom Markers & INCOIS PFZ Vector Boundary Lines
          var hotspots = ${hotspotsJSON};
          var markerGroup = L.featureGroup();
          var sectorGroups = {};

          hotspots.forEach(function(spot) {
            var secId = spot.id.split('-')[0];
            if (!sectorGroups[secId]) sectorGroups[secId] = [];
            sectorGroups[secId].push([spot.latitude, spot.longitude]);

            var icon = L.divIcon({
              className: 'pfz-pin-wrapper',
              html: '<div class="pfz-pin">🐟</div>',
              iconSize: [26, 26],
              iconAnchor: [13, 13]
            });

            var marker = L.marker([spot.latitude, spot.longitude], { icon: icon });
            markerGroup.addLayer(marker);

            var popupContent = '<div class="custom-popup">' +
              '<div class="popup-title">🐟 ' + spot.name + '</div>' +
              '<div class="popup-info">' +
                '<span class="popup-label">📍 Latitude:</span> <span class="popup-value">' + spot.latitude + '° N</span><br>' +
                '<span class="popup-label">📍 Longitude:</span> <span class="popup-value">' + spot.longitude + '° E</span><br>' +
                '<span class="popup-label">⚓ Depth:</span> <span class="popup-value">' + spot.depth_meters + 'm</span><br>' +
                '<span class="popup-label">⏱️ Validity:</span> <span class="popup-value">' + spot.valid_until + '</span><br>' +
                '<span class="popup-label">🎯 Reliability:</span> <span class="popup-score">' + spot.reliability_score + '</span>' +
              '</div>' +
            '</div>';

            marker.bindPopup(popupContent);
          });

          markerGroup.addTo(map);

          // Draw INCOIS PFZ Convergence Vector Lines for all sectors
          Object.keys(sectorGroups).forEach(function(secId) {
            var coords = sectorGroups[secId];
            if (coords.length > 1) {
              coords.sort(function(a, b) { return a[0] - b[0]; });
              var polyline = L.polyline(coords, {
                color: '#00F5D4',
                weight: 2,
                dashArray: '6, 6',
                opacity: 0.85
              }).addTo(map);
              polyline.bindPopup('<div class="custom-popup"><div class="popup-title">INCOIS PFZ Thermal/Chl Front (' + secId + ')</div><div class="popup-info">Official Oceanographic High-Fish Aggregation Zone</div></div>');
            }
          });
        </script>
      </body>
      </html>
    `;
  };

  const html = generateLeafletHTML();

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
