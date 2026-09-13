import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { SOSAlertItem, RescueMissionItem, RiskZoneItem } from '../services/coastalGuardService';
import { Colors } from '../theme/colors';

const { width } = Dimensions.get('window');

interface CoastalGuardMapComponentProps {
  height?: number;
  sosAlerts?: SOSAlertItem[];
  missions?: RescueMissionItem[];
  riskZones?: RiskZoneItem[];
  center?: { lat: number; lon: number };
  onSelectSOS?: (sosId: number) => void;
}

export const CoastalGuardMapComponent: React.FC<CoastalGuardMapComponentProps> = ({
  height = 340,
  sosAlerts = [],
  missions = [],
  riskZones = [],
  center = { lat: 13.0827, lon: 80.3800 },
  onSelectSOS,
}) => {
  const [activeLayer, setActiveLayer] = useState<'sat' | 'chl' | 'sst' | 'bathymetry'>('sat');

  const generateLeafletHTML = () => {
    const sosJSON = JSON.stringify(sosAlerts);
    const missionsJSON = JSON.stringify(missions);
    const riskZonesJSON = JSON.stringify(riskZones);

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
            background: #081B2C;
            touch-action: manipulation;
          }
          .leaflet-popup-content-wrapper, .leaflet-popup-tip {
            background: #08233B !important;
            color: #FFFFFF !important;
            border: 1.5px solid #0284C7 !important;
            border-radius: 12px !important;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.7) !important;
          }
          .popup-title {
            font-size: 14px;
            font-weight: 800;
            color: #EF4444;
            margin-bottom: 4px;
          }
          .popup-sub {
            font-size: 12px;
            color: #E2E8F0;
            line-height: 1.5;
          }
          .pulse-sos {
            border-radius: 50%;
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
            animation: pulse-red 1.5s infinite;
          }
          .leaflet-control-attribution {
            display: none !important;
          }
          @keyframes pulse-red {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.8); }
            70% { transform: scale(1.15); box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          const map = L.map('map', {
            zoomControl: true,
            touchZoom: true,
            doubleClickZoom: true,
            scrollWheelZoom: true,
            dragging: true,
            attributionControl: false
          }).setView([${center.lat}, ${center.lon}], 10);

          // 1. Real ESRI World Imagery & INCOIS Ocean Satellite Tiles
          const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 18
          });

          const esriOcean = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 13
          });

          ${
            activeLayer === 'sat'
              ? `esriSatellite.addTo(map);`
              : activeLayer === 'chl'
              ? `
                esriOcean.addTo(map);
                L.tileLayer.wms('https://incois.gov.in/geoserver/PFZ-TUNA-SST-CHL/wms', {
                  layers: 'PFZ-TUNA-SST-CHL:chl',
                  format: 'image/png',
                  transparent: true,
                  version: '1.1.0',
                  opacity: 0.70
                }).addTo(map);
              `
              : activeLayer === 'sst'
              ? `
                esriOcean.addTo(map);
                L.tileLayer.wms('https://incois.gov.in/geoserver/PFZ-TUNA-SST-CHL/wms', {
                  layers: 'PFZ-TUNA-SST-CHL:sst',
                  format: 'image/png',
                  transparent: true,
                  version: '1.1.0',
                  opacity: 0.70
                }).addTo(map);
              `
              : `
                esriOcean.addTo(map);
                L.tileLayer.wms('https://incois.gov.in/geoserver/BathymteryImage/wms', {
                  layers: 'BathymteryImage:gebcobathymtery',
                  format: 'image/png',
                  transparent: true,
                  version: '1.1.0',
                  opacity: 0.65
                }).addTo(map);
              `
          }

          const sosList = ${sosJSON};
          const missionList = ${missionsJSON};
          const zones = ${riskZonesJSON};

          // 2. Draw High Risk Marine Zones
          zones.forEach(zone => {
            if (zone.coordinates && zone.coordinates.length > 0) {
              const polyCoords = zone.coordinates.map(c => [c.lat, c.lon]);
              L.polygon(polyCoords, {
                color: zone.risk_level === 'HIGH' ? '#EF4444' : '#F59E0B',
                fillColor: zone.risk_level === 'HIGH' ? '#EF4444' : '#F59E0B',
                fillOpacity: 0.25,
                weight: 2,
                dashArray: '6, 6'
              }).addTo(map).bindPopup(\`<b>⚠️ \${zone.name}</b><br/>\${zone.reason}\`);
            }
          });

          // 3. Draw Official Coastal Guard HQ Bases
          L.circleMarker([13.0827, 80.3800], {
            radius: 10,
            fillColor: '#10B981',
            color: '#FFFFFF',
            weight: 3,
            fillOpacity: 1.0
          }).addTo(map).bindPopup('<b>⚓ Chennai Coast Guard HQ</b><br/>Command Center & Rescue Dispatch Base');

          L.circleMarker([13.3100, 80.3400], {
            radius: 9,
            fillColor: '#10B981',
            color: '#FFFFFF',
            weight: 2.5,
            fillOpacity: 1.0
          }).addTo(map).bindPopup('<b>⚓ Kattupalli Coast Guard Station</b><br/>Patrol Vessel & Medevac Base');

          // 4. Draw Active SOS Distress Call Markers with Dynamic Tactical Dispatch Line
          sosList.forEach(sos => {
            const isCritical = sos.priority === 'CRITICAL';
            const color = isCritical ? '#EF4444' : '#F59E0B';
            
            const sosMarker = L.circleMarker([sos.latitude, sos.longitude], {
              radius: 13,
              fillColor: color,
              color: '#FFFFFF',
              weight: 3.5,
              fillOpacity: 0.95,
              className: 'pulse-sos'
            }).addTo(map);

            const boatName = sos.boat ? sos.boat.name : 'Fisherman Vessel';
            const fishermanName = sos.fisherman ? sos.fisherman.name : 'Fisherman';
            const htmlContent = \`
              <div class="popup-title">🚨 SOS EMERGENCY: \${sos.emergency_type.toUpperCase()}</div>
              <div class="popup-sub">
                <b>Vessel:</b> \${boatName}<br/>
                <b>Captain:</b> \${fishermanName}<br/>
                <b>Crew:</b> \${sos.people_affected} Members<br/>
                <b>Priority:</b> <span style="color:\${color}; font-weight:bold">\${sos.priority}</span> | <b>Status:</b> \${sos.status}<br/>
                <b>Coordinates:</b> \${sos.latitude.toFixed(4)}°N, \${sos.longitude.toFixed(4)}°E
              </div>
            \`;
            sosMarker.bindPopup(htmlContent);

            // Connect nearest Coast Guard HQ to SOS via dotted tactical dispatch line
            L.polyline([[13.0827, 80.3800], [sos.latitude, sos.longitude]], {
              color: '#38BDF8',
              weight: 2,
              dashArray: '8, 8',
              opacity: 0.8
            }).addTo(map);
          });

          // 5. Draw Active Rescue Mission Patrol Boats
          missionList.forEach(m => {
            const targetSOS = sosList.find(s => s.id === m.sos_alert_id);
            if (targetSOS) {
              const patrolLat = 13.0827 + (targetSOS.latitude - 13.0827) * 0.45;
              const patrolLon = 80.3800 + (targetSOS.longitude - 80.3800) * 0.45;

              const patrolMarker = L.circleMarker([patrolLat, patrolLon], {
                radius: 10,
                fillColor: '#0284C7',
                color: '#FFFFFF',
                weight: 2.5,
                fillOpacity: 0.95
              }).addTo(map);

              patrolMarker.bindPopup(\`
                <b>🛥️ \${m.rescue_vessel}</b><br/>
                \${m.rescue_team}<br/>
                <b>Status:</b> \${m.status} | <b>ETA:</b> \${m.eta_minutes} mins
              \`);

              // Solid operational dispatch vector
              L.polyline([[patrolLat, patrolLon], [targetSOS.latitude, targetSOS.longitude]], {
                color: '#0284C7',
                weight: 3,
                opacity: 0.9
              }).addTo(map);
            }
          });
        </script>
      </body>
      </html>
    `;
  };

  return (
    <View style={[styles.container, { height }]}>
      {/* Interactive Satellite & Marine Layer Control Buttons */}
      <View style={styles.layerBar}>
        <TouchableOpacity
          style={[styles.layerChip, activeLayer === 'sat' && styles.layerChipActive]}
          onPress={() => setActiveLayer('sat')}
        >
          <Text style={[styles.layerTxt, activeLayer === 'sat' && styles.layerTxtActive]}>
            📡 Satellite
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.layerChip, activeLayer === 'chl' && styles.layerChipActive]}
          onPress={() => setActiveLayer('chl')}
        >
          <Text style={[styles.layerTxt, activeLayer === 'chl' && styles.layerTxtActive]}>
            🌱 INCOIS Chlorophyll
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.layerChip, activeLayer === 'sst' && styles.layerChipActive]}
          onPress={() => setActiveLayer('sst')}
        >
          <Text style={[styles.layerTxt, activeLayer === 'sst' && styles.layerTxtActive]}>
            🌡️ SST Temp
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.layerChip, activeLayer === 'bathymetry' && styles.layerChipActive]}
          onPress={() => setActiveLayer('bathymetry')}
        >
          <Text style={[styles.layerTxt, activeLayer === 'bathymetry' && styles.layerTxtActive]}>
            ⚓ Depth Bathymetry
          </Text>
        </TouchableOpacity>
      </View>

      <WebView
        key={activeLayer}
        originWhitelist={['*']}
        source={{ html: generateLeafletHTML() }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(15, 58, 93, 0.25)',
    backgroundColor: '#081B2C',
  },
  layerBar: {
    flexDirection: 'row',
    backgroundColor: Colors.cgPrimaryDark,
    padding: 6,
    gap: 6,
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  layerChip: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  layerChipActive: {
    backgroundColor: Colors.cgAccent,
  },
  layerTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  layerTxtActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
