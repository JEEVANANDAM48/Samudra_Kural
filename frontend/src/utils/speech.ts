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

export async function speakNativeText(
  text: string,
  languageCode: string = 'ta',
  onStart?: () => void,
  onDone?: () => void
): Promise<void> {
  const targetVoice = LANGUAGE_VOICE_MAP[languageCode] || 'en-IN';

  // Stop any current speaking instance
  await stopNativeSpeech();

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
