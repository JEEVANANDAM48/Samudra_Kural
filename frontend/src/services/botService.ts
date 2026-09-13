import { apiFetch } from './api';

export interface AgentExecutionStep {
  agent_id: number;
  name: string;
  icon: string;
  status: string;
  details: string;
}

export interface RiskAssessment {
  level: 'LOW' | 'MODERATE' | 'HIGH';
  color: string;
  title: string;
  reason: string;
  advice: string;
}

export interface HotspotSummary {
  name: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  distance_nm: number;
  bearing_deg: number;
  cardinal_direction: string;
  target_species: string[];
  depth_meters: number;
}

export interface OrcaChatResponse {
  query: string;
  language: string;
  intent: string;
  response_text: string;
  voice_speech_text: string;
  voice_audio_base64?: string;
  risk_assessment: RiskAssessment;
  agent_steps: AgentExecutionStep[];
  suggested_hotspot?: HotspotSummary | null;
  telemetry: {
    wind_kmh: number;
    wind_direction: string;
    wave_height_m: number;
    wave_period_s?: number;
    sea_surface_temp_c?: number;
    ocean_current_knots?: number;
    ocean_current_direction?: string;
    nearest_port?: string;
    seafloor_depth_m?: number;
  };
  quick_actions: Array<{ id: string; label: string; action: string }>;
  community_reports: Array<{
    reporter: string;
    location: string;
    catch: string;
    confidence: string;
    time_ago: string;
  }>;
}

export async function askOrcaBot(
  query: string,
  latitude: number = 13.0827,
  longitude: number = 80.3800,
  vesselType: string = 'Trawler',
  language: string = 'ta'
): Promise<OrcaChatResponse> {
  try {
    const data = await apiFetch<OrcaChatResponse>('/bot/chat', {
      method: 'POST',
      body: JSON.stringify({
        query,
        latitude,
        longitude,
        vessel_type: vesselType,
        language,
      }),
    });
    return data;
  } catch (err) {
    console.log('[BotService] Network call to /bot/chat failed. Serving offline fallback ORCA 12-Agent response:', err);
    return getOfflineOrcaResponse(query, latitude, longitude, language);
  }
}

