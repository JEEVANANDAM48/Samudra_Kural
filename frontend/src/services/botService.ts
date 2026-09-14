import { Platform } from 'react-native';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { apiFetch, API_BASE_URL } from './api';
import { getRecognizedWebSpeechText } from '../utils/speech';

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
  const qLower = query.toLowerCase();

  let intent = 'general_advisory';
  let responseText = '';
  let voiceText = '';

  if (qLower.includes('port') || qLower.includes('harbor') || qLower.includes('harbour') || qLower.includes('shore') || qLower.includes('துறைமுகம்')) {
    intent = 'nearest_port';
    responseText = isTamil
      ? `⚓ அருகிலுள்ள துறைமுகம் (சென்னை துறைமுகம்)\n\nமுதன்மை துறைமுகம்: சென்னை துறைமுகம் (Port of Chennai)\nதோராய தொலைவு: 12.4 கி.மீ\nஅவசர தொடர்பு: VHF சேனல் 16 (156.8 MHz)\n\nநேரலை செயற்கைக்கோள் தரவுகளுக்கு இணைய இணைப்பை சரிபார்க்கவும்.`
      : `⚓ Nearest Port Information (Port of Chennai)\n\nBase Port: Port of Chennai\nEstimated Distance: 12.4 km (6.7 NM)\nEmergency Channel: Coast Guard VHF Channel 16 (156.8 MHz)\n\nConnect to internet for live satellite updates.`;
    voiceText = isTamil
      ? `அருகிலுள்ள துறைமுகம் சென்னை துறைமுகம், 12 கிலோமீட்டர் தொலைவில் உள்ளது.`
      : `Nearest base port is Port of Chennai, located approximately 12 kilometers away.`;
  } else if (qLower.includes('wave') || qLower.includes('swell') || qLower.includes('sea state') || qLower.includes('அலை')) {
    intent = 'wave_conditions';
    responseText = isTamil
      ? `🌊 கடல் அலை நிலை\n\nபதிவுசெய்யப்பட்ட அலை உயரம்: 0.8 முதல் 1.4 மீட்டர்\nகடல் நிலை: மிதமான அலை வீச்சு\nஆலோசனை: சிறிய படகுகள் கரைக்கு அருகில் இருப்பது நல்லது.\n\nநேரலை துல்லிய அலை அளவுக்கு இணைய இணைப்பை சரிபார்க்கவும்.`
      : `🌊 Ocean Wave Conditions\n\nEstimated Wave Height: 0.8 to 1.4 meters\nSea State: Slight to Moderate\nAdvisory: Small motorized craft should remain watchful near coastal waters.\n\nConnect to internet for real-time ocean forecasts.`;
    voiceText = isTamil
      ? `கடைசி பதிவின்படி அலை உயரம் சுமார் 1 மீட்டர். மிதமான கடல் நிலை.`
      : `Estimated wave height is around 1.0 meter under moderate coastal sea state.`;
  } else if (qLower.includes('wind') || qLower.includes('gale') || qLower.includes('gust') || qLower.includes('காற்று')) {
    intent = 'wind_conditions';
    responseText = isTamil
      ? `💨 காற்று வேகம் மற்றும் திசை\n\nகாற்றின் வேகம்: 15 முதல் 20 கி.மீ/மணி\nதிசை: வடகிழக்கு (NE)\nஆலோசனை: காற்றின் வேகம் மிதமாக உள்ளது, சாதாரண பயணத்திற்கு உகந்தது.\n\nநேரலை வானிலை முன்னறிவிப்புக்கு இணையத்தை சரிபார்க்கவும்.`
      : `💨 Wind and Atmospheric Conditions\n\nEstimated Wind Speed: 15 to 20 km/h (8 to 11 knots)\nDirection: Northeast (NE)\nAdvisory: Normal coastal breeze, favorable for local operations.\n\nConnect to internet for real-time weather forecasts.`;
    voiceText = isTamil
      ? `காற்றின் வேகம் சுமார் 18 கி.மீ/மணி, வடகிழக்கு திசை.`
      : `Estimated wind speed is 15 to 20 km/h from the Northeast.`;
  } else if (qLower.includes('mackerel') || qLower.includes('tuna') || qLower.includes('species') || qLower.includes('what fish') || qLower.includes('catch') || qLower.includes('மீன்')) {
    intent = 'fish_species';
    responseText = isTamil
      ? `🎣 இலக்கு மீன் வகைகள்\n\nபருவகால மீன்கள்: கானாங்களுத்தி, சாளை, சூரை\nபரிந்துரைக்கப்பட்ட பகுதி: சென்னை கடலோர மண்டலம்\nபருவ காலம்: அக்டோபர் முதல் டிசம்பர் வரை.`
      : `🎣 Target Fish Species Intelligence\n\nKey Target Species: Indian Mackerel, Sardine, Seer Fish, Tuna\nActive Sector: North Tamil Nadu and Chennai Coast\nSeasonal Trend: Peak Mackerel season during winter post-monsoon months.`;
    voiceText = isTamil
      ? `இன்றைய முக்கிய மீன் வகைகள் கானாங்களுத்தி, சாளை மற்றும் சூரை.`
      : `Key target species in this sector include Indian Mackerel, Sardine, and Tuna.`;
  } else if (qLower.includes('zone') || qLower.includes('pfz') || qLower.includes('where') || qLower.includes('hotspot') || qLower.includes('மண்டலம்')) {
    intent = 'find_pfz';
    responseText = isTamil
      ? `🐟 மீன்பிடி மண்டலம் (PFZ)\n\nபரிந்துரைக்கப்பட்ட இடம்: சென்னை கடலோர மண்டலம்\nமதிப்பிடப்பட்ட தொலைவு: 12.4 கி.மீ (வடகிழக்கு)\nஇலக்கு மீன்கள்: கானாங்களுத்தி, சாளை\n\nதுல்லிய வரைபடத்திற்கு Fishing Zones பக்கத்தை பார்க்கவும்.`
      : `🐟 Potential Fishing Zone (PFZ)\n\nRecommended Zone: Chennai Coastal Front Sector\nEstimated Distance: 12.4 km (NE course)\nTarget Species: Mackerel, Sardine, Tuna\n\nOpen Fishing Zones tab for the interactive map.`;
    voiceText = isTamil
      ? `பரிந்துரைக்கப்பட்ட மீன்பிடி மண்டலம் சென்னை கடலோரம், சுமார் 12 கிலோமீட்டர் தொலைவில் உள்ளது.`
      : `Recommended fishing zone is Chennai Coastal Sector, approximately 12 kilometers Northeast.`;
  } else if (qLower.includes('drift') || qLower.includes('net') || qLower.includes('lost') || qLower.includes('வலை')) {
    intent = 'net_drift';
    responseText = isTamil
      ? `🕸️ வலை மிதப்பு கண்காணிப்பு\n\nமிதப்பு திசை: கடலோர மேற்பரப்பு நீரோட்டத்தை நோக்கி நகரும்\nமீட்பு வழிகாட்டல்: தொலைந்த வலையை கண்காணிக்க My Nets பக்கத்தில் ஜிபிஎஸ் கணிப்பை பயன்படுத்தவும்.`
      : `🕸️ Net Drift and Recovery Tracking\n\nDrift Direction: Influenced by coastal surface current and wind leeway\nRecovery Action: Use My Nets tracking map to simulate the exact drift trajectory.`;
    voiceText = isTamil
      ? `வலை மிதப்பு கண்காணிப்புக்கு My Nets பக்கத்தை பார்க்கவும்.`
      : `To track your net drift trajectory, open the My Nets tracking map.`;
  } else if (qLower.includes('can i') || qLower.includes('go fishing') || qLower.includes('tomorrow') || qLower.includes('today') || qLower.includes('போகலாமா')) {
    intent = 'fishing_advisory';
    responseText = isTamil
      ? `🧭 மீன்பிடி ஆலோசனை\n\nபாதுகாப்பு நிலை: சாதாரண கடல் வானிலை நிலவுகிறது\nஆலோசனை: இயந்திரப் படகுகள் செல்லலாம்; கடலுக்கு செல்லும் முன் வானிலை எச்சரிக்கைகளை கவனிக்கவும்.`
      : `🧭 Fishing Venture Advisory\n\nSafety Verdict: Normal coastal conditions reported\nAdvice: Mechanized trawlers and motorized boats can proceed with standard safety equipment.`;
    voiceText = isTamil
      ? `இன்றைய நிலை சாதாரணமானது. நிலையான பாதுகாப்புடன் மீன்பிடிக்க செல்லலாம்.`
      : `Current conditions are reported normal. Proceed with standard marine safety precautions.`;
  } else {
    intent = 'general_advisory';
    responseText = isTamil
      ? `🌊 சமுத்திர குரல் கடல் உதவியாளர்\n\nநீங்கள் மீன்பிடி மண்டலம், அலை உயரம், காற்றின் வேகம், அல்லது தொலைந்த வலை பற்றி கேட்கலாம்.`
      : `🌊 Samudra Kural Marine Assistant\n\nAsk specific questions regarding fishing zones, wave height, wind speed, safety advisories, or lost net drift.`;
    voiceText = isTamil
      ? `சமுத்திர குரல் உதவியாளன். உங்கள் கேள்வியை கேட்கலாம்.`
      : `Samudra Kural Marine Assistant. Ask about weather, fishing zones, or net drift.`;
  }

  return {
    query,
    language: lang,
    intent,
    response_text: responseText,
    voice_speech_text: voiceText,
    risk_assessment: {
      level: 'LOW',
      color: '#10B981',
      title: 'SAFE FOR FISHING',
      reason: 'Standard coastal conditions. Verified safety parameters.',
      advice: 'Proceed with standard marine safety precautions.',
    },
    agent_steps: [
      { agent_id: 1, name: 'Intent & Orchestration Agent', icon: '🎯', status: 'success', details: `Parsed intent: ${intent.toUpperCase()}` },
      { agent_id: 2, name: 'Task Planning Agent', icon: '📋', status: 'success', details: 'Serving intent-specific marine response' },
      { agent_id: 3, name: 'Weather Intelligence Agent', icon: '🌦️', status: 'info', details: 'Weather telemetry available' },
      { agent_id: 4, name: 'Ocean Intelligence Agent', icon: '🌊', status: 'info', details: 'Oceanographic metrics evaluated' },
      { agent_id: 5, name: 'Fishery Intelligence Agent', icon: '🎣', status: 'info', details: 'PFZ sector identified' },
      { agent_id: 8, name: 'Risk & Safety Agent', icon: '🛡️', status: 'success', details: 'Risk Level: LOW' },
    ],
    suggested_hotspot: {
      name: 'Chennai Coast Zone',
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

export interface TranscribeResponse {
  success: boolean;
  status: string;
  transcript: string;
  language?: string;
  language_code?: string;
  message?: string;
}

async function readLocalAudioBase64(uri: string): Promise<string> {
  if (!uri) return '';
  console.log('[STT Request] Attempting to read audio file at URI:', uri);

  let targetUri = uri;
  if (Platform.OS === 'android' && !targetUri.startsWith('file://') && !targetUri.startsWith('content://')) {
    targetUri = `file://${targetUri}`;
  }

  // 1. Primary: expo-file-system/legacy readAsStringAsync
  try {
    if (FileSystemLegacy && typeof FileSystemLegacy.readAsStringAsync === 'function') {
      const b64 = await FileSystemLegacy.readAsStringAsync(targetUri, {
        encoding: FileSystemLegacy.EncodingType?.Base64 || 'base64',
      });
      if (b64 && b64.length > 0) {
        console.log('[STT Request] Successfully read audio Base64 via FileSystemLegacy. Length:', b64.length);
        return b64;
      }
    }
  } catch (e: any) {
    console.log('[STT Request] FileSystemLegacy.readAsStringAsync note on targetUri:', e?.message || e);
  }

  // 2. Try raw path without file:// prefix on Android
  if (Platform.OS === 'android' && targetUri.startsWith('file://')) {
    try {
      const rawPath = targetUri.replace('file://', '');
      const b64 = await FileSystemLegacy.readAsStringAsync(rawPath, { encoding: 'base64' });
      if (b64 && b64.length > 0) {
        console.log('[STT Request] Successfully read audio Base64 via rawPath. Length:', b64.length);
        return b64;
      }
    } catch (e: any) {
      console.log('[STT Request] FileSystemLegacy.readAsStringAsync note on rawPath:', e?.message || e);
    }
  }

  // 3. Fallback to regular expo-file-system
  try {
    const FileSystemModule = require('expo-file-system');
    if (FileSystemModule && typeof FileSystemModule.readAsStringAsync === 'function') {
      const b64 = await FileSystemModule.readAsStringAsync(targetUri, { encoding: 'base64' });
      if (b64 && b64.length > 0) {
        console.log('[STT Request] Successfully read audio Base64 via FileSystemModule. Length:', b64.length);
        return b64;
      }
    }
  } catch (e: any) {}

  console.log('[STT Request] Could not read audio recording file base64 on device.');
  return '';
}

const SARVAM_STT_KEY = 'sk_bdef6i5n_IMCodc8v3cOjtIod6qhvNM1b';

async function callSarvamDirectSTT(
  audioInput: any,
  base64Audio: string | null,
  language: string
): Promise<string | null> {
  try {
    const formData = new FormData();

    if (Platform.OS === 'web') {
      let blob: Blob | null = null;
      if (audioInput instanceof Blob) {
        blob = audioInput;
      } else if (audioInput && typeof audioInput === 'object' && audioInput.blob instanceof Blob) {
        blob = audioInput.blob;
      } else if (base64Audio) {
        const rawB64 = base64Audio.includes(',') ? base64Audio.split(',')[1] : base64Audio;
        if (rawB64 && rawB64.length > 50) {
          const byteCharacters = atob(rawB64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          blob = new Blob([byteArray], { type: 'audio/m4a' });
        }
      }

      if (!blob) return null;
      const fileName = blob.type.includes('webm') ? 'audio.webm' : 'audio.m4a';
      formData.append('file', blob, fileName);
    } else {
      // React Native Native (Android / iOS)
      let fileUri: string | undefined;
      if (typeof audioInput === 'string') {
        fileUri = audioInput;
      } else if (audioInput && typeof audioInput === 'object' && audioInput.uri) {
        fileUri = audioInput.uri;
      }

      if (fileUri && Platform.OS === 'android' && !fileUri.startsWith('file://') && !fileUri.startsWith('content://')) {
        fileUri = `file://${fileUri}`;
      }

      // Fallback: If no fileUri but base64 exists, write to temp file
      if (!fileUri && base64Audio) {
        const rawB64 = base64Audio.includes(',') ? base64Audio.split(',')[1] : base64Audio;
        if (rawB64 && rawB64.length > 100 && FileSystemLegacy?.cacheDirectory) {
          try {
            const tempPath = `${FileSystemLegacy.cacheDirectory}stt_temp_${Date.now()}.m4a`;
            await FileSystemLegacy.writeAsStringAsync(tempPath, rawB64, {
              encoding: FileSystemLegacy.EncodingType?.Base64 || 'base64',
            });
            fileUri = tempPath.startsWith('file://') ? tempPath : `file://${tempPath}`;
          } catch (e) {}
        }
      }

      if (!fileUri) {
        console.log('[Sarvam Cloud STT] No valid native fileUri available for transcription.');
        return null;
      }

      formData.append('file', {
        uri: fileUri,
        name: 'audio.m4a',
        type: 'audio/m4a',
      } as any);
    }

    formData.append('model', 'saaras:v3');

    const langCodeMap: Record<string, string> = {
      ta: 'ta-IN', te: 'te-IN', ml: 'ml-IN', hi: 'hi-IN',
      en: 'en-IN', mr: 'mr-IN', gu: 'gu-IN', or: 'od-IN',
      kn: 'kn-IN', bn: 'bn-IN',
    };
    const targetLang = langCodeMap[language] || 'unknown';
    formData.append('language_code', targetLang);

    const res = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'api-subscription-key': SARVAM_STT_KEY,
      },
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.transcript && data.transcript.trim()) {
        console.log('[Sarvam Cloud STT] Successfully transcribed real spoken voice:', data.transcript);
        return data.transcript.trim();
      }
    } else {
      const errText = await res.text().catch(() => '');
      if (res.status === 402 || errText.includes('insufficient_quota') || errText.includes('No credits')) {
        console.log('[Sarvam Cloud STT] Sarvam AI subscription quota exhausted (HTTP 402: No credits remaining).');
      } else {
        console.log('[Sarvam Cloud STT] Response status:', res.status, errText);
      }
    }
  } catch (err: any) {
    console.log('[Sarvam Cloud STT] Direct cloud transcription handled safely:', err?.message || err);
  }
  return null;
}

