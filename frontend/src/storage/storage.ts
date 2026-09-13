import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { SupportedLanguage, FishermanUser } from '../types';

const LANGUAGE_KEY = '@samudra_kural_language';
const HAS_LAUNCHED_KEY = '@samudra_kural_has_launched';
const TOKEN_KEY = 'samudra_kural_access_token';
const USER_KEY = 'samudra_kural_user_data';

// --- Language Storage (AsyncStorage) ---
export const saveLanguagePreference = async (lang: SupportedLanguage): Promise<void> => {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  } catch (error) {
    console.error('Error saving language preference:', error);
  }
};

export const getLanguagePreference = async (): Promise<SupportedLanguage | null> => {
  try {
    const lang = await AsyncStorage.getItem(LANGUAGE_KEY);
    return (lang as SupportedLanguage) || null;
  } catch (error) {
    console.error('Error reading language preference:', error);
    return null;
  }
};

export const setHasLaunched = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(HAS_LAUNCHED_KEY, 'true');
  } catch (error) {
    console.error('Error setting launch flag:', error);
  }
};

export const getHasLaunched = async (): Promise<boolean> => {
  try {
    const val = await AsyncStorage.getItem(HAS_LAUNCHED_KEY);
    return val === 'true';
  } catch (error) {
    return false;
  }
};

// --- Secure Authentication Token & Session Storage (Expo SecureStore) ---
export const saveAuthToken = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (error) {
    console.error('Error saving auth token to SecureStore:', error);
  }
};

export const getAuthToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (error) {
    console.error('Error retrieving auth token:', error);
    return null;
  }
};

export const deleteAuthToken = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (error) {
    console.error('Error deleting auth token:', error);
  }
};

const ASYNC_USER_KEY = '@samudra_kural_user_session';

export const saveUserSession = async (user: FishermanUser): Promise<void> => {
  try {
    const json = JSON.stringify(user);
    await AsyncStorage.setItem(ASYNC_USER_KEY, json);
    try {
      await SecureStore.setItemAsync(USER_KEY, json);
    } catch (e) {}
  } catch (error) {
    console.error('Error saving user session:', error);
  }
};

export const getUserSession = async (): Promise<FishermanUser | null> => {
  try {
    const asyncJson = await AsyncStorage.getItem(ASYNC_USER_KEY);
    if (asyncJson) {
      return JSON.parse(asyncJson);
    }
    const secureJson = await SecureStore.getItemAsync(USER_KEY);
    if (secureJson) {
      return JSON.parse(secureJson);
    }
  } catch (error) {
    console.error('Error reading user session:', error);
  }
  return null;
};

export const clearSession = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(ASYNC_USER_KEY);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch (error) {
    console.error('Error clearing session:', error);
  }
};
