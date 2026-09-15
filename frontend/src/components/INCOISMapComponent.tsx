import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, Platform, Alert, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Clipboard from 'expo-clipboard';
import { HotspotInfo } from '../services/pfzService';
import { Colors } from '../theme/colors';
import {
  calculateSafeMaritimeRoute,
  COASTAL_HAZARDS,
  SafeRoutePlan,
} from '../services/navigationService';

const { width } = Dimensions.get('window');
const MAP_HEIGHT = 580;

interface INCOISMapComponentProps {
  center: { lat: number; lon: number };
  hotspots: HotspotInfo[];
  activeLayer: 'chl' | 'sst' | 'bathymetry' | 'ibl';
  selectedNavigationTarget?: HotspotInfo | null;
  boatBearingDeg?: number;
  boatSpeedKnots?: number;
  isGpsStale?: boolean;
  onNavigateToHotspot?: (hotspot: HotspotInfo) => void;
  onSelectHotspot?: (hotspot: HotspotInfo) => void;
}

export const INCOISMapComponent: React.FC<INCOISMapComponentProps> = ({
  center,
  hotspots,
  activeLayer,
  selectedNavigationTarget,
  boatBearingDeg = 66,
  boatSpeedKnots = 8.5,
  isGpsStale = false,
  onNavigateToHotspot,
  onSelectHotspot,
}) => {
  const [isMapUnlocked, setIsMapUnlocked] = useState<boolean>(false);

  // Compute dynamic safe route with obstacle avoidance when target is selected
  const safeRoutePlan: SafeRoutePlan | null = selectedNavigationTarget
    ? calculateSafeMaritimeRoute(
        center.lat,
        center.lon,
        selectedNavigationTarget.latitude,
        selectedNavigationTarget.longitude,
        boatSpeedKnots > 0 ? boatSpeedKnots : 8.5
      )
    : null;

  // Generate dynamic Leaflet HTML with pinch-zoom, trawler marker, hazard circles, route spline & copy coordinates
  const generateLeafletHTML = () => {
    const hotspotsJSON = JSON.stringify(hotspots);
    const targetJSON = selectedNavigationTarget ? JSON.stringify(selectedNavigationTarget) : 'null';
    const hazardsJSON = JSON.stringify(COASTAL_HAZARDS);
    const routePlanJSON = safeRoutePlan ? JSON.stringify(safeRoutePlan) : 'null';

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
            font-size: 13.5px !important;
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
          .copy-btn:active {
            opacity: 0.8;
          }
          
          /* Traditional Fishing Trawler Marker Styles */
          .trawler-marker-wrapper {
            background: transparent;
            border: none;
          }
          .trawler-marker-container {
            position: relative;
            width: 54px;
            height: 54px;
            display: flex;
            align-items: center;
            justify-content: center;
            transform-origin: center center;
          }
          .trawler-pulse-ring {
            position: absolute;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            border: 2px solid rgba(255, 255, 255, 0.75);
            background: radial-gradient(circle, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0) 75%);
            animation: trawlerPulse 2.5s infinite ease-out;
            pointer-events: none;
          }
          .pulse-disabled {
            display: none;
            animation: none;
          }
          @keyframes trawlerPulse {
            0% { transform: scale(0.85); opacity: 0.95; }
            50% { transform: scale(1.18); opacity: 0.45; }
            100% { transform: scale(1.4); opacity: 0; }
          }
          .trawler-svg {
            filter: drop-shadow(0 0 7px rgba(255, 255, 255, 0.9)) drop-shadow(0 3px 10px rgba(0,0,0,0.95));
          }
          .trawler-active {
            opacity: 1.0;
          }
          .trawler-stale {
            opacity: 0.55;
            filter: grayscale(80%) drop-shadow(0 0 3px rgba(203, 213, 225, 0.5));
          }

          /* PFZ and Target Pins */
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
          .waypoint-pin {
            width: 28px;
            height: 28px;
            background: #005F60;
            border: 2px solid #00F5D4;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            box-shadow: 0 0 10px rgba(0, 245, 212, 0.7);
          }

          /* Hazard Badge Markers */
          .hazard-icon-wrapper {
            background: transparent;
            border: none;
          }
          .hazard-badge {
            width: 26px;
            height: 26px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            box-shadow: 0 0 8px rgba(0,0,0,0.8);
          }
          .hazard-rock {
            background: rgba(255, 71, 87, 0.9);
            border: 1.5px solid #FFFFFF;
          }
          .hazard-naval {
            background: rgba(255, 159, 67, 0.9);
            border: 1.5px solid #FFFFFF;
          }

          .legend-box {
            position: absolute;
            bottom: 16px;
            right: 12px;
            z-index: 1000;
            background: rgba(0, 31, 45, 0.94);
            border: 1.5px solid #00A896;
            border-radius: 10px;
            padding: 8px 12px;
            color: #FFFFFF;
            font-size: 11px;
            font-weight: 700;
            font-family: sans-serif;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          }
          .nav-route-banner {
            position: absolute;
            top: 14px;
            left: 14px;
            right: 68px;
            z-index: 1000;
            background: rgba(13, 37, 38, 0.95);
            border: 1.5px solid #00F5D4;
            border-radius: 10px;
            padding: 10px 12px;
            color: #FFFFFF;
            font-size: 12px;
            font-family: sans-serif;
            box-shadow: 0 4px 14px rgba(0,0,0,0.6);
          }
          .nav-route-title {
            color: #00F5D4;
            font-weight: 900;
            font-size: 13px;
            margin-bottom: 3px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .nav-route-sub {
            color: #E8F4F8;
            font-size: 11.5px;
            line-height: 1.4;
          }
          .nav-route-hazards {
            margin-top: 5px;
            padding-top: 5px;
            border-top: 1px solid rgba(0, 245, 212, 0.25);
            color: #A0ECED;
            font-size: 10.5px;
            font-weight: 700;
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
            width: 40px;
            height: 40px;
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
          selectedNavigationTarget && safeRoutePlan
            ? `<div class="nav-route-banner">
                <div class="nav-route-title">
                  <span>🧭 DYNAMIC SAFE ROUTE ANALYZED</span>
                  <span style="color:#FFD166;font-size:11px;">${safeRoutePlan.total_distance_nm} NM (~${safeRoutePlan.formatted_eta})</span>
                </div>
                <div class="nav-route-sub">
                  Destination: <b>${selectedNavigationTarget.name}</b> • Heading: <b>${safeRoutePlan.initial_bearing_degrees}° ${safeRoutePlan.initial_direction_cardinal}</b>
                </div>
                ${
                  safeRoutePlan.avoided_hazards.length > 0
                    ? `<div class="nav-route-hazards">
                        🛡️ <b>Bypassed Hazards (+1000m clearance):</b><br>
                        ${safeRoutePlan.avoided_hazards.map((h) => `• ${h.name} (${h.minDepthMeters}m depth)`).join('<br>')}
                      </div>`
                    : '<div class="nav-route-hazards" style="color:#10B981;">🛡️ 100% Clear Open Waters • Direct Trajectory Safe</div>'
                }
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
              : activeLayer === 'bathymetry'
              ? '⚓ Gebco Bathymetry'
              : '🚨 International Maritime Boundary (IBL)'
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

          // High-Resolution ESRI World Ocean Satellite Base Layer
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 18,
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

          // International Maritime Boundary Line (IBL)
          var iblCoords = [
            [11.2667, 80.2000],
            [10.8333, 79.9167],
            [10.3833, 79.8667],
            [10.0833, 79.5000],
            [9.6667, 79.5333],
            [9.3833, 79.5333],
            [9.1000, 79.5333],
            [8.8000, 79.1167],
            [8.3667, 78.6333]
          ];

          ${
            activeLayer === 'ibl'
              ? `
                var iblGlow = L.polyline(iblCoords, {
                  color: '#FF0033',
                  weight: 8,
                  opacity: 0.5
                }).addTo(map);

                var iblPolyline = L.polyline(iblCoords, {
                  color: '#FF2A2A',
                  weight: 5,
                  dashArray: '10, 6',
                  opacity: 1.0
                }).addTo(map);

                map.fitBounds(L.polyline(iblCoords).getBounds(), { padding: [40, 40] });
              `
              : `
                var iblPolyline = L.polyline(iblCoords, {
                  color: '#FF2A2A',
                  weight: 3.5,
                  dashArray: '8, 6',
                  opacity: 0.95
                }).addTo(map);
              `
          }

          iblPolyline.bindPopup("<div class='custom-popup'><div class='popup-title'>🚨 INDIA - SRI LANKA IBL</div><div class='popup-info'>International Maritime Boundary Line.<br>Eastward sector is strictly restricted.</div></div>");

          function sendWebMessage(obj) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify(obj));
            }
          }

          function copyGpsCoords(lat, lon) {
            sendWebMessage({ type: 'COPY_COORDS', lat: lat, lon: lon });
          }

          // 1. Render Traditional Fishing Trawler Live GPS Marker
          var trawlerHTML = '<div class="trawler-marker-container" style="transform: rotate(${boatBearingDeg}deg); transition: transform 350ms ease-out;">' +
            '<div class="trawler-pulse-ring ${isGpsStale ? 'pulse-disabled' : ''}"></div>' +
            '<svg class="trawler-svg ${isGpsStale ? 'trawler-stale' : 'trawler-active'}" viewBox="0 0 64 64" width="48" height="48">' +
              '<path d="M 6 36 Q 16 48 34 48 Q 50 48 58 36 L 56 32 L 8 32 Z" fill="#0D2526" stroke="#FFFFFF" stroke-width="2.5" stroke-linejoin="round"/>' +
              '<rect x="14" y="18" width="22" height="14" rx="2" fill="#051C1E" stroke="#FFFFFF" stroke-width="2.2"/>' +
              '<rect x="18" y="22" width="6" height="5" rx="1" fill="#E8F4F8"/>' +
              '<rect x="27" y="22" width="6" height="5" rx="1" fill="#E8F4F8"/>' +
              '<rect x="20" y="11" width="4" height="7" fill="#E74C3C" stroke="#FFFFFF" stroke-width="1.5"/>' +
              '<line x1="20" y1="14" x2="24" y2="14" stroke="#FFFFFF" stroke-width="1.2"/>' +
              '<line x1="42" y1="10" x2="42" y2="32" stroke="#FFFFFF" stroke-width="2"/>' +
              '<line x1="42" y1="12" x2="56" y2="32" stroke="#FFFFFF" stroke-width="1.2"/>' +
              '<line x1="42" y1="12" x2="36" y2="24" stroke="#FFFFFF" stroke-width="1.2"/>' +
              '<path d="M 2 38 Q 12 40 24 38 Q 36 36 48 38 Q 56 40 62 38" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" stroke-linecap="round"/>' +
            '</svg>' +
          '</div>';

          var userIcon = L.divIcon({
            className: 'trawler-marker-wrapper',
            html: trawlerHTML,
            iconSize: [54, 54],
            iconAnchor: [27, 27]
          });
          var userMarker = L.marker([${center.lat}, ${center.lon}], { icon: userIcon, zIndexOffset: 1500 }).addTo(map);
          
          var userPopupContent = '<div class="custom-popup">' +
            '<div class="popup-title">⛵ MY FISHING TRAWLER (LIVE GPS)</div>' +
            '<div class="popup-info">' +
              '<span class="popup-label">Latitude:</span> <span class="popup-value">${center.lat.toFixed(4)}° N</span><br>' +
              '<span class="popup-label">Longitude:</span> <span class="popup-value">${center.lon.toFixed(4)}° E</span><br>' +
              '<span class="popup-label">Heading:</span> <span class="popup-value">${boatBearingDeg}°</span><br>' +
              '<span class="popup-label">Vessel Speed:</span> <span class="popup-value">${boatSpeedKnots > 0 ? boatSpeedKnots + ' knots' : '0.0 knots'}</span><br>' +
              '<span class="popup-label">Signal Status:</span> <span class="popup-score" style="color:${isGpsStale ? '#FF6B6B' : '#10B981'}">${isGpsStale ? '⚠️ Stale Fix (Offline)' : '🟢 Active • Locked'}</span>' +
            '</div>' +
            '<button class="copy-btn" onclick="copyGpsCoords(${center.lat}, ${center.lon})">📋 Copy Vessel GPS (${center.lat.toFixed(4)}, ${center.lon.toFixed(4)})</button>' +
          '</div>';
          userMarker.bindPopup(userPopupContent);

          // 2. Render Coastal Hazards & Restricted Zones
          var hazards = ${hazardsJSON};
          hazards.forEach(function(haz) {
            var isRock = haz.type === 'shallow_rock';
            var strokeColor = isRock ? '#FF4757' : '#FF9F43';
            var fillColor = isRock ? 'rgba(255, 71, 87, 0.18)' : 'rgba(255, 159, 67, 0.18)';
            var iconEmoji = isRock ? '🪨' : '⚓';

            var circle = L.circle([haz.latitude, haz.longitude], {
              radius: haz.radiusMeters,
              color: strokeColor,
              weight: 2.2,
              dashArray: '6, 6',
              fillColor: fillColor,
              fillOpacity: 0.25
            }).addTo(map);

            var hazCenterIcon = L.divIcon({
              className: 'hazard-icon-wrapper',
              html: '<div class="hazard-badge ' + (isRock ? 'hazard-rock' : 'hazard-naval') + '">' + iconEmoji + '</div>',
              iconSize: [26, 26],
              iconAnchor: [13, 13]
            });
            var hazMarker = L.marker([haz.latitude, haz.longitude], { icon: hazCenterIcon }).addTo(map);

            var hazPopup = '<div class="custom-popup">' +
              '<div class="popup-title" style="color:' + strokeColor + '">' + iconEmoji + ' ' + haz.name + '</div>' +
              '<div class="popup-info">' +
                '<span class="popup-label">Type:</span> <span class="popup-value">' + (isRock ? 'Submerged Rock Hazard' : 'Naval Restricted Zone') + '</span><br>' +
                '<span class="popup-label">Hazard Radius:</span> <span class="popup-value">' + haz.radiusMeters + 'm</span><br>' +
                '<span class="popup-label">Min Depth:</span> <span class="popup-value">' + haz.minDepthMeters + ' meters</span><br>' +
                '<span class="popup-label">Safety Status:</span> <span class="popup-score" style="color:#00F5D4">🛡️ BYPASS ACTIVE (+1000m Clearance)</span><br>' +
                '<div style="font-size:11px;color:#A0ECED;margin-top:4px">' + haz.description + '</div>' +
              '</div>' +
            '</div>';

            circle.bindPopup(hazPopup);
            hazMarker.bindPopup(hazPopup);
          });

          // 3. Render Hotspots Custom Markers & INCOIS PFZ Vector Boundary Lines
          var hotspots = ${hotspotsJSON};
          var navTarget = ${targetJSON};
          var routePlan = ${routePlanJSON};
          var markerGroup = L.featureGroup();
          var sectorGroups = {};

          var foundTarget = false;
          hotspots.forEach(function(spot) {
            var secId = spot.id.split('-')[0];
            if (!sectorGroups[secId]) sectorGroups[secId] = [];
            sectorGroups[secId].push([spot.latitude, spot.longitude]);

            var isSelectedTarget = navTarget && (navTarget.id === spot.id || (Math.abs(navTarget.latitude - spot.latitude) < 0.0001 && Math.abs(navTarget.longitude - spot.longitude) < 0.0001));
            if (isSelectedTarget) foundTarget = true;
            var pinClass = isSelectedTarget ? 'target-pin' : 'pfz-pin';
            var pinIcon = isSelectedTarget ? '🎯' : '🐟';

            var icon = L.divIcon({
              className: 'pfz-pin-wrapper',
              html: '<div class="' + pinClass + '">' + pinIcon + '</div>',
              iconSize: isSelectedTarget ? [36, 36] : [32, 32],
              iconAnchor: isSelectedTarget ? [18, 18] : [16, 16]
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

          // If navTarget is custom from AI bot and not in default hotspots, add dedicated target marker!
          if (navTarget && !foundTarget) {
            var targetIcon = L.divIcon({
              className: 'pfz-pin-wrapper',
              html: '<div class="target-pin">🎯</div>',
              iconSize: [36, 36],
              iconAnchor: [18, 18]
            });
            var targetMarker = L.marker([navTarget.latitude, navTarget.longitude], { icon: targetIcon });
            markerGroup.addLayer(targetMarker);
            var targetPopup = '<div class="custom-popup">' +
              '<div class="popup-title">🎯 ' + navTarget.name + '</div>' +
              '<div class="popup-info">' +
                '<span class="popup-label">📍 Latitude:</span> <span class="popup-value">' + navTarget.latitude.toFixed(4) + '° N</span><br>' +
                '<span class="popup-label">📍 Longitude:</span> <span class="popup-value">' + navTarget.longitude.toFixed(4) + '° E</span><br>' +
                (navTarget.depth_meters ? '<span class="popup-label">⚓ Depth:</span> <span class="popup-value">' + navTarget.depth_meters + 'm</span><br>' : '') +
                (navTarget.reliability_score ? '<span class="popup-label">🎯 Reliability:</span> <span class="popup-score">' + navTarget.reliability_score + '</span>' : '') +
              '</div>' +
              '<button class="copy-btn" onclick="copyGpsCoords(' + navTarget.latitude + ', ' + navTarget.longitude + ')">📋 Copy GPS (' + navTarget.latitude.toFixed(4) + ', ' + navTarget.longitude.toFixed(4) + ')</button>' +
            '</div>';
            targetMarker.bindPopup(targetPopup);
          }

          markerGroup.addTo(map);

          // 4. Render Dynamic Safe Route Spline & Control Waypoint Pins
          if (routePlan && routePlan.route_coordinates && routePlan.route_coordinates.length > 0) {
            // Render smooth Catmull-Rom route spline polyline
            var routeLine = L.polyline(routePlan.route_coordinates, {
              color: '#00F5D4',
              weight: 4.5,
              dashArray: '6, 6',
              opacity: 0.95
            }).addTo(map);

            // Render intermediate safety waypoints along the route
            if (routePlan.control_waypoints && routePlan.control_waypoints.length > 2) {
              routePlan.control_waypoints.slice(1, -1).forEach(function(wp, idx) {
                var wpIcon = L.divIcon({
                  className: 'waypoint-pin-wrapper',
                  html: '<div class="waypoint-pin">' + (wp.type === 'HARBOR EXIT' ? '⚓' : '🛡️') + '</div>',
                  iconSize: [28, 28],
                  iconAnchor: [14, 14]
                });
                var wpMarker = L.marker([wp.latitude, wp.longitude], { icon: wpIcon }).addTo(map);
                wpMarker.bindPopup('<div class="custom-popup"><div class="popup-title">🛡️ ' + wp.name + '</div><div class="popup-info">Waypoint Type: <b>' + wp.type + '</b><br>Coords: ' + wp.latitude.toFixed(4) + '° N, ' + wp.longitude.toFixed(4) + '° E</div></div>');
              });
            }

            // Auto-fit bounds to show entire safe navigation trajectory!
            map.fitBounds(L.polyline(routePlan.route_coordinates).getBounds(), { padding: [50, 50] });
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

