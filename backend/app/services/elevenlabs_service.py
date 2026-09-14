import base64
import logging
from typing import Dict, Any, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

class ElevenLabsService:
    """
    ElevenLabs Voice Service (Multilingual v2 Text-to-Speech and Speech-to-Text).
    Provides natural pauses and high quality multilingual playback for Indian coastal languages.
    """

    def __init__(self):
        self.api_url = "https://api.elevenlabs.io/v1"

    @property
    def api_key(self) -> str:
        return (getattr(settings, "ELEVENLABS_API_KEY", None) or "").strip()

    @property
    def voice_id(self) -> str:
        return (getattr(settings, "ELEVENLABS_VOICE_ID", None) or "21m00Tcm4TlvDq8ikWAM").strip()

    def is_available(self) -> bool:
        return bool(self.api_key)

    async def text_to_speech(
        self,
        text: str,
        language_code: str = "ta",
        voice_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Synthesizes speech using ElevenLabs Multilingual v2.
        Returns base64 encoded MP3 audio bytes.
        """
        if not self.is_available():
            return {
                "status": "error",
                "message": "ElevenLabs API key is not configured.",
                "audio_base64": None
            }

        target_voice = voice_id or self.voice_id
        url = f"{self.api_url}/text-to-speech/{target_voice}"

        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
        }

        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.55,
                "similarity_boost": 0.80,
                "style": 0.15,
                "use_speaker_boost": True
            }
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code == 200:
                    audio_b64 = base64.b64encode(resp.content).decode("utf-8")
                    return {
                        "status": "success",
                        "audio_base64": audio_b64,
                        "format": "mp3",
                        "language": language_code
                    }
                else:
                    logger.warning(f"ElevenLabs TTS failed with HTTP {resp.status_code}: {resp.text}")
                    return {
                        "status": "error",
                        "message": f"ElevenLabs TTS error ({resp.status_code}): {resp.text}",
                        "audio_base64": None
                    }
        except Exception as e:
            logger.warning(f"ElevenLabs TTS request exception: {e}")
            return {
                "status": "error",
                "message": str(e),
                "audio_base64": None
            }

    async def speech_to_text(
        self,
        audio_bytes: bytes,
        filename: str = "audio.m4a",
        language_code: str = "unknown"
    ) -> Dict[str, Any]:
        """
        Transcribes speech using ElevenLabs Scribe or OpenAI Whisper if configured.
        """
        if not self.is_available():
            # Check OpenAI as fallback
            openai_key = (getattr(settings, "OPENAI_API_KEY", None) or "").strip()
            if openai_key:
                return await self._whisper_stt(audio_bytes, filename, openai_key, language_code)
            return {
                "status": "error",
                "message": "Neither ElevenLabs nor OpenAI API key is configured.",
                "transcript": ""
            }

        url = f"{self.api_url}/speech-to-text"
        headers = {"xi-api-key": self.api_key}
        data = {"model_id": "scribe_v1"}
        if language_code and language_code != "unknown":
            data["language_code"] = language_code

        files = {"file": (filename, audio_bytes, "audio/m4a")}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, headers=headers, data=data, files=files)
                if resp.status_code == 200:
                    res_json = resp.json()
                    transcript = res_json.get("text", "").strip()
                    return {
                        "status": "success",
                        "transcript": transcript,
                        "language": language_code
                    }
                else:
                    logger.warning(f"ElevenLabs STT error ({resp.status_code}): {resp.text}")
                    # Try OpenAI Whisper fallback
                    openai_key = (getattr(settings, "OPENAI_API_KEY", None) or "").strip()
                    if openai_key:
                        return await self._whisper_stt(audio_bytes, filename, openai_key, language_code)
                    return {
                        "status": "error",
                        "message": f"ElevenLabs STT error ({resp.status_code})",
                        "transcript": ""
                    }
        except Exception as e:
            logger.warning(f"ElevenLabs STT exception: {e}")
            openai_key = (getattr(settings, "OPENAI_API_KEY", None) or "").strip()
            if openai_key:
                return await self._whisper_stt(audio_bytes, filename, openai_key, language_code)
            return {"status": "error", "message": str(e), "transcript": ""}

    async def _whisper_stt(
        self,
        audio_bytes: bytes,
        filename: str,
        openai_key: str,
        language_code: str
    ) -> Dict[str, Any]:
        try:
            url = "https://api.openai.com/v1/audio/transcriptions"
            headers = {"Authorization": f"Bearer {openai_key}"}
            data = {"model": "whisper-1"}
            if language_code and language_code != "unknown":
                data["language"] = language_code
            files = {"file": (filename, audio_bytes, "audio/m4a")}
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, headers=headers, data=data, files=files)
                if resp.status_code == 200:
                    res_json = resp.json()
                    return {
                        "status": "success",
                        "transcript": res_json.get("text", "").strip(),
                        "language": language_code
                    }
        except Exception as e:
            logger.warning(f"OpenAI Whisper fallback exception: {e}")
        return {"status": "error", "message": "STT recognition unavailable", "transcript": ""}

elevenlabs_service = ElevenLabsService()
