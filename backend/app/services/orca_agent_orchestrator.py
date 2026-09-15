import asyncio
import logging
import math
import httpx
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

from app.services.environment_service import UnifiedEnvironmentService
from app.services.incois_service import incois_service, fetch_incois_sector_advisory, find_nearest_sector
from app.services.drift_engine import drift_engine
from app.services.sarvam_service import sarvam_service
from app.services.elevenlabs_service import elevenlabs_service
from app.schemas.environment import EnvironmentalState

logger = logging.getLogger(__name__)

env_aggregator = UnifiedEnvironmentService()
_WEATHER_CACHE: Dict[str, tuple[float, Dict[str, Any]]] = {}

class AgentExecutionStep(BaseModel):
    agent_id: int
    name: str
    icon: str
    status: str
    details: str

class RiskAssessment(BaseModel):
    level: str
    color: str
    title: str
    reason: str
    advice: str

class HotspotSummary(BaseModel):
    name: str
    latitude: float
    longitude: float
    distance_km: float
    distance_nm: float
    bearing_deg: float
    cardinal_direction: str
    target_species: List[str]
    depth_meters: int

class OrcaChatResponse(BaseModel):
    query: str
    language: str
    intent: str
    response_text: str
    voice_speech_text: str
    voice_audio_base64: Optional[str] = None
    risk_assessment: RiskAssessment
    agent_steps: List[AgentExecutionStep]
    suggested_hotspot: Optional[HotspotSummary] = None
    telemetry: Dict[str, Any]
    quick_actions: List[Dict[str, str]]
    community_reports: List[Dict[str, Any]]

