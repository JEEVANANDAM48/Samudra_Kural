import { SupportedLanguage, LanguageOption } from '../types';
import { en, TranslationKeys } from './locales/en';
import { ta } from './locales/ta';
import { te } from './locales/te';
import { ml } from './locales/ml';
import { kn } from './locales/kn';
import { mr } from './locales/mr';
import { gu } from './locales/gu';
import { or } from './locales/or';
import { bn } from './locales/bn';
import { hi } from './locales/hi';

export const supportedLanguages: LanguageOption[] = [
  { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil' },
  { code: 'te', nativeName: 'తెలుగు', englishName: 'Telugu' },
  { code: 'ml', nativeName: 'മലയാളം', englishName: 'Malayalam' },
  { code: 'kn', nativeName: 'ಕನ್ನಡ', englishName: 'Kannada' },
  { code: 'mr', nativeName: 'मराठी', englishName: 'Marathi' },
  { code: 'gu', nativeName: 'ગુજરાતી', englishName: 'Gujarati' },
  { code: 'or', nativeName: 'ଓଡ଼ିଆ', englishName: 'Odia' },
  { code: 'bn', nativeName: 'বাংলা', englishName: 'Bengali' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi' },
  { code: 'en', nativeName: 'English', englishName: 'English' },
];

const dictionaries: Record<SupportedLanguage, Partial<Record<TranslationKeys, string>>> = {
  en,
  ta,
  te,
  ml,
  kn,
  mr,
  gu,
  or,
  bn,
  hi,
};

/**
 * Safe translation function with guaranteed fallback to English string
 * and key string as last resort so the UI will NEVER crash.
 */
export function t(key: TranslationKeys, langCode: SupportedLanguage = 'en'): string {
  const dict = dictionaries[langCode] || dictionaries.en;
  if (dict && dict[key]) {
    return dict[key]!;
  }
  // Fallback to English dictionary
  if (dictionaries.en && dictionaries.en[key]) {
    return dictionaries.en[key]!;
  }
  // Fallback to key string
  return key;
}

export type { TranslationKeys };
