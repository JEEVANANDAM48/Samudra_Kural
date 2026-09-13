import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel

from app.services.orca_agent_orchestrator import orca_orchestrator, OrcaChatResponse
from app.services.sarvam_service import sarvam_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bot", tags=["ask-bot"])

class BotQueryRequest(BaseModel):
    query: str
    latitude: Optional[float] = 13.0827
    longitude: Optional[float] = 80.3800
    vessel_type: Optional[str] = "Trawler"
    language: Optional[str] = "ta"

class VoiceTTSRequest(BaseModel):
    text: str
    language: Optional[str] = "ta"

@router.post("/chat", response_model=OrcaChatResponse)
async def ask_bot_chat(payload: BotQueryRequest):
    """
    ORCA 12-Agent Chat & Voice Query Endpoint.
    Integrates 12 AI specialized marine agents with real-time satellite, weather, and ocean data.
    """
    if not payload.query or not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    
    try:
        response = await orca_orchestrator.process_query(
            query=payload.query.strip(),
            lat=payload.latitude or 13.0827,
            lon=payload.longitude or 80.3800,
            vessel_type=payload.vessel_type or "Trawler",
            language=payload.language or "ta"
        )
        return response
    except Exception as e:
        logger.error(f"Error processing ORCA bot query: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process AI marine request: {str(e)}")

@router.post("/voice-stt")
async def voice_speech_to_text(
    file: UploadFile = File(...),
    language: str = Form("ta")
):
    """
    Sarvam AI Voice Speech-to-Text Endpoint (saarika:v2).
    Converts audio voice recordings into transcribed text for Indian regional languages.
    """
    try:
        content = await file.read()
        res = await sarvam_service.speech_to_text(content, filename=file.filename or "audio.wav", language_code=language)
        if res.get("status") == "success":
            return {"status": "success", "transcript": res.get("transcript", "")}
        else:
            return {"status": "error", "message": res.get("message", "Speech recognition failed"), "transcript": ""}
    except Exception as e:
        logger.error(f"Error in Sarvam STT route: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/voice-tts")
async def voice_text_to_speech(payload: VoiceTTSRequest):
    """
    Sarvam AI Text-to-Speech Endpoint (bulbul:v1).
    Converts marine advisory text into natural regional audio base64.
    """
    if not payload.text or not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    try:
        res = await sarvam_service.text_to_speech(payload.text.strip(), language_code=payload.language or "ta")
        return res
    except Exception as e:
        logger.error(f"Error in Sarvam TTS route: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/quick-prompts")
def get_quick_prompts(language: str = Query("ta")):
    """Get localized quick action questions for fishermen"""
    prompts = {
        "ta": [
            "சென்னை கடலில் நாளை நான் மீன்பிடிக்க போகலாமா?",
            "அருகில் உள்ள சிறந்த கானாங்களுத்தி மீன்பிடி மண்டலம் எங்கே?",
            "காற்றின் வேகம் மற்றும் அலை உயரம் எவ்வளவு?",
            "எனது தொலைந்த வலை எங்கே மிதந்து கொண்டிருக்கும்?",
            "புயல் அல்லது ஆபத்து எச்சரிக்கை உள்ளதா?"
        ],
        "te": [
            "నేను రేపు చెన్నై నుండి చేపల వేటకు వెళ్ళవచ్చా?",
            "సమీపంలో ఉన్న ఉత్తమ చేపల వేట ప్రాంతం ఎక్కడ ఉంది?",
            "గాలి వేగం మరియు అలల ఎత్తు ఎంత?",
            "నా పోయిన వల ఎక్కడ కొట్టుకుపోతోంది?",
            "తుఫాను లేదా ప్రమాద హెచ్చరిక ఉందా?"
        ],
        "ml": [
            "എനിക്ക് നാളെ ചെന്നൈയിൽ നിന്ന് മീൻപിടിക്കാൻ പോകാൻ സാധിക്കുമോ?",
            "അടുത്തുള്ള മികച്ച മത്സ്യബന്ധന മേഖല എവിടെയാണ്?",
            "കാറ്റിന്റെ വേഗതയും തിരമാല ഉയരവും എത്രയാണ്?",
            "എന്റെ കാണാതായ വല എവിടെ ഒഴുകുന്നു?",
            "കൊടുങ്കാറ്റ് അല്ലെങ്കിൽ സുരക്ഷാ മുന്നറിയിപ്പ് ഉണ്ടോ?"
        ],
        "hi": [
            "क्या मैं कल चेन्नई से मछली पकड़ने जा सकता हूँ?",
            "निकटतम सर्वोत्तम मत्स्य क्षेत्र कहाँ है?",
            "हवा की गति और लहरों की ऊँचाई कितनी है?",
            "मेरा खोया हुआ जाल कहाँ बह रहा है?",
            "क्या कोई तूफान या सुरक्षा चेतावनी है?"
        ],
        "en": [
            "Can I go fishing tomorrow from Chennai, and where should I go?",
            "Where is the nearest best Mackerel potential fishing zone?",
            "What is the live wind speed and wave height?",
            "Where is my lost net drifting from 13.08N, 80.38E?",
            "Is there any cyclone or high wave alert active?"
        ]
    }
    return {"language": language, "prompts": prompts.get(language, prompts["en"])}
