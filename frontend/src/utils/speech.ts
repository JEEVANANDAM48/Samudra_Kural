import { Platform } from 'react-native';

let ExpoSpeech: any = null;
try {
  ExpoSpeech = require('expo-speech');
} catch (e) {
  ExpoSpeech = null;
}

const LANGUAGE_VOICE_MAP: Record<string, string> = {
  ta: 'ta-IN',
  te: 'te-IN',
  ml: 'ml-IN',
  hi: 'hi-IN',
  en: 'en-IN',
};

let activeAudioElement: any = null;

export function playBase64Audio(
  base64Audio: string,
  onStart?: () => void,
  onDone?: () => void
): boolean {
  try {
    if (activeAudioElement) {
      activeAudioElement.pause();
      activeAudioElement = null;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const audioUrl = `data:audio/wav;base64,${base64Audio}`;
      const audio = new Audio(audioUrl);
      activeAudioElement = audio;
      if (onStart) onStart();
      audio.onended = () => { if (onDone) onDone(); };
      audio.onerror = () => { if (onDone) onDone(); };
      audio.play().catch(() => { if (onDone) onDone(); });
      return true;
    }
  } catch (err) {
    console.warn('Base64 audio playback failed:', err);
  }
  return false;
}

export async function speakNativeText(
  text: string,
  languageCode: string = 'ta',
  onStart?: () => void,
  onDone?: () => void,
  base64Audio?: string
): Promise<void> {
  const targetVoice = LANGUAGE_VOICE_MAP[languageCode] || 'en-IN';

  // Stop any current speaking instance
  await stopNativeSpeech();

  // Try playing Sarvam AI synthesized high-fidelity base64 audio if present!
  if (base64Audio) {
    const played = playBase64Audio(base64Audio, onStart, onDone);
    if (played) return;
  }

  if (onStart) onStart();

  if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = targetVoice;
      utterance.rate = 0.95;
      utterance.onend = () => { if (onDone) onDone(); };
      utterance.onerror = () => { if (onDone) onDone(); };
      window.speechSynthesis.speak(utterance);
      return;
    } catch (err) {
      console.warn('Web SpeechSynthesis error:', err);
    }
  }

  if (ExpoSpeech && ExpoSpeech.speak) {
    try {
      ExpoSpeech.speak(text, {
        language: targetVoice,
        pitch: 1.0,
        rate: 0.9,
        onDone: () => { if (onDone) onDone(); },
        onError: () => { if (onDone) onDone(); },
      });
      return;
    } catch (err) {
      console.warn('ExpoSpeech speak error:', err);
    }
  }

  // Fallback timeout simulation if speech engine is unavailable on device
  setTimeout(() => {
    if (onDone) onDone();
  }, 4000);
}

export async function stopNativeSpeech(): Promise<void> {
  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement = null;
    } catch (err) {}
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (err) {}
  }

  if (ExpoSpeech && ExpoSpeech.stop) {
    try {
      await ExpoSpeech.stop();
    } catch (err) {}
  }
}

export function startSpeechToText(
  languageCode: string = 'ta',
  onResult: (transcript: string) => void,
  onError: (err: any) => void
): () => void {
  const targetVoice = LANGUAGE_VOICE_MAP[languageCode] || 'en-IN';

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = targetVoice;

      recognition.onresult = (event: any) => {
        if (event.results && event.results[0] && event.results[0][0]) {
          const text = event.results[0][0].transcript;
          onResult(text);
        }
      };

      recognition.onerror = (event: any) => {
        onError(event.error);
      };

      try {
        recognition.start();
      } catch (e) {
        onError(e);
      }

      return () => {
        try {
          recognition.stop();
        } catch (e) {}
      };
    }
  }

  onError('Speech recognition API not supported on this platform');
  return () => {};
}