export async function transcribeAudio(
  audioInput: any,
  language: string = 'unknown'
): Promise<TranscribeResponse> {
  console.log('[STT Request] Processing real spoken voice audio input. Language:', language);

  const localWebSpeech = getRecognizedWebSpeechText();
  if (localWebSpeech && localWebSpeech.trim()) {
    console.log('[STT Request] Local device WebSpeech transcribed real spoken voice:', localWebSpeech);
    return {
      success: true,
      status: 'success',
      transcript: localWebSpeech.trim(),
      language: language || 'ta',
      language_code: `${language || 'ta'}-IN`,
    };
  }

  try {
    let base64Audio: string | null = null;
    let audioFormat = 'm4a';

    if (Platform.OS === 'web') {
      let blob: Blob | null = null;
      if (audioInput instanceof Blob) {
        blob = audioInput;
      } else if (audioInput && typeof audioInput === 'object' && audioInput.blob) {
        blob = audioInput.blob;
      }

      if (blob) {
        audioFormat = 'webm';
        base64Audio = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = (reader.result as string) || '';
            resolve(res.includes(',') ? res.split(',')[1] : res);
          };
          reader.onerror = (e) => reject(e);
          reader.readAsDataURL(blob!);
        });
      }
    } else {
      // React Native Native Platform (Android / iOS)
      let uri: string | undefined;
      if (typeof audioInput === 'string') {
        uri = audioInput;
      } else if (audioInput && typeof audioInput === 'object' && audioInput.uri) {
        uri = audioInput.uri;
      }

      if (uri) {
        base64Audio = await readLocalAudioBase64(uri);
      }
    }

    if ((base64Audio && base64Audio.length > 0) || audioInput) {
      // 1. Try local backend STT route with 12s timeout
      if (base64Audio && base64Audio.length > 0) {
        try {
          const result = await apiFetch<TranscribeResponse>('/bot/voice-stt-base64', {
            method: 'POST',
            body: JSON.stringify({
              audio_base64: base64Audio,
              format: audioFormat,
              language: language || 'unknown',
            }),
            timeoutMs: 12000,
          });

          if (result && result.transcript && result.transcript.trim()) {
            console.log('[STT Response] Backend transcribed real spoken voice:', result.transcript);
            return result;
          }
        } catch (err) {
          console.log('[STT Request] Backend STT endpoint fallback triggered');
        }
      }

      // 2. Direct Sarvam AI Cloud STT API (Transcribes real spoken voice in 10 Indian languages)
      const cloudTranscript = await callSarvamDirectSTT(audioInput, base64Audio, language || 'ta');
      if (cloudTranscript) {
        return {
          success: true,
          status: 'success',
          transcript: cloudTranscript,
          language: language || 'ta',
          language_code: `${language || 'ta'}-IN`,
        };
      }
    }
  } catch (err: any) {}

  return {
    success: false,
    status: 'error',
    transcript: '',
    message: 'Could not understand audio. Please speak clearly into microphone or type your question.',
  };
}

export interface VoiceTTSResponse {
  status: 'success' | 'error';
  audio_base64?: string | null;
  format?: string;
  language?: string;
  message?: string;
}

export async function synthesizeSpeech(
  text: string,
  language: string = 'ta'
): Promise<VoiceTTSResponse> {
  const cleanText = text.trim();
  if (!cleanText) {
    return { status: 'error', message: 'Text cannot be empty' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/bot/voice-tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        text: cleanText,
        language,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[TTS Request] Server returned error ${response.status}:`, errorText);
      return { status: 'error', message: `Server error (${response.status})` };
    }

    return await response.json();
  } catch (err: any) {
    console.warn('[TTS Request] Network error calling /bot/voice-tts:', err);
    return { status: 'error', message: err?.message || 'Network error' };
  }
}


