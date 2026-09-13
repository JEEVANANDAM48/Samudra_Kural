import logging
import httpx
import base64
from typing import Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"
SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"
SARVAM_LLM_URL = "https://api.sarvam.ai/v1/chat/completions"

SARVAM_LANG_MAP: Dict[str, str] = {
    "ta": "ta-IN",
    "te": "te-IN",
    "ml": "ml-IN",
    "hi": "hi-IN",
    "en": "en-IN",
}

SARVAM_SPEAKER_MAP: Dict[str, str] = {
    "ta": "kavya",
    "te": "kavya",
    "ml": "kavya",
    "hi": "kavya",
    "en": "kavya",
}

class SarvamAIService:
    """
    Sarvam AI Regional Language Voice & LLM Integration.
    Provides Speech-to-Text (saarika:v2), Text-to-Speech (bulbul:v3), and LLM text synthesis.
    """

    def __init__(self):
        self.api_key = settings.SARVAM_API_KEY
        if self.api_key:
            logger.info("Sarvam AI Service initialized with valid API key.")
        else:
            logger.warning("SARVAM_API_KEY is missing in settings.")

    async def speech_to_text(
        self,
        file_bytes: bytes,
        filename: str = "audio.wav",
        language_code: str = "ta"
    ) -> Dict[str, Any]:
        """
        Transcribe audio voice recording to text using Sarvam AI Saarika API.
        """
        if not self.api_key:
            return {"status": "error", "message": "Sarvam API key not configured", "transcript": ""}

        headers = {"api-subscription-key": self.api_key}
        target_lang = SARVAM_LANG_MAP.get(language_code, "ta-IN")

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                files = {"file": (filename, file_bytes, "audio/wav")}
                data = {
                    "language_code": target_lang,
                    "model": "saarika:v2",
                    "with_timestamps": "false"
                }
                res = await client.post(SARVAM_STT_URL, headers=headers, data=data, files=files)
                if res.status_code == 200:
                    result = res.json()
                    transcript = result.get("transcript", "")
                    logger.info(f"Sarvam STT success ({target_lang}): '{transcript}'")
                    return {"status": "success", "transcript": transcript, "raw": result}
                else:
                    logger.error(f"Sarvam STT failed HTTP {res.status_code}: {res.text}")
                    return {"status": "error", "message": res.text, "transcript": ""}
        except Exception as e:
            logger.error(f"Error calling Sarvam STT API: {e}")
            return {"status": "error", "message": str(e), "transcript": ""}

    async def text_to_speech(
        self,
        text: str,
        language_code: str = "ta",
        speaker: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Synthesize natural regional voice audio (.wav/.mp3) from text using Sarvam AI Bulbul API.
        """
        if not self.api_key:
            return {"status": "error", "message": "Sarvam API key not configured"}

        headers = {
            "api-subscription-key": self.api_key,
            "Content-Type": "application/json"
        }
        target_lang = SARVAM_LANG_MAP.get(language_code, "ta-IN")
        target_speaker = speaker or SARVAM_SPEAKER_MAP.get(language_code, "kavya")

        payload = {
            "target_language_code": target_lang,
            "text": text[:500],  # Keep prompt concise for low latency
            "speaker": target_speaker,
            "pitch": 0,
            "pace": 1.0,
            "loudness": 1.5,
            "speech_sample_rate": 22050,
            "enable_preprocessing": True,
            "model": "bulbul:v3"
        }

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.post(SARVAM_TTS_URL, headers=headers, json=payload)
                if res.status_code == 200:
                    result = res.json()
                    audios = result.get("audios", [])
                    audio_b64 = audios[0] if audios else ""
                    logger.info(f"Sarvam TTS success ({target_lang}). Audio generated: {len(audio_b64)} chars")
                    return {
                        "status": "success",
                        "audio_base64": audio_b64,
                        "language": target_lang
                    }
                else:
                    logger.error(f"Sarvam TTS failed HTTP {res.status_code}: {res.text}")
                    return {"status": "error", "message": res.text}
        except Exception as e:
            logger.error(f"Error calling Sarvam TTS API: {e}")
            return {"status": "error", "message": str(e)}

    async def generate_regional_marine_summary(
        self,
        prompt: str,
        language_code: str = "ta"
    ) -> Optional[str]:
        """
        Use Sarvam-2B LLM model to generate authentic regional marine advisory.
        """
        if not self.api_key:
            return None

        headers = {
            "api-subscription-key": self.api_key,
            "Content-Type": "application/json"
        }

        payload = {
            "model": "sarvam-2b",
            "messages": [
                {
                    "role": "system",
                    "content": "You are Samudra Kural ORCA AI, an expert marine advisory system for Indian fishermen. Respond concisely and clearly in the target language with practical safety and fishing advice."
                },
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 300,
            "temperature": 0.3
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(SARVAM_LLM_URL, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    choices = data.get("choices", [])
                    if choices and "message" in choices[0]:
                        content = choices[0]["message"].get("content", "")
                        return content.strip()
        except Exception as e:
            logger.warning(f"Sarvam-2B LLM call bypassed: {e}")
        return None

sarvam_service = SarvamAIService()