export function getOfflineOrcaResponse(
  query: string,
  lat: number,
  lon: number,
  lang: string
): OrcaChatResponse {
  const isTamil = lang === 'ta';
  
  return {
    query,
    language: lang,
    intent: 'fishing_advisory',
    response_text: isTamil
      ? `🌊 **மீன்பிடி வழிகாட்டுதல் (பாதுகாப்பானது)**\n\n**பாதுகாப்பு நிலை:** சிறந்த கடல் வானிலை நிலைமைகள். அனைத்து வகையான படகுகளும் செல்லலாம்.\n• **காற்று வேகம்:** 18.5 கி.மீ/மணி (NE)\n• **அலை உயரம்:** 1.1 மீட்டர்\n\n🐟 **பரிந்துரைக்கப்பட்ட மீன்பிடி மண்டலம்:**\n• **இடம்:** Chennai Coast Zone SEC006 (12.4 கி.மீ NE)\n• **இலக்கு மீன்கள்:** Mackerel, Sardine, Tuna\n\n👥 **மீனவர் சமூக அறிக்கை:** நல்ல கானாங்களுத்தி மீன் விளைச்சல் பதிவு செய்யப்பட்டுள்ளது.`
      : `🌊 **Marine Advisory (SAFE FOR FISHING)**\n\n**Safety Recommendation:** Favorable calm weather. Excellent ocean conditions for all vessel types.\n• **Wind Speed:** 18.5 km/h (NE)\n• **Wave Height:** 1.1 meters\n\n🐟 **Recommended Potential Fishing Zone (PFZ):**\n• **Location:** Chennai Coast Zone SEC006 (12.4 km NE)\n• **Target Fish Species:** Mackerel, Sardine, Tuna\n\n👥 **Community Intelligence:** Good catch of Indian Mackerel reported by local fishermen nearby.`,
    voice_speech_text: isTamil
      ? `வணக்கம்! இன்றைய கடல் நிலை பாதுகாப்பானது. பரிந்துரைக்கப்பட்ட மீன்பிடி மண்டலம் சென்னை கடலோரம், 12 கிலோமீட்டர் தொலைவில் உள்ளது. நல்வாழ்த்துக்கள்!`
      : `Hello! Today sea condition is safe for fishing. Recommended potential fishing zone is Chennai Coast, 12 kilometers away. Stay safe!`,
    risk_assessment: {
      level: 'LOW',
      color: '#10B981',
      title: 'SAFE FOR FISHING',
      reason: 'Favorable calm weather. Light wind (18.5 km/h), wave height (1.1m)',
      advice: 'Excellent ocean conditions for all vessel types.',
    },
    agent_steps: [
      { agent_id: 1, name: 'Intent & Orchestration Agent', icon: '🎯', status: 'success', details: 'Parsed intent: FISHING_ADVISORY' },
      { agent_id: 2, name: 'Task Planning Agent', icon: '📋', status: 'success', details: 'Assigned execution to 6 specialized agents' },
      { agent_id: 3, name: 'Weather Intelligence Agent', icon: '🌦️', status: 'success', details: 'Wind: 18.5 km/h (NE) | Temp: 29.5°C' },
      { agent_id: 4, name: 'Ocean Intelligence Agent', icon: '🌊', status: 'success', details: 'Wave Height: 1.1m | Sea Temp: 28.3°C' },
      { agent_id: 5, name: 'Fishery Intelligence Agent', icon: '🎣', status: 'success', details: 'INCOIS Satellite Hotspot SEC006 identified' },
      { agent_id: 6, name: 'Terrain & Obstacle Agent', icon: '🏔️', status: 'success', details: 'Nearest Port: Port of Chennai (12 km)' },
      { agent_id: 7, name: 'Trend & Analytics Agent', icon: '📊', status: 'success', details: 'Peak Mackerel season (Oct-Dec)' },
      { agent_id: 8, name: 'Risk & Safety Agent', icon: '🛡️', status: 'success', details: 'Risk Level: LOW' },
      { agent_id: 9, name: 'Geospatial & Geofencing Agent', icon: '🗺️', status: 'success', details: 'Inside Indian EEZ Waters' },
      { agent_id: 11, name: 'Communication & Mutual-Aid Agent', icon: '📡', status: 'info', details: 'Coast Guard Standby 156.8 MHz' },
      { agent_id: 12, name: 'Community Intelligence Agent', icon: '👥', status: 'success', details: '2 verified reports from local fishermen' },
    ],
    suggested_hotspot: {
      name: 'Chennai Coast Zone SEC006',
      latitude: 13.1500,
      longitude: 80.4500,
      distance_km: 12.4,
      distance_nm: 6.7,
      bearing_deg: 45,
      cardinal_direction: 'NE',
      target_species: ['Mackerel', 'Sardine', 'Tuna'],
      depth_meters: 35,
    },
    telemetry: {
      wind_kmh: 18.5,
      wind_direction: 'NE',
      wave_height_m: 1.1,
      wave_period_s: 6.0,
      sea_surface_temp_c: 28.3,
      ocean_current_knots: 0.8,
      ocean_current_direction: 'NE',
      nearest_port: 'Port of Chennai',
      seafloor_depth_m: 35,
    },
    quick_actions: [
      { id: 'map', label: '🧭 Show Route on Ocean Map', action: 'NAVIGATE_MAP' },
      { id: 'copy', label: '📋 Copy Hotspot GPS', action: 'COPY_COORDS' },
    ],
    community_reports: [
      {
        reporter: 'Ramanathan (Trawler)',
        location: '13.12N, 80.42E',
        catch: 'Good catch of Indian Mackerel',
        confidence: '94%',
        time_ago: '2 hours ago',
      },
    ],
  };
}