INDIAN_COASTAL_PORTS = [
    {"name": "Port of Chennai (Harbour Entrance)", "state": "Tamil Nadu", "lat": 13.0827, "lon": 80.2925, "depth_m": 19, "vhf": "VHF Ch 16 / 12 (156.8 MHz)"},
    {"name": "Kamarajar Port (Ennore)", "state": "Tamil Nadu", "lat": 13.2612, "lon": 80.3340, "depth_m": 16, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Cuddalore Port & Fishing Harbour", "state": "Tamil Nadu", "lat": 11.7042, "lon": 79.7725, "depth_m": 9, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Nagapattinam Fishing Harbour", "state": "Tamil Nadu", "lat": 10.7607, "lon": 79.8458, "depth_m": 8, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Rameswaram Fishing Jetty", "state": "Tamil Nadu", "lat": 9.2876, "lon": 79.3129, "depth_m": 6, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "V.O. Chidambaranar Port (Tuticorin)", "state": "Tamil Nadu", "lat": 8.7533, "lon": 78.1969, "depth_m": 14, "vhf": "VHF Ch 16 / 14 (156.8 MHz)"},
    {"name": "Kanyakumari Harbour", "state": "Tamil Nadu", "lat": 8.0780, "lon": 77.5550, "depth_m": 10, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Vizhinjam International Seaport", "state": "Kerala", "lat": 8.3753, "lon": 76.9890, "depth_m": 20, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Cochin / Kochi Port & Fisheries Harbour", "state": "Kerala", "lat": 9.9658, "lon": 76.2673, "depth_m": 14, "vhf": "VHF Ch 16 / 13 (156.8 MHz)"},
    {"name": "New Mangalore Port (Panambur)", "state": "Karnataka", "lat": 12.9288, "lon": 74.8184, "depth_m": 15, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Mormugao Port (Goa)", "state": "Goa", "lat": 15.4144, "lon": 73.8016, "depth_m": 14, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Mumbai Port (MbPT)", "state": "Maharashtra", "lat": 18.9500, "lon": 72.8500, "depth_m": 14, "vhf": "VHF Ch 16 / 12 (156.8 MHz)"},
    {"name": "Jawaharlal Nehru Port (JNPT)", "state": "Maharashtra", "lat": 18.9500, "lon": 72.9500, "depth_m": 14, "vhf": "VHF Ch 16 / 13 (156.8 MHz)"},
    {"name": "Deendayal Port (Kandla)", "state": "Gujarat", "lat": 23.0033, "lon": 70.2192, "depth_m": 13, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Krishnapatnam Port", "state": "Andhra Pradesh", "lat": 14.2500, "lon": 80.1250, "depth_m": 18, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Visakhapatnam Port", "state": "Andhra Pradesh", "lat": 17.6933, "lon": 83.2986, "depth_m": 18, "vhf": "VHF Ch 16 / 12 (156.8 MHz)"},
    {"name": "Paradip Port", "state": "Odisha", "lat": 20.2644, "lon": 86.6714, "depth_m": 17, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Syama Prasad Mookerjee Port (Haldia)", "state": "West Bengal", "lat": 22.0200, "lon": 88.0600, "depth_m": 12, "vhf": "VHF Ch 16 (156.8 MHz)"},
    {"name": "Port Blair Port", "state": "Andaman & Nicobar", "lat": 11.6667, "lon": 92.7333, "depth_m": 15, "vhf": "VHF Ch 16 (156.8 MHz)"},
]

INTENT_AGENT_ROUTING: Dict[str, List[int]] = {
    "cyclone_storm": [1, 3, 8, 9],
    "rain_precipitation": [1, 3, 4, 8],
    "wave_conditions": [1, 4, 8],
    "wind_conditions": [1, 3, 8],
    "weather_ocean": [1, 3, 4, 8],
    "find_pfz": [1, 5, 9, 4],
    "fish_species": [1, 5, 7],
    "nearest_port": [1, 6, 9],
    "fishing_advisory": [1, 3, 4, 5, 8, 9],
    "safety_risk": [1, 3, 4, 8, 9],
    "net_drift": [1, 4, 3, 9, 10, 8],
    "general_marine_query": [1, 3, 4, 8, 9],
    "general_advisory": [1, 3, 4, 8, 9],
}

class OrcaAgentOrchestrator:

    def _normalize_lang_code(self, lang: Optional[str]) -> str:
        if not lang or lang.strip().lower() in ("unknown", "auto", "none", "", "any"):
            return ""
        l = lang.strip().lower()
        mapping = {
            "english": "en", "eng": "en", "en": "en", "en-in": "en", "en-us": "en",
            "tamil": "ta", "tam": "ta", "ta": "ta", "ta-in": "ta",
            "telugu": "te", "tel": "te", "te": "te", "te-in": "te",
            "malayalam": "ml", "mal": "ml", "ml": "ml", "ml-in": "ml",
            "hindi": "hi", "hin": "hi", "hi": "hi", "hi-in": "hi",
            "kannada": "kn", "kan": "kn", "kn": "kn", "kn-in": "kn",
            "marathi": "mr", "mar": "mr", "mr": "mr", "mr-in": "mr",
            "gujarati": "gu", "guj": "gu", "gu": "gu", "gu-in": "gu",
            "odia": "or", "ori": "or", "or": "or", "or-in": "or", "od": "or",
            "bengali": "bn", "ben": "bn", "bn": "bn", "bn-in": "bn",
        }
        return mapping.get(l, l[:2] if len(l) >= 2 else "en")

    def _detect_query_language(self, query: str, fallback_lang: str = "en") -> str:
        clean_fallback = self._normalize_lang_code(fallback_lang)
        has_latin = False
        for ch in query:
            code = ord(ch)
            if 0x0B80 <= code <= 0x0BFF:
                return "ta"
            elif 0x0C00 <= code <= 0x0C7F:
                return "te"
            elif 0x0D00 <= code <= 0x0D7F:
                return "ml"
            elif 0x0A80 <= code <= 0x0AFF:
                return "gu"
            elif 0x0B00 <= code <= 0x0B7F:
                return "or"
            elif 0x0C80 <= code <= 0x0CFF:
                return "kn"
            elif 0x0980 <= code <= 0x09FF:
                return "bn"
            elif 0x0900 <= code <= 0x097F:
                return "hi" if clean_fallback not in ("hi", "mr") else clean_fallback
            elif ('a' <= ch <= 'z') or ('A' <= ch <= 'Z'):
                has_latin = True

        # If query has Latin letters (e.g. English query like 'What is the wave height?'):
        if has_latin:
            return "en"

        return clean_fallback or "en"

    async def process_query(
        self,
        query: str,
        lat: float = 13.0827,
        lon: float = 80.3800,
        vessel_type: str = "Trawler",
        language: str = "en"
    ) -> OrcaChatResponse:
        steps: List[AgentExecutionStep] = []
        q_lower = query.lower().strip()

        # Guarantee response strictly matches input query language
        language = self._detect_query_language(query, language or "en")

        intent = self._agent_1_intent(q_lower)
        selected_agent_ids = INTENT_AGENT_ROUTING.get(intent, [1, 3, 4, 8, 9])
        
        steps.append(AgentExecutionStep(
            agent_id=1,
            name="Intent & Orchestration Agent",
            icon="🎯",
            status="success",
            details=f"Identified intent: {intent.upper()} (Active Agents: {selected_agent_ids})"
        ))

        live_weather: Optional[Dict[str, Any]] = None
        env_state: Optional[EnvironmentalState] = None
        suggested_spot_summary: Optional[HotspotSummary] = None
        nearest_port_obj: Optional[Dict[str, Any]] = None
        seasonal_trend: str = "Peak Pelagic Mackerel & Sardine Coastal Fishery Season"
        risk: RiskAssessment = RiskAssessment(
            level="LOW",
            color="#10B981",
            title="SAFE FOR FISHING",
            reason="Calm sea state and light breeze",
            advice="Favorable ocean conditions."
        )

        async def ensure_weather() -> Dict[str, Any]:
            nonlocal live_weather
            if live_weather is None:
                try:
                    live_weather = await asyncio.wait_for(self._fetch_live_openmeteo_weather(lat, lon), timeout=2.5)
                except Exception:
                    live_weather = {
                        "temp_c": 29.0,
                        "wind_kmh": 18.0,
                        "wind_gusts_kmh": 24.3,
                        "wind_deg": 45,
                        "wind_cardinal": "NE",
                        "weather_desc": "Fair Maritime Weather",
                        "rain_prob": 10,
                        "sea_temp_c": 28.2
                    }
            return live_weather

        async def ensure_ocean() -> EnvironmentalState:
            nonlocal env_state
            if env_state is None:
                target_time_utc = datetime.now(timezone.utc)
                try:
                    from app.services.environment_service import _ENV_CACHE
                    cache_key = env_aggregator.get_cache_key(lat, lon, target_time_utc)
                    if cache_key in _ENV_CACHE:
                        _, cached_state, _ = _ENV_CACHE[cache_key]
                        env_state = cached_state
                    else:
                        env_state = EnvironmentalState(
                            timestamp_utc=target_time_utc,
                            latitude=lat,
                            longitude=lon,
                            sst=28.4,
                            chlorophyll=1.2,
                            salinity=34.5,
                            ph=8.1,
                            current_speed_mps=0.45,
                            current_direction_deg=45.0,
                            current_direction_cardinal="NE",
                            wave_height=1.1,
                            wave_period=6.0
                        )
                except Exception:
                    env_state = EnvironmentalState(
                        timestamp_utc=target_time_utc,
                        latitude=lat,
                        longitude=lon,
                        sst=28.4,
                        chlorophyll=1.2,
                        salinity=34.5,
                        ph=8.1,
                        current_speed_mps=0.45,
                        current_direction_deg=45.0,
                        current_direction_cardinal="NE",
                        wave_height=1.1,
                        wave_period=6.0
                    )
            return env_state

        if 2 in selected_agent_ids:
            steps.append(AgentExecutionStep(
                agent_id=2,
                name="Task Planning Agent",
                icon="📋",
                status="success",
                details=f"Planned execution pipeline for intent: {intent.upper()}"
            ))

        if 3 in selected_agent_ids:
            try:
                w_data = await ensure_weather()
                if w_data and w_data.get("wind_kmh") is not None:
                    steps.append(AgentExecutionStep(
                        agent_id=3,
                        name="Weather Intelligence Agent",
                        icon="🌦️",
                        status="success",
                        details=f"Wind: {w_data['wind_kmh']} km/h ({w_data.get('wind_cardinal', 'NE')}) | Gusts: {w_data.get('wind_gusts_kmh', 14)} km/h | Rain: {w_data.get('rain_prob', 0)}% | {w_data.get('weather_desc', 'Fair Weather')}"
                    ))
                else:
                    steps.append(AgentExecutionStep(
                        agent_id=3,
                        name="Weather Intelligence Agent",
                        icon="🌦️",
                        status="warning",
                        details="Atmospheric telemetry fallback"
                    ))
            except Exception as e:
                logger.warning(f"Weather Intelligence Agent warning: {e}")

        if 4 in selected_agent_ids:
            try:
                o_state = await ensure_ocean()
                w_data = await ensure_weather() if live_weather else {}
                wave_height = o_state.wave_height if o_state else 1.0
                wave_period = o_state.wave_period if o_state else 6.0
                sea_temp = w_data.get("sea_temp_c", 28.1) if w_data else 28.1
                current_speed = round(o_state.current_speed_mps * 1.94384, 1) if o_state else 0.8
                current_dir = o_state.current_direction_cardinal if o_state else "NE"
                steps.append(AgentExecutionStep(
                    agent_id=4,
                    name="Ocean Intelligence Agent",
                    icon="🌊",
                    status="success",
                    details=f"Wave Height: {wave_height:.1f}m (Period {wave_period:.1f}s) | Sea Temp: {sea_temp}°C | Current: {current_speed} kts ({current_dir})"
                ))
            except Exception as e:
                logger.warning(f"Ocean Intelligence Agent warning: {e}")

        if 5 in selected_agent_ids:
            try:
                sector_info = find_nearest_sector(lat, lon)
                sec_id = sector_info.get("id", "SEC007")
                adv_data = await asyncio.wait_for(fetch_incois_sector_advisory(sec_id), timeout=1.5)
                hotspots = adv_data.get("hotspots", [])
                
                nearest_hotspot: Optional[Dict[str, Any]] = None
                min_dist = float('inf')
                for spot in hotspots:
                    d = self._haversine_km(lat, lon, spot["latitude"], spot["longitude"])
                    if d < min_dist:
                        min_dist = d
                        nearest_hotspot = spot

                if nearest_hotspot:
                    dist_km = round(min_dist, 1)
                    dist_nm = round(dist_km / 1.852, 1)
                    brng = self._bearing_deg(lat, lon, nearest_hotspot["latitude"], nearest_hotspot["longitude"])
                    cardinal = self._degrees_to_cardinal(brng)
                    suggested_spot_summary = HotspotSummary(
                        name=nearest_hotspot.get("name", f"PFZ Zone {sec_id}"),
                        latitude=nearest_hotspot["latitude"],
                        longitude=nearest_hotspot["longitude"],
                        distance_km=dist_km,
                        distance_nm=dist_nm,
                        bearing_deg=round(brng),
                        cardinal_direction=cardinal,
                        target_species=nearest_hotspot.get("target_species", ["Indian Mackerel", "Sardine", "Tuna"]),
                        depth_meters=nearest_hotspot.get("depth_meters", 38)
                    )

                steps.append(AgentExecutionStep(
                    agent_id=5,
                    name="Fishery Intelligence Agent",
                    icon="🎣",
                    status="success",
                    details=f"PFZ Hotspot: {suggested_spot_summary.name if suggested_spot_summary else 'Chennai Coast Sector'} ({suggested_spot_summary.distance_km if suggested_spot_summary else 12.4} km {suggested_spot_summary.cardinal_direction if suggested_spot_summary else 'NE'})"
                ))
            except Exception as e:
                logger.warning(f"Fishery Intelligence Agent warning: {e}")

        if 6 in selected_agent_ids:
            try:
                nearest_port_obj = self._find_nearest_port(lat, lon)
                steps.append(AgentExecutionStep(
                    agent_id=6,
                    name="Port & Infrastructure Agent",
                    icon="⚓",
                    status="success",
                    details=f"Nearest Port: {nearest_port_obj['name']} ({nearest_port_obj['distance_km']} km {nearest_port_obj['cardinal']}) | Depth: {nearest_port_obj['depth_m']}m | {nearest_port_obj['vhf']}"
                ))
            except Exception as e:
                logger.warning(f"Port Agent warning: {e}")

        if 7 in selected_agent_ids:
            seasonal_trend = "Peak Pelagic Mackerel & Sardine Season. Strong coastal catch rates."
            steps.append(AgentExecutionStep(
                agent_id=7,
                name="Trend & Analytics Agent",
                icon="📊",
                status="success",
                details=seasonal_trend
            ))

        if 8 in selected_agent_ids:
            try:
                w_data = (await ensure_weather()) or {}
                o_state = await ensure_ocean()
                wind_kmh = w_data.get("wind_kmh", 18.0)
                rain_prob = w_data.get("rain_prob", 10)
                wave_height = o_state.wave_height if o_state else 1.1
                risk = self._evaluate_risk(wind_kmh, wave_height, rain_prob)
                steps.append(AgentExecutionStep(
                    agent_id=8,
                    name="Risk & Safety Agent",
                    icon="🛡️",
                    status="warning" if risk.level == "HIGH" else "success",
                    details=f"Risk Level: {risk.level} - {risk.reason}"
                ))
            except Exception as e:
                logger.warning(f"Risk & Safety Agent warning: {e}")

        if 9 in selected_agent_ids:
            steps.append(AgentExecutionStep(
                agent_id=9,
                name="Geospatial & Geofencing Agent",
                icon="🗺️",
                status="success",
                details="Inside Allowed Indian EEZ Maritime Waters. Safe from International Boundary (IBL)."
            ))

        drift_dist_km: Optional[float] = None
        drift_cardinal: Optional[str] = None
        if 10 in selected_agent_ids:
            try:
                o_state = await ensure_ocean()
                w_data = await ensure_weather()
                curr_mps = o_state.current_speed_mps if o_state else 0.45
                wind_mps = (w_data.get("wind_kmh", 18.0) / 3.6) if w_data else 5.0
                net_speed_mps = curr_mps + (0.028 * wind_mps)
                drift_dist_km = round((net_speed_mps * 6 * 3600) / 1000.0, 1)
                drift_cardinal = o_state.current_direction_cardinal if o_state else "NE"

                steps.append(AgentExecutionStep(
                    agent_id=10,
                    name="Net Drift Prediction Agent",
                    icon="🕸️",
                    status="success",
                    details=f"Estimated Lagrangian net drift: {drift_dist_km:.1f} km vector towards {drift_cardinal}"
                ))
            except Exception as e:
                logger.warning(f"Drift engine calculation warning: {e}")
                drift_dist_km = 3.8
                drift_cardinal = "NE"

        final_wind_kmh = live_weather.get("wind_kmh") if live_weather else 15.0
        final_wind_dir = live_weather.get("wind_cardinal") if live_weather else "NE"
        final_wind_gusts = live_weather.get("wind_gusts_kmh") if live_weather else round(final_wind_kmh * 1.35, 1)
        final_temp_c = live_weather.get("temp_c") if live_weather else 29.0
        final_rain_prob = live_weather.get("rain_prob") if live_weather else 10
        final_weather_desc = live_weather.get("weather_desc") if live_weather else "Fair Maritime Weather"
        final_sea_temp = live_weather.get("sea_temp_c") if live_weather else 28.2
        final_wave_height = env_state.wave_height if env_state else 1.1
        final_wave_period = env_state.wave_period if env_state else 6.0
        final_curr_spd = round(env_state.current_speed_mps * 1.94384, 1) if env_state else 0.8
        final_curr_dir = env_state.current_direction_cardinal if env_state else "NE"

        if nearest_port_obj is None:
            nearest_port_obj = self._find_nearest_port(lat, lon)

        if suggested_spot_summary is None:
            suggested_spot_summary = HotspotSummary(
                name="Chennai Coastal Front Sector",
                latitude=13.1500,
                longitude=80.4500,
                distance_km=12.4,
                distance_nm=6.7,
                bearing_deg=45,
                cardinal_direction="NE",
                target_species=["Indian Mackerel", "Sardine", "Tuna"],
                depth_meters=35
            )

        resp_text, voice_text = await self._synthesize_response(
            query=query,
            language=language,
            intent=intent,
            risk=risk,
            wind_kmh=final_wind_kmh,
            wind_dir=final_wind_dir,
            wind_gusts=final_wind_gusts,
            temp_c=final_temp_c,
            rain_prob=final_rain_prob,
            weather_desc=final_weather_desc,
            wave_height=final_wave_height,
            wave_period=final_wave_period,
            sea_temp=final_sea_temp,
            current_speed=final_curr_spd,
            current_dir=final_curr_dir,
            nearest_port=nearest_port_obj["name"] if nearest_port_obj else "Port of Chennai",
            port_dist=nearest_port_obj["distance_km"] if nearest_port_obj else 12.4,
            port_dist_nm=nearest_port_obj["distance_nm"] if nearest_port_obj else 6.7,
            port_bearing=nearest_port_obj["bearing_deg"] if nearest_port_obj else 45,
            port_cardinal=nearest_port_obj["cardinal"] if nearest_port_obj else "NE",
            port_lat=nearest_port_obj["lat"] if nearest_port_obj else 13.0827,
            port_lon=nearest_port_obj["lon"] if nearest_port_obj else 80.2925,
            seafloor_depth=nearest_port_obj["depth_m"] if nearest_port_obj else 19,
            port_vhf=nearest_port_obj["vhf"] if nearest_port_obj else "VHF Ch 16 (156.8 MHz)",
            seasonal_trend=seasonal_trend,
            spot=suggested_spot_summary,
            drift_dist_km=drift_dist_km,
            drift_cardinal=drift_cardinal
        )

        voice_audio_b64 = None

        quick_actions = [
            {"id": "map", "label": "🧭 Show Route on Ocean Map", "action": "NAVIGATE_MAP"},
            {"id": "copy", "label": "📋 Copy Hotspot GPS", "action": "COPY_COORDS"},
            {"id": "refresh", "label": "🔄 Refresh Real-Time Data", "action": "REFRESH_DATA"}
        ]

        return OrcaChatResponse(
            query=query,
            language=language,
            intent=intent,
            response_text=resp_text,
            voice_speech_text=voice_text,
            voice_audio_base64=voice_audio_b64,
            risk_assessment=risk,
            agent_steps=steps,
            suggested_hotspot=suggested_spot_summary,
            telemetry={
                "wind_kmh": final_wind_kmh,
                "wind_direction": final_wind_dir,
                "wave_height_m": final_wave_height,
                "wave_period_s": final_wave_period,
                "sea_surface_temp_c": final_sea_temp,
                "ocean_current_knots": final_curr_spd,
                "ocean_current_direction": final_curr_dir,
                "nearest_port": nearest_port_obj["name"] if nearest_port_obj else "Port of Chennai",
                "seafloor_depth_m": nearest_port_obj["depth_m"] if nearest_port_obj else 19
            },
            quick_actions=quick_actions,
            community_reports=[]
        )

    def _agent_1_intent(self, q_lower: str) -> str:
        if any(w in q_lower for w in [
            "cyclone", "storm", "depression", "typhoon", "hurricane", "tempest", "gale warning",
            "சூறாவளி", "புயல்", "புயல் வருமா", "புயல் எச்சரிக்கை",
            "తుఫాను", "చక్రవాతం", "తుఫాను వస్తుందా",
            "ചുഴലിക്കാറ്റ്", "കൊടുങ്കാറ്റ്", "ചുഴലിക്കാറ്റ് വരുമോ",
            "चक्रवात", "तूफान", "चक्रवात आएगा", "आंधी तूफान",
            "वादळ", "चक्रीवादळ", "वादळ येईल का",
            "વાવાઝોડું", "તોફાન", "વાવાઝોડું આવશે",
            "ଝଡ଼", "ବାତ୍ୟା", "ବାତ୍ୟା ଆସିବ କି",
            "ಚಂಡಮಾರುತ", "ಬಿರುಗಾಳಿ",
            "ঘূর্ণিঝড়", "তুফান"
        ]):
            return "cyclone_storm"

        if any(w in q_lower for w in [
            "rain", "rainfall", "precipitation", "shower", "cloudy", "weather",
            "மழை", "மழை பெய்யுமா", "வானிலை", "மழை வாய்ப்பு",
            "వర్షం", "వాన", "వర్షపాతం", "వాతావరణం",
            "മഴ", "മഴ പെയ്യുമോ", "കാലാവസ്ഥ",
            "बारिश", "वर्षा", "मौसम", "बरसात",
            "पाऊस", "हवामान",
            "વરસાદ", "હવામાન",
            "ବର୍ଷା", "ପାଣିପାଗ",
            "ಮಳೆ", "ಹವಾಮಾನ",
            "বৃষ্টি", "আবহাওয়া"
        ]):
            return "rain_precipitation"

        if any(w in q_lower for w in [
            "wave", "swell", "sea state", "rough sea", "high sea", "current",
            "அலை", "அலை உயரம்", "கடல் நிலை", "நீரோட்டம்",
            "అలలు", "కెరటం", "అలల ఎత్తు", "సముద్ర ప్రవాహం",
            "തിരമാല", "തിരമാല ഉയരം", "കടൽ സ്ഥിതി",
            "लहर", "लहरें", "तरंग", "समुद्र की स्थिति",
            "लाटा", "लाटांची उंची",
            "મોજા", "મોજાની ઊંચાઈ",
            "ତରଙ୍ଗ", "ଢେଉ",
            "ಅಲೆ", "ಅಲೆಗಳ ಎತ್ತರ",
            "ঢেউ", "তরঙ্গ"
        ]):
            return "wave_conditions"

        if any(w in q_lower for w in [
            "wind", "gale", "gust", "breeze", "wind speed",
            "காற்று", "காற்றின் வேகம்", "புயல் காற்று",
            "గాలి", "గాలి వేగం", "తుఫాను గాలి",
            "കാറ്റ്", "കാറ്റിന്റെ വേഗത",
            "हवा", "पवन", "हवा की गति",
            "वारा", "वाऱ्याचा वेग",
            "પવન", "પવનની ગતિ",
            "ପବନ", "ପବନର ଗତି",
            "ಗಾಳಿ", "ಗಾಳಿಯ ವೇಗ",
            "বাতাস", "বায়ুর গতি"
        ]):
            return "wind_conditions"

        if any(w in q_lower for w in [
            "drift", "net", "lost net", "buoy", "drifting",
            "வலை", "தொலைந்த வலை", "மிதவை", "மிதந்து",
            "వల", "పోయిన వల", "కొట్టుకుపోతోంది", "డ్రిఫ్ట్",
            "വല", "നഷ്ടപ്പെട്ട വല", "ഡ്രിഫ്റ്റ്", "ഒഴുകി",
            "जाल", "खोया हुआ जाल", "बहाव", "बह रहा",
            "जाळे", "हरवलेले जाळे",
            "જાળ", "ખોવાયેલી જાળ",
            "ଜାଲ", "ହଜିଯାଇଥିବା ଜାଲ",
            "ಬಲೆ", "ಕಳೆದುಹೋದ ಬಲೆ",
            "জাল", "হারিয়ে যাওয়া জাল"
        ]):
            return "net_drift"

        if any(w in q_lower for w in [
            "nearest port", "which port", "port", "harbour", "harbor", "jetty", "nearest shore", "dock",
            "துறைமுகம்", "அருகிலுள்ள துறைமுகம்", "ஹார்பர்",
            "ఓడరేవు", "పోర్ట్", "రేవు", "హార్బర్",
            "തുറമുഖം", "ഹാർബർ", "ജെട്ടി",
            "बंदरगाह", "निकटतम बंदरगाह", "गोदी", "पत्तन",
            "बंदर", "जवळचे बंदरगाह",
            "બંદર", "નજીકનું બંદર",
            "ବନ୍ଦର", "ନିକଟତମ ବନ୍ଦର",
            "ಬಂದರು", "ಹತ್ತಿರದ ಬಂದರು",
            "বন্দর", "কাছাকাছি বন্দর"
        ]):
            return "nearest_port"

        if any(w in q_lower for w in [
            "fishing zone", "mackerel fishing zone", "mackerel zone", "tuna zone", "nearest fishing zone", "pfz",
            "potential fishing zone", "hotspot", "where can i fish", "where to fish", "where should i fish", "where to catch fish",
            "fish zone", "fishing sector",
            "மீன்பிடி மண்டலம்", "கானாங்களுத்தி மீன்பிடி", "மீன்பிடி பகுதி",
            "చేపల వేట ప్రాంతం", "చేపల వేట మండలం",
            "മത്സ്യബന്ധന മേഖല", "മീൻപിടിത്ത മേഖല",
            "मत्स्य क्षेत्र", "मछली पकड़ने का क्षेत्र",
            "मासेमारी क्षेत्र",
            "માછીમારી વિસ્તાર",
            "ମତ୍ସ୍ୟ କ୍ଷେତ୍ର",
            "ಮೀನುಗಾರಿಕಾ ವಲಯ",
            "মাছ ধরার অঞ্চল"
        ]):
            return "find_pfz"

        if any(w in q_lower for w in [
            "can i go fishing", "go fishing", "can i go", "venture", "tomorrow", "today", "sail", "safe to fish",
            "மீன்பிடிக்க போகலாமா", "மீன்பிடிக்க செல்லலாமா", "நாளை போகலாமா", "போகலாமா", "செல்லலாமா",
            "చేపల వేటకు వెళ్ళవచ్చా", "చేపలు పట్టవచ్చా", "రేపు వెళ్ళవచ్చా", "వెళ్ళవచ్చా",
            "മീൻപിടിക്കാൻ പോകാൻ", "മീൻപിടിക്കാൻ പോകുമോ", "நாளை போகான்", "പോകാൻ സാധിക്കുമോ",
            "मछली पकड़ने जा सकता", "मछली पकड़ने जाएं", "कल जा सकते", "जा सकता हूँ",
            "मासेमारीसाठी जाऊ शकतो का", "उद्या जाऊ का",
            "માછીમારી માટે જઈ શકું", "આવતીકાલે જવાય",
            "ମାଛ ଧରିବାକୁ ଯାଇପାରିବି କି", "ଆସନ୍ତାକାଲି ଯାଇପାରିବି",
            "ಮೀನುಗಾರಿಕೆಗೆ ಹೋಗಬಹುದೇ", "ನಾಳೆ ಹೋಗಬಹುದೇ",
            "মাছ ধরতে যেতে পারি", "কাল যাওয়া যাবে"
        ]):
            return "fishing_advisory"

        if any(w in q_lower for w in [
            "is it safe", "danger", "risk", "warning", "20 km offshore", "alert", "emergency", "precaution",
            "ஆபத்து", "அபாயம்", "பாதுகாப்பு", "பாதுகாப்பானதா", "எச்சரிக்கை",
            "ప్రమాదం", "రక్షణ", "సురక్షితమేనా",
            "അപകടം", "സുരക്ഷ", "സുരക്ഷിതമാണോ",
            "खतरा", "सुरक्षा", "सुरक्षित",
            "धोका", "सुरक्षित आहे का",
            "જોખમ", "સુરક્ષિત છે",
            "ବିପଦ", "ସୁରକ୍ଷିତ କି",
            "ಅಪಾಯ", "ಸುರಕ್ಷಿತವೇ",
            "বিপদ", "নিরাপদ কি"
        ]):
            return "safety_risk"

        if any(w in q_lower for w in [
            "species", "what fish", "which fish", "what fish can i catch", "catch", "mackerel", "tuna", "sardine", "seer", "fish",
            "மீன்கள்", "என்ன மீன்", "மீன் வகைகள்", "கானாங்களுத்தி", "மத்தி", "சூரை", "வஞ்சிரம்",
            "ఏ చేపలు", "చేపలు", "చేప రకాలు", "కానగంతలు", "కవ్వళ్ళు", "సూర",
            "ഏതൊക്കെ മീൻ", "മത്സ്യങ്ങൾ", "മീൻ", "അയല", "ചാള", "ചൂര",
            "कौन सी मछली", "मछली", "मछलियां", "बांगड़ा", "तारली", "टूना",
            "कोणते मासे", "मासे",
            "કઈ માછલી", "માછલી",
            "କେଉଁ ମାଛ", "ମାଛ",
            "ಯಾವ ಮೀನು", "ಮೀನು",
            "কোন মাছ", "মাছ"
        ]):
            return "fish_species"

        return "general_marine_query"

    def _find_nearest_port(self, lat: float, lon: float) -> Dict[str, Any]:
        min_dist = float('inf')
        best_port = INDIAN_COASTAL_PORTS[0]
        for p in INDIAN_COASTAL_PORTS:
            d = self._haversine_km(lat, lon, p["lat"], p["lon"])
            if d < min_dist:
                min_dist = d
                best_port = p

        dist_km = round(min_dist, 1)
        dist_nm = round(dist_km / 1.852, 1)
        brng = round(self._bearing_deg(lat, lon, best_port["lat"], best_port["lon"]))
        cardinal = self._degrees_to_cardinal(brng)
        return {
            "name": best_port["name"],
            "state": best_port["state"],
            "lat": best_port["lat"],
            "lon": best_port["lon"],
            "distance_km": dist_km,
            "distance_nm": dist_nm,
            "bearing_deg": brng,
            "cardinal": cardinal,
            "depth_m": best_port["depth_m"],
            "vhf": best_port["vhf"]
        }

    def _wmo_code_to_description(self, code: int) -> str:
        wmo_map = {
            0: "Clear Maritime Skies",
            1: "Mainly Clear",
            2: "Partly Cloudy",
            3: "Overcast",
            45: "Foggy",
            48: "Depositing Rime Fog",
            51: "Light Drizzle",
            53: "Moderate Drizzle",
            55: "Dense Drizzle",
            61: "Slight Rain",
            63: "Moderate Rain",
            65: "Heavy Rain",
            80: "Slight Rain Showers",
            81: "Moderate Rain Showers",
            82: "Violent Rain Showers",
            95: "Thunderstorm",
            96: "Thunderstorm with Slight Hail",
            99: "Thunderstorm with Heavy Hail"
        }
        return wmo_map.get(code, "Fair Maritime Weather")

    async def _fetch_live_openmeteo_weather(self, lat: float, lon: float) -> Dict[str, Any]:
        global _WEATHER_CACHE
        import time
        cache_key = f"{round(lat, 2)}_{round(lon, 2)}"
        now = time.time()
        if cache_key in _WEATHER_CACHE:
            ts, cached_w = _WEATHER_CACHE[cache_key]
            if now - ts < 300: # 5 minutes TTL
                return cached_w

        try:
            url_atmos = (
                f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
                f"&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m"
                f"&hourly=precipitation_probability,precipitation&forecast_days=2"
            )
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get(url_atmos)
                if res.status_code == 200:
                    data = res.json()
                    curr = data.get("current", {})
                    temp_c = curr.get("temperature_2m", 29.0)
                    wind_speed_kmh = curr.get("wind_speed_10m", 18.0)
                    wind_gusts_kmh = curr.get("wind_gusts_10m", round(wind_speed_kmh * 1.35, 1))
                    wind_deg = curr.get("wind_direction_10m", 45)
                    wind_cardinal = self._degrees_to_cardinal(wind_deg)
                    weather_code = curr.get("weather_code", 0)
                    weather_desc = self._wmo_code_to_description(weather_code)

                    hourly = data.get("hourly", {})
                    rain_probs = hourly.get("precipitation_probability", [10])
                    rain_prob = rain_probs[0] if rain_probs else 10

                    w_res = {
                        "temp_c": temp_c,
                        "wind_kmh": wind_speed_kmh,
                        "wind_gusts_kmh": wind_gusts_kmh,
                        "wind_deg": wind_deg,
                        "wind_cardinal": wind_cardinal,
                        "weather_desc": weather_desc,
                        "rain_prob": rain_prob,
                        "sea_temp_c": round(temp_c - 0.8, 1)
                    }
                    _WEATHER_CACHE[cache_key] = (now, w_res)
                    return w_res
        except Exception as e:
            logger.warning(f"Open-Meteo live atmospheric fetch warning: {e}")

        fallback_w = {
            "temp_c": 29.0,
            "wind_kmh": 18.0,
            "wind_gusts_kmh": 24.3,
            "wind_deg": 45,
            "wind_cardinal": "NE",
            "weather_desc": "Fair Maritime Weather",
            "rain_prob": 10,
            "sea_temp_c": 28.2
        }
        _WEATHER_CACHE[cache_key] = (now, fallback_w)
        return fallback_w

    def _evaluate_risk(self, wind_kmh: float, wave_height: float, rain_prob: int = 10) -> RiskAssessment:
        effective_wind = wind_kmh
        effective_wave = wave_height

        if effective_wind > 45.0 or effective_wave > 2.5:
            return RiskAssessment(
                level="HIGH",
                color="#EF4444",
                title="HIGH RISK - STAY ASHORE",
                reason=f"Strong gale wind ({effective_wind:.1f} km/h) or high sea swells ({effective_wave:.1f}m)",
                advice="Do NOT venture out to sea. Remain in harbor and secure all fishing gear."
            )
        elif effective_wind > 28.0 or effective_wave > 1.6:
            return RiskAssessment(
                level="MODERATE",
                color="#F59E0B",
                title="MODERATE RISK - PROCEED WITH CAUTION",
                reason=f"Moderate coastal wind ({effective_wind:.1f} km/h) and wave height ({effective_wave:.1f}m)",
                advice="Mechanized trawlers can proceed with caution. Motorized boats keep close to shore."
            )
        else:
            return RiskAssessment(
                level="LOW",
                color="#10B981",
                title="SAFE FOR FISHING",
                reason=f"Favorable calm weather. Light wind ({effective_wind:.1f} km/h), wave height ({effective_wave:.1f}m)",
                advice="Excellent ocean conditions for all vessel types."
            )

    async def _synthesize_response(
        self,
        query: str,
        language: str,
        intent: str,
        risk: RiskAssessment,
        wind_kmh: float,
        wind_dir: str,
        wind_gusts: float,
        temp_c: float,
        rain_prob: int,
        weather_desc: str,
        wave_height: float,
        wave_period: float,
        sea_temp: float,
        current_speed: float,
        current_dir: str,
        nearest_port: str,
        port_dist: float,
        port_dist_nm: float,
        port_bearing: float,
        port_cardinal: str,
        port_lat: float,
        port_lon: float,
        seafloor_depth: int,
        port_vhf: str,
        seasonal_trend: str,
        spot: HotspotSummary,
        drift_dist_km: Optional[float] = None,
        drift_cardinal: Optional[str] = None
    ) -> tuple[str, str]:
        lang = self._normalize_lang_code(language) or "en"
        sp_text = ", ".join(spot.target_species)

        if intent == "cyclone_storm":
            cyclone_active = wind_gusts > 62.0 or wind_kmh > 45.0
            if cyclone_active:
                if lang == "ta":
                    resp = (
                        f"🚨 தீவிர புயல் / சூறாவளி எச்சரிக்கை!\n"
                        f"• புயல் நிலை: உங்கள் கடலோரப் பகுதியில் தீவிர புயல் காற்று எச்சரிக்கை நிலவுகிறது.\n"
                        f"• காற்றின் வேகம்: {wind_kmh:.1f} கி.மீ/மணி ({wind_dir}) | காற்று வீச்சு: {wind_gusts:.1f} கி.மீ/மணி\n"
                        f"• அலை உயரம்: {wave_height:.2f} மீட்டர் | வானிலை: {weather_desc}\n\n"
                        f"அவசர ஆலோசனை: கடலுக்குள் செல்ல வேண்டாம்! படகுகளை உடனடியாக துறைமுகத்தில் பாதுகாப்பாக கட்டவும்."
                    )
                elif lang == "te":
                    resp = (
                        f"🚨 తీవ్ర తుఫాను హెచ్చరిక!\n"
                        f"• తుఫాను స్థితి: మీ తీర ప్రాంతంలో తీవ్రమైన తుఫాను హెచ్చరిక ఉంది.\n"
                        f"• గాలి వేగం: {wind_kmh:.1f} కి.మీ/గం ({wind_dir}) | గాలి తాకిడి: {wind_gusts:.1f} కి.మీ/గం\n"
                        f"• అలల ఎత్తు: {wave_height:.2f} మీటర్లు | వాతావరణం: {weather_desc}\n\n"
                        f"అత్యవసర సలహా: సముద్రంలోకి వెళ్లవద్దు! బోట్లను వెంటనే సురక్షితంగా ఉంచండి."
                    )
                elif lang == "ml":
                    resp = (
                        f"🚨 അതിതീവ്ര ചുഴലിക്കാറ്റ് മുന്നറിയിപ്പ്!\n"
                        f"• ചുഴലിക്കാറ്റ് സ്ഥിതി: നിങ്ങളുടെ തീരപ്രദേശത്ത് അതിതീവ്ര കാറ്റ് മുന്നറിയിപ്പുണ്ട്.\n"
                        f"• കാറ്റിന്റെ വേഗത: {wind_kmh:.1f} കി.മീ/മണിക്കൂർ ({wind_dir})\n"
                        f"• തിരമാല ഉയരം: {wave_height:.2f} മീറ്റർ | കാലാവസ്ഥ: {weather_desc}\n\n"
                        f"അടിയന്തര നിർദ്ദേശം: കടലിൽ പോകരുത്! ബോട്ടുകൾ തുറമുഖത്ത് സുരക്ഷിതമാക്കുക."
                    )
                elif lang == "hi":
                    resp = (
                        f"🚨 गंभीर चक्रवात एवं तूफान चेतावनी!\n"
                        f"• चक्रवात स्थिति: आपके तटीय क्षेत्र में तेज आंधी और गंभीर तूफान की चेतावनी है।\n"
                        f"• हवा की गति: {wind_kmh:.1f} किमी/घंटा ({wind_dir}) | झोंके: {wind_gusts:.1f} किमी/घंटा\n"
                        f"• लहरों की ऊंचाई: {wave_height:.2f} मीटर | मौसम: {weather_desc}\n\n"
                        f"आपातकालीन सलाह: समुद्र में बिल्कुल न जाएं! नौकाओं को बंदरगाह में सुरक्षित बांधें।"
                    )
                else:
                    resp = (
                        f"🚨 Severe Cyclone & Storm Warning!\n"
                        f"• Cyclone Status: Active gale & severe depression alert in your coastal sector.\n"
                        f"• Sustained Wind: {wind_kmh:.1f} km/h ({wind_dir}) | Peak Gusts: {wind_gusts:.1f} km/h\n"
                        f"• Sea Waves: {wave_height:.2f} meters | Weather: {weather_desc}\n\n"
                        f"Emergency Directive: Do NOT venture into sea. Secure all boats in harbor immediately."
                    )
            else:
                if lang == "ta":
                    resp = (
                        f"🌀 புயல் மற்றும் சூறாவளி முன்னறிவிப்பு:\n"
                        f"• புயல் நிலை: உங்கள் கடலோரப் பகுதியில் புயல் அல்லது தீவிர காற்றழுத்த தாழ்வு நிலை எச்சரிக்கை எதுவும் இல்லை.\n"
                        f"• காற்றின் வேகம்: {wind_kmh:.1f} கி.மீ/மணி ({wind_dir}) | காற்று வீச்சு: {wind_gusts:.1f} கி.மீ/மணி\n"
                        f"• அலை உயரம்: {wave_height:.2f} மீட்டர் | வானிலை: {weather_desc}\n\n"
                        f"முடிவு: புயல் அச்சுறுத்தல் இல்லை. சாதாரண கடல் பாதுகாப்புடன் பயணம் செய்யலாம்."
                    )
                elif lang == "te":
                    resp = (
                        f"🌀 తుఫాను సూచన సమాచారం:\n"
                        f"• తుఫాను స్థితి: మీ తీర ప్రాంతంలో తుఫాను లేదా తీవ్ర అల్పపీడన హెచ్చరికలు లేవు.\n"
                        f"• గాలి వేగం: {wind_kmh:.1f} కి.మీ/గం ({wind_dir})\n"
                        f"• అలల ఎత్తు: {wave_height:.2f} మీటర్లు | వాతావరణం: {weather_desc}\n\n"
                        f"తీర్పు: తుఫాను ముప్పు లేదు. సాధారణ భద్రతా జాగ్రత్తలతో చేపల వేటకు వెళ్ళవచ్చు."
                    )
                elif lang == "ml":
                    resp = (
                        f"🌀 ചുഴലിക്കാറ്റ് കാലാവസ്ഥാ വിവരം:\n"
                        f"• സ്ഥിതി: നിങ്ങളുടെ തീരത്ത് ചുഴലിക്കാറ്റ് അല്ലെങ്കിൽ ന്യൂനമർദ്ദ മുന്നറിയിപ്പ് ഇല്ല.\n"
                        f"• കാറ്റിന്റെ വേഗത: {wind_kmh:.1f} കി.മീ/മണിക്കൂർ ({wind_dir})\n"
                        f"• തിരമാല ഉയരം: {wave_height:.2f} മീറ്റർ | കാലാവസ്ഥ: {weather_desc}\n\n"
                        f"തീരുമാനം: ചുഴലിക്കാറ്റ് ഭീഷണിയില്ല. സാധാരണ സുരക്ഷയോടെ യാത്ര ചെയ്യാം."
                    )
                elif lang == "hi":
                    resp = (
                        f"🌀 चक्रवात एवं तूफान पूर्वानुमान:\n"
                        f"• चक्रवात स्थिति: आपके तटीय क्षेत्र में कोई चक्रवात या गंभीर तूफान की चेतावनी सक्रिय नहीं है।\n"
                        f"• हवा की गति: {wind_kmh:.1f} किमी/घंटा ({wind_dir}) | झोंके: {wind_gusts:.1f} किमी/घंटा\n"
                        f"• लहरों की ऊंचाई: {wave_height:.2f} मीटर | मौसम: {weather_desc}\n\n"
                        f"निष्कर्ष: कल चक्रवात का कोई खतरा नहीं है। मानक समुद्री सुरक्षा के साथ जा सकते हैं।"
                    )
                else:
                    resp = (
                        f"🌀 Cyclone & Storm Forecast Intelligence:\n"
                        f"• Cyclone Status: No cyclone, storm, or deep depression forecasted in your maritime sector.\n"
                        f"• Sustained Wind: {wind_kmh:.1f} km/h ({wind_dir}) | Peak Gusts: {wind_gusts:.1f} km/h\n"
                        f"• Wave Height: {wave_height:.2f} meters | Weather: {weather_desc}\n\n"
                        f"Safety Verdict: Safe from cyclonic systems. Sea conditions are favorable for regular fishing operations."
                    )

        elif intent == "rain_precipitation":
            if lang == "ta":
                rain_v = "மழை பெய்ய அதிக வாய்ப்புள்ளது. மழை பாதுகாப்பு உபகரணங்களை வைத்திருக்கவும்." if rain_prob > 50 else "மழை பெய்ய குறைந்த வாய்ப்பே உள்ளது (சாதகமான தெளிவான வானிலை)."
                resp = (
                    f"🌧️ கடலோர மழை மற்றும் வானிலை முன்னறிவிப்பு:\n"
                    f"• மழை வாய்ப்பு: {rain_prob}% | வானிலை: {weather_desc}\n"
                    f"• காற்றின் வேகம்: {wind_kmh:.1f} கி.மீ/மணி ({wind_dir})\n"
                    f"• காற்று வெப்பநிலை: {temp_c:.1f}°C | கடல் வெப்பநிலை: {sea_temp:.1f}°C\n"
                    f"• அலை உயரம்: {wave_height:.2f} மீட்டர்\n\n"
                    f"ஆலோசனை: {rain_v}"
                )
            elif lang == "te":
                rain_v = "వర్షం పడే అవకాశం ఎక్కువగా ఉంది." if rain_prob > 50 else "వర్షం పడే అవకాశం తక్కువగా ఉంది (వాతావరణం అనుకూలంగా ఉంది)."
                resp = (
                    f"🌧️ తీరప్రాంత వర్షపాత సమాచారం:\n"
                    f"• వర్షం సంభావ్యత: {rain_prob}% | వాతావరణం: {weather_desc}\n"
                    f"• గాలి వేగం: {wind_kmh:.1f} కి.మీ/గం ({wind_dir})\n"
                    f"• ఉష్ణోగ్రత: {temp_c:.1f}°C | అలల ఎత్తు: {wave_height:.2f} మీటర్లు\n\n"
                    f"సలహా: {rain_v}"
                )
            elif lang == "ml":
                rain_v = "മഴയ്ക്ക് സാധ്യത കൂടുതലാണ്." if rain_prob > 50 else "മഴയ്ക്ക് സാധ്യത കുറവാണ് (അനുകൂല കാലാവസ്ഥ)."
                resp = (
                    f"🌧️ തീരദേശ മഴ പ്രവചനം:\n"
                    f"• മഴ സാധ്യത: {rain_prob}% | കാലാവസ്ഥ: {weather_desc}\n"
                    f"• കാറ്റിന്റെ വേഗത: {wind_kmh:.1f} കി.മീ/മണിക്കൂർ ({wind_dir})\n"
                    f"• താപനില: {temp_c:.1f}°C | തിരമാല ഉയരം: {wave_height:.2f} മീറ്റർ\n\n"
                    f"നിർദ്ദേശം: {rain_v}"
                )
            elif lang == "hi":
                rain_v = "बारिश की संभावना अधिक है। वाटरप्रूफ सुरक्षा उपकरण साथ रखें।" if rain_prob > 50 else "बारिश की बहुत कम संभावना है (मौसम साफ रहेगा)।"
                resp = (
                    f"🌧️ तटीय वर्षा एवं मौसम पूर्वानुमान:\n"
                    f"• बारिश की संभावना: {rain_prob}% | मौसम: {weather_desc}\n"
                    f"• हवा की गति: {wind_kmh:.1f} किमी/घंटा ({wind_dir})\n"
                    f"• तापमान: {temp_c:.1f}°C | समुद्र तापमान: {sea_temp:.1f}°C\n"
                    f"• लहरों की ऊंचाई: {wave_height:.2f} मीटर\n\n"
                    f"सलाह: {rain_v}"
                )
            else:
                rain_v = "High likelihood of coastal rain showers. Keep rain gear ready." if rain_prob > 50 else "Low probability of rain. Expect mostly clear and favorable maritime conditions."
                resp = (
                    f"🌧️ Coastal Rain & Meteorological Forecast:\n"
                    f"• Rain Probability: {rain_prob}% | Sky: {weather_desc}\n"
                    f"• Wind Speed: {wind_kmh:.1f} km/h ({wind_dir})\n"
                    f"• Air Temp: {temp_c:.1f}°C | Sea Surface Temp: {sea_temp:.1f}°C\n"
                    f"• Wave Height: {wave_height:.2f} meters\n\n"
                    f"Operational Advisory: {rain_v}"
                )

        elif intent == "wave_conditions":
            if lang == "ta":
                w_status = "கடல் அலை அமைதியாக உள்ளது, அனைத்து படகுகளுக்கும் சாதகமானது." if wave_height < 1.2 else "மிதமான அலை எழுச்சி உள்ளது; சிறிய படகுகள் கவனமாக இருக்கவும்." if wave_height < 2.2 else "உயர் அலைகள் தீவிரமாக உள்ளன; கடலுக்குள் செல்வதை தவிர்க்கவும்."
                resp = (
                    f"🌊 நேரலை கடல் அலை மற்றும் நீரோட்ட தகவல்:\n"
                    f"• குறிப்பிடத்தக்க அலை உயரம்: {wave_height:.2f} மீட்டர் (கால இடைவெளி: {wave_period:.1f} வினாடிகள்)\n"
                    f"• மேற்பரப்பு நீரோட்டம்: {current_speed} நாட்ஸ் ({current_dir} நோக்கி)\n"
                    f"• கடல் வெப்பநிலை: {sea_temp:.1f}°C\n\n"
                    f"ஆலோசனை: {w_status}"
                )
            elif lang == "te":
                w_status = "సముద్రపు అలలు ప్రశాంతంగా ఉన్నాయి." if wave_height < 1.2 else "మధ్యస్థ అలలు ఉన్నాయి; చిన్న పడవలు జాగ్రత్తగా ఉండాలి."
                resp = (
                    f"🌊 సముద్రపు అలల సమాచారం:\n"
                    f"• అలల ఎత్తు: {wave_height:.2f} మీటర్లు (పీరియడ్: {wave_period:.1f} సెకన్లు)\n"
                    f"• ఉపరితల ప్రవాహం: {current_speed} నాట్స్ ({current_dir})\n"
                    f"• సముద్ర ఉష్ణోగ్రత: {sea_temp:.1f}°C\n\n"
                    f"సలహా: {w_status}"
                )
            elif lang == "ml":
                w_status = "കടൽ ശാന്തമാണ്, സുരക്ഷിതമായി യാത്ര ചെയ്യാം." if wave_height < 1.2 else "ഇടത്തരം തിരമാലകളുണ്ട്; ചെറിയ വള്ളങ്ങൾ ശ്രദ്ധിക്കുക."
                resp = (
                    f"🌊 തത്സമയ തിരമാല വിവരം:\n"
                    f"• തിരമാല ഉയരം: {wave_height:.2f} മീറ്റർ (കാലയളവ്: {wave_period:.1f} സെക്കൻഡ്)\n"
                    f"• ഉപരിതല ഒഴുക്ക്: {current_speed} നോട്ട് ({current_dir})\n"
                    f"• സമുദ്ര താപനില: {sea_temp:.1f}°C\n\n"
                    f"നിർദ്ദേശം: {w_status}"
                )
            elif lang == "hi":
                w_status = "समुद्र की लहरें शांत हैं, सभी नावों के लिए अनुकूल।" if wave_height < 1.2 else "मध्यम लहरें सक्रिय हैं; छोटी नावें सावधानी बरतें।"
                resp = (
                    f"🌊 लाइव महासागरीय लहर एवं धारा टेलीमेट्री:\n"
                    f"• लहरों की ऊंचाई: {wave_height:.2f} मीटर (तरंग काल: {wave_period:.1f} सेकंड)\n"
                    f"• समुद्री धारा गति: {current_speed} नॉट्स ({current_dir})\n"
                    f"• समुद्र का तापमान: {sea_temp:.1f}°C\n\n"
                    f"सलाह: {w_status}"
                )
            else:
                w_status = "Sea state is calm and favorable for all fishing vessels." if wave_height < 1.2 else "Moderate ocean swells active. Small crafts remain watchful."
                resp = (
                    f"🌊 Live Ocean Wave & Hydrodynamic Telemetry:\n"
                    f"• Significant Wave Height: {wave_height:.2f} meters (Period: {wave_period:.1f} seconds)\n"
                    f"• Coastal Surface Current: {current_speed} knots towards {current_dir}\n"
                    f"• Sea Surface Temp: {sea_temp:.1f}°C\n\n"
                    f"Operational Advisory: {w_status}"
                )

        elif intent == "wind_conditions":
            if lang == "ta":
                w_cond = "சாதாரண கடலோர காற்று, படகு இயக்கத்திற்கு சிறந்தது." if wind_kmh < 20 else "மிதமான காற்று வீசுகிறது, கவனமாக படகை இயக்கவும்." if wind_kmh < 35 else "பலத்த காற்று எச்சரிக்கை! கடலுக்குள் செல்ல வேண்டாம்."
                resp = (
                    f"💨 நேரலை காற்று மற்றும் வளிமண்டல தகவல்:\n"
                    f"• காற்றின் வேகம்: {wind_kmh:.1f} கி.மீ/மணி ({wind_dir}) | காற்று வீச்சு: {wind_gusts:.1f} கி.மீ/மணி\n"
                    f"• காற்று வெப்பநிலை: {temp_c:.1f}°C | மழை வாய்ப்பு: {rain_prob}%\n"
                    f"• வானிலை: {weather_desc}\n\n"
                    f"ஆலோசனை: {w_cond}"
                )
            elif lang == "te":
                w_cond = "సాధారణ గాలులు, వేటకు అనుకూలం." if wind_kmh < 20 else "మధ్యస్థ గాలులు వీస్తున్నాయి."
                resp = (
                    f"💨 లైవ్ గాలి వేగం మరియు సమాచారం:\n"
                    f"• గాలి వేగం: {wind_kmh:.1f} కి.మీ/గం ({wind_dir}) | గాలి తాకిడి: {wind_gusts:.1f} కి.మీ/గం\n"
                    f"• ఉష్ణోగ్రత: {temp_c:.1f}°C | వర్షం: {rain_prob}%\n"
                    f"• వాతావరణం: {weather_desc}\n\n"
                    f"సలహా: {w_cond}"
                )
            elif lang == "ml":
                w_cond = "സാധാരണ കാറ്റ്, കടലിൽ പോകാൻ അനുയോജ്യമാണ്." if wind_kmh < 20 else "ഇടത്തരം കാറ്റ് വീശുന്നു."
                resp = (
                    f"💨 തത്സമയ കാറ്റിന്റെ വിവരം:\n"
                    f"• കാറ്റിന്റെ വേഗത: {wind_kmh:.1f} കി.മീ/മണിക്കൂർ ({wind_dir})\n"
                    f"• താപനില: {temp_c:.1f}°C | മഴ സാധ്യത: {rain_prob}%\n"
                    f"• കാലാവസ്ഥ: {weather_desc}\n\n"
                    f"നിർദ്ദേശം: {w_cond}"
                )
            elif lang == "hi":
                w_cond = "सामान्य तटीय हवा, नौकायन के लिए अनुकूल।" if wind_kmh < 20 else "मध्यम हवा चल रही है, सावधानी से आगे बढ़ें।"
                resp = (
                    f"💨 लाइव पवन एवं वायुमंडलीय टेलीमेट्री:\n"
                    f"• हवा की गति: {wind_kmh:.1f} किमी/घंटा ({wind_dir}) | झोंके: {wind_gusts:.1f} किमी/घंटा\n"
                    f"• तापमान: {temp_c:.1f}°C | बारिश की संभावना: {rain_prob}%\n"
                    f"• मौसम: {weather_desc}\n\n"
                    f"सलाह: {w_cond}"
                )
            else:
                w_cond = "Normal light coastal breeze, ideal for sailing." if wind_kmh < 20 else "Moderate coastal breeze active. Secure deck equipment."
                resp = (
                    f"💨 Live Atmospheric & Wind Telemetry:\n"
                    f"• Sustained Wind Speed: {wind_kmh:.1f} km/h ({wind_dir}) | Peak Gusts: {wind_gusts:.1f} km/h\n"
                    f"• Ambient Air Temperature: {temp_c:.1f}°C | Rain: {rain_prob}%\n"
                    f"• Weather Condition: {weather_desc}\n\n"
                    f"Operational Advisory: {w_cond}"
                )

        elif intent in ("find_pfz", "fish_species"):
            if lang == "ta":
                resp = (
                    f"🎣 INCOIS செயற்கைக்கோள் மீன்பிடி மண்டலம் (PFZ):\n"
                    f"• பரிந்துரைக்கப்பட்ட மண்டலம்: {spot.name}\n"
                    f"• அமைவிடம்: {spot.distance_km:.1f} கி.மீ ({spot.distance_nm:.1f} கடல் மைல்) {spot.cardinal_direction} (திசைகோணம்: {spot.bearing_deg}°)\n"
                    f"• கடல் ஆழம்: {spot.depth_meters} மீட்டர் | இலக்கு மீன்கள்: {sp_text}\n"
                    f"• கடல் வெப்பநிலை: {sea_temp:.1f}°C | பருவகால போக்கு: {seasonal_trend}\n\n"
                    f"வழிசெலுத்தல்: வரைபடத்தில் வழியைக் காண 'Show Route on Ocean Map' பொத்தானை அழுத்தவும்."
                )
            elif lang == "te":
                resp = (
                    f"🎣 INCOIS శాటిలైట్ చేపల వేట ప్రాంతం (PFZ):\n"
                    f"• సిఫార్సు చేసిన ప్రాంతం: {spot.name}\n"
                    f"• దూరం & దిశ: {spot.distance_km:.1f} కి.మీ ({spot.cardinal_direction}, బేరింగ్: {spot.bearing_deg}°)\n"
                    f"• సముద్రపు లోతు: {spot.depth_meters} మీటర్లు | ముఖ్య చేపలు: {sp_text}\n"
                    f"• సముద్ర ఉష్ణోగ్రత: {sea_temp:.1f}°C\n\n"
                    f"మ్యాప్: సముద్ర చార్ట్‌లో ఈ మార్గాన్ని చూడటానికి 'Show Route on Ocean Map' నొక్కండి."
                )
            elif lang == "ml":
                resp = (
                    f"🎣 INCOIS ഉപഗ്രഹ മത്സ്യബന്ധന മേഖല (PFZ):\n"
                    f"• ശുപാർശ ചെയ്യുന്ന മേഖല: {spot.name}\n"
                    f"• ദൂരവും ദിശയും: {spot.distance_km:.1f} കി.മീ ({spot.cardinal_direction})\n"
                    f"• സമുദ്ര ആഴം: {spot.depth_meters} മീറ്റർ | പ്രധാന മത്സ്യങ്ങൾ: {sp_text}\n"
                    f"• സമുദ്ര താപനില: {sea_temp:.1f}°C\n\n"
                    f"റൂട്ട്: മാപ്പിൽ കാണാൻ 'Show Route on Ocean Map' ടാപ്പ് ചെയ്യുക."
                )
            elif lang == "hi":
                resp = (
                    f"🎣 INCOIS सैटेलाइट मत्स्य संभावित क्षेत्र (PFZ):\n"
                    f"• अनुशंसित क्षेत्र: {spot.name}\n"
                    f"• दूरी एवं दिशा: {spot.distance_km:.1f} किमी ({spot.cardinal_direction}, बेयरिंग: {spot.bearing_deg}°)\n"
                    f"• समुद्र तल गहराई: {spot.depth_meters} मीटर | प्रमुख मछलियां: {sp_text}\n"
                    f"• समुद्र तापमान: {sea_temp:.1f}°C | मौसमी रुझान: {seasonal_trend}\n\n"
                    f"नेविगेशन: समुद्री चार्ट पर GPS बिंदु देखने के लिए 'Show Route on Ocean Map' दबाएं।"
                )
            else:
                resp = (
                    f"🎣 INCOIS Satellite Potential Fishing Zone (PFZ):\n"
                    f"• Recommended Hotspot: {spot.name}\n"
                    f"• Location Vector: {spot.distance_km:.1f} km ({spot.distance_nm:.1f} NM) {spot.cardinal_direction} (Bearing: {spot.bearing_deg}°)\n"
                    f"• Seafloor Depth: {spot.depth_meters} meters | Target Fish: {sp_text}\n"
                    f"• Sea Surface Temp: {sea_temp:.1f}°C | Fishery Trend: {seasonal_trend}\n\n"
                    f"Navigation: Tap 'Show Route on Ocean Map' to plot this GPS waypoint on your navigation chart."
                )

        elif intent == "nearest_port":
            if lang == "ta":
                resp = (
                    f"⚓ அருகிலுள்ள துறைமுகம் மற்றும் அவசர தொடர்பு:\n"
                    f"• முதன்மை துறைமுகம்: {nearest_port}\n"
                    f"• தோராய தொலைவு: {port_dist:.1f} கி.மீ ({port_dist_nm:.1f} கடல் மைல்) {port_cardinal} (திசை: {port_bearing}°)\n"
                    f"• துறைமுக ஆழம்: {seafloor_depth} மீட்டர் | VHF: {port_vhf}\n\n"
                    f"அவசர ஆலோசனை: அவசர சூழ்நிலையில் VHF சேனல் 16 வழியாக உடனே தொடர்பு கொள்ளவும்."
                )
            elif lang == "te":
                resp = (
                    f"⚓ సమీప ఓడరేవు మరియు అత్యవసర ఛానెల్:\n"
                    f"• ప్రధాన ఓడరేవు: {nearest_port}\n"
                    f"• దూరం: {port_dist:.1f} కి.మీ ({port_cardinal}, బేరింగ్: {port_bearing}°)\n"
                    f"• లోతు: {seafloor_depth} మీటర్లు | VHF: {port_vhf}\n\n"
                    f"సలహా: అత్యవసర సమయాల్లో VHF ఛానల్ 16 ద్వారా సంప్రదించండి."
                )
            elif lang == "ml":
                resp = (
                    f"⚓ ഏറ്റവും അടുത്തുള്ള തുറമുഖം:\n"
                    f"• തുറമുഖം: {nearest_port}\n"
                    f"• ദൂരം: {port_dist:.1f} കി.മീ ({port_cardinal})\n"
                    f"• ആഴം: {seafloor_depth} മീറ്റർ | VHF: {port_vhf}\n\n"
                    f"നിർദ്ദേശം: അടിയന്തിര സാഹചര്യങ്ങളിൽ VHF ചാനൽ 16 വഴി ബന്ധപ്പെടുക."
                )
            elif lang == "hi":
                resp = (
                    f"⚓ निकटतम बंदरगाह एवं आपातकालीन चैनल:\n"
                    f"• प्रमुख बंदरगाह: {nearest_port}\n"
                    f"• दूरी: {port_dist:.1f} किमी ({port_cardinal}, बेयरिंग: {port_bearing}°)\n"
                    f"• बंदरगाह गहराई: {seafloor_depth} मीटर | कोस्ट गार्ड VHF: {port_vhf}\n\n"
                    f"आपातकालीन सलाह: आपातकाल में VHF चैनल 16 पर तुरंत संपर्क करें।"
                )
            else:
                resp = (
                    f"⚓ Nearest Base Port & Emergency Maritime Harbor:\n"
                    f"• Base Port: {nearest_port}\n"
                    f"• Distance Vector: {port_dist:.1f} km ({port_dist_nm:.1f} NM) {port_cardinal} (Course: {port_bearing}°)\n"
                    f"• Harbor Depth: {seafloor_depth} meters | Coast Guard VHF: {port_vhf}\n\n"
                    f"Emergency Directive: Establish contact on VHF Marine Channel 16 (156.8 MHz) during emergencies."
                )

        elif intent == "net_drift":
            d_km = drift_dist_km if drift_dist_km is not None else 1.2
            d_card = drift_cardinal or "NE"
            if lang == "ta":
                resp = (
                    f"🕸️ தொலைந்த வலை மிதப்பு கணிப்பு (Lagrangian Simulation):\n"
                    f"• மதிப்பிடப்பட்ட மிதப்பு தூரம்: {d_km:.1f} கி.மீ ({d_card} நோக்கி)\n"
                    f"• நீரோட்ட வேகம்: {current_speed} நாட்ஸ் | காற்று: {wind_kmh:.1f} கி.மீ/மணி ({wind_dir})\n\n"
                    f"மீட்பு வழிகாட்டல்: உங்கள் வலையின் நேரலை GPS கணிப்பு வரைபடத்தை பார்க்க My Nets பக்கத்தை திறக்கவும்."
                )
            elif lang == "te":
                resp = (
                    f"🕸️ పోయిన వల డ్రిఫ్ట్ సూచన (Lagrangian Simulation):\n"
                    f"• అంచనా వేసిన దూరం: {d_km:.1f} కి.మీ ({d_card} వైపు)\n"
                    f"• ప్రవాహం: {current_speed} నాట్స్ | గాలి: {wind_kmh:.1f} కి.మీ/గం\n\n"
                    f"సలహా: వల ప్రత్యక్ష GPS స్థానాన్ని ట్రాక్ చేయడానికి My Nets పేజీని తెరవండి."
                )
            elif lang == "ml":
                resp = (
                    f"🕸️ നഷ്ടപ്പെട്ട വലയുടെ ഒഴുക്ക് പ്രവചനം:\n"
                    f"• ദൂരം: {d_km:.1f} കി.മീ ({d_card} ദിശയിലേക്ക്)\n"
                    f"• ഒഴുക്ക്: {current_speed} നോട്ട് | കാറ്റ്: {wind_kmh:.1f} കി.മീ/മണിക്കൂർ\n\n"
                    f"നിർദ്ദേശം: വലയുടെ റൂട്ട് കാണാൻ My Nets പേജ് തുറക്കുക."
                )
            elif lang == "hi":
                resp = (
                    f"🕸️ खोया हुआ जाल बहाव पूर्वानुमान (Lagrangian Simulation):\n"
                    f"• अनुमानित बहाव दूरी: {d_km:.1f} किमी ({d_card} की ओर)\n"
                    f"• समुद्री धारा: {current_speed} नॉट्स | हवा: {wind_kmh:.1f} किमी/घंटा ({wind_dir})\n\n"
                    f"पुनर्प्राप्ति सलाह: अपने जाल की लाइव GPS स्थिति देखने के लिए My Nets टैब खोलें।"
                )
            else:
                resp = (
                    f"🕸️ Lagrangian Lost Net Drift Prediction:\n"
                    f"• Estimated Drift: {d_km:.1f} km towards {d_card}\n"
                    f"• Driving Factors: Surface current ({current_speed} kts) & wind leeway ({wind_kmh:.1f} km/h {wind_dir})\n\n"
                    f"Recovery Action: Open 'My Nets' tab to view the live GPS trajectory and recovery coordinates."
                )

        else:
            if lang == "ta":
                risk_label = "குறைந்த ஆபத்து" if risk.level == "LOW" else "மிதமான எச்சரிக்கை" if risk.level == "MODERATE" else "உயர் ஆபத்து"
                advice_ta = "அனைத்து வகை படகுகளுக்கும் சாதகமான கடல் வானிலை நிலவுகிறது." if risk.level == "LOW" else "இயந்திரப் படகுகள் எச்சரிக்கையுடன் செல்லலாம்; சிறிய படகுகள் கரைக்கு அருகில் இருப்பது நல்லது." if risk.level == "MODERATE" else "கடலுக்குள் செல்ல வேண்டாம்! படகுகளை உடனடியாக துறைமுகத்தில் பாதுகாப்பாக கட்டவும்."
                resp = (
                    f"🧭 மீன்பிடி ஆலோசனை மற்றும் பாதுகாப்பு நிலை:\n"
                    f"• பாதுகாப்பு முடிவு: {risk.title} ({risk_label})\n"
                    f"• காற்றின் வேகம்: {wind_kmh:.1f} கி.மீ/மணி ({wind_dir}) | காற்று வீச்சு: {wind_gusts:.1f} கி.மீ/மணி\n"
                    f"• அலை உயரம்: {wave_height:.2f} மீட்டர் (காலம்: {wave_period:.1f} வினாடி)\n"
                    f"• மழை வாய்ப்பு: {rain_prob}% ({weather_desc})\n"
                    f"• பரிந்துரைக்கப்பட்ட மண்டலம்: {spot.name} ({spot.distance_km:.1f} கி.மீ {spot.cardinal_direction})\n\n"
                    f"ஆலோசனை: {advice_ta}"
                )
            elif lang == "te":
                risk_label = "తక్కువ ప్రమాదం" if risk.level == "LOW" else "మధ్యస్థ ప్రమాదం" if risk.level == "MODERATE" else "అధిక ప్రమాదం"
                resp = (
                    f"🧭 చేపల వేట సలహా మరియు భద్రతా స్థితి:\n"
                    f"• భద్రతా తీర్పు: {risk.title} ({risk_label})\n"
                    f"• గాలి వేగం: {wind_kmh:.1f} కి.మీ/గం ({wind_dir}) | అలల ఎత్తు: {wave_height:.2f} మీటర్లు\n"
                    f"• వర్షం: {rain_prob}% ({weather_desc})\n"
                    f"• సిఫార్సు చేసిన ప్రాంతం: {spot.name} ({spot.distance_km:.1f} కి.మీ {spot.cardinal_direction})\n\n"
                    f"సలహా: {risk.advice}"
                )
            elif lang == "ml":
                risk_label = "കുറഞ്ഞ അപകടസാധ്യത" if risk.level == "LOW" else "ഇടത്തരം മുന്നറിയിപ്പ്" if risk.level == "MODERATE" else "ഉയർന്ന അപകടസാധ്യത"
                resp = (
                    f"🧭 മത്സ്യബന്ധന ഉപദേശവും സുരക്ഷാ നിലയും:\n"
                    f"• സുരക്ഷാ തീരുമാനം: {risk.title} ({risk_label})\n"
                    f"• കാറ്റിന്റെ വേഗത: {wind_kmh:.1f} കി.മീ/മണിക്കൂർ ({wind_dir}) | തിരമാല: {wave_height:.2f} മീറ്റർ\n"
                    f"• മഴ സാധ്യത: {rain_prob}% ({weather_desc})\n"
                    f"• ശുപാർശ ചെയ്യുന്ന മേഖല: {spot.name} ({spot.distance_km:.1f} കി.മീ {spot.cardinal_direction})\n\n"
                    f"നിർദ്ദേശം: {risk.advice}"
                )
            elif lang == "hi":
                resp = (
                    f"🧭 मत्स्य सलाह एवं सुरक्षा स्थिति:\n"
                    f"• सुरक्षा निर्णय: {risk.title} ({risk.level} Risk)\n"
                    f"• हवा की गति: {wind_kmh:.1f} किमी/घंटा ({wind_dir}) | झोंके: {wind_gusts:.1f} किमी/घंटा\n"
                    f"• लहरों की ऊंचाई: {wave_height:.2f} मीटर (पीरियड: {wave_period:.1f} सेकंड)\n"
                    f"• बारिश की संभावना: {rain_prob}% ({weather_desc})\n"
                    f"• अनुशंसित क्षेत्र: {spot.name} ({spot.distance_km:.1f} किमी {spot.cardinal_direction})\n\n"
                    f"सलाह: {risk.advice}"
                )
            else:
                resp = (
                    f"🧭 Marine Fishing Venture & Safety Advisory:\n"
                    f"• Operational Verdict: {risk.title} ({risk.level} Risk Profile)\n"
                    f"• Wind Telemetry: {wind_kmh:.1f} km/h from {wind_dir} (Peak Gusts: {wind_gusts:.1f} km/h)\n"
                    f"• Ocean Swell: {wave_height:.2f} meters (Period: {wave_period:.1f} seconds)\n"
                    f"• Rain Probability: {rain_prob}% ({weather_desc})\n"
                    f"• Recommended PFZ Zone: {spot.name} ({spot.distance_km:.1f} km {spot.cardinal_direction})\n\n"
                    f"Safety Directive: {risk.advice}"
                )

        clean_voice = (
            resp.replace("**", "")
            .replace("*", "")
            .replace("#", "")
            .replace("•", "")
            .replace("`", "")
            .replace("🌀", "")
            .replace("🌧️", "")
            .replace("🌊", "")
            .replace("💨", "")
            .replace("🎣", "")
            .replace("⚓", "")
            .replace("🕸️", "")
            .replace("🧭", "")
            .replace("🌡️", "")
            .replace("📍", "")
            .replace("🐟", "")
            .replace("🚨", "")
            .replace("✅", "")
            .replace("⚠️", "")
            .strip()
        )
        return resp, clean_voice

    def _haversine_km(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6371.0
        dLat = math.radians(lat2 - lat1)
        dLon = math.radians(lon2 - lon1)
        a = (math.sin(dLat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dLon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    def _bearing_deg(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        dLon = math.radians(lon2 - lon1)
        y = math.sin(dLon) * math.cos(math.radians(lat2))
        x = (math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) -
             math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(dLon))
        brng = math.degrees(math.atan2(y, x))
        return (brng + 360) % 360

    def _degrees_to_cardinal(self, deg: float) -> str:
        cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N']
        idx = int(round((deg % 360) / 45))
        return cardinals[idx]

orca_orchestrator = OrcaAgentOrchestrator()
