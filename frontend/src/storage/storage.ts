import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupportedLanguage, FishermanUser } from '../types';

let SecureStore: any = null;
try {
  SecureStore = require('expo-secure-store');
} catch (e) {
  SecureStore = null;
}

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
    if (SecureStore && typeof SecureStore.setItemAsync === 'function') {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Error saving auth token:', error);
  }
};

export const getAuthToken = async (): Promise<string | null> => {
  try {
    if (SecureStore && typeof SecureStore.getItemAsync === 'function') {
      const secToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (secToken) return secToken;
    }
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error retrieving auth token:', error);
    return null;
  }
};

export const deleteAuthToken = async (): Promise<void> => {
  try {
    if (SecureStore && typeof SecureStore.deleteItemAsync === 'function') {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error deleting auth token:', error);
  }
};

const ASYNC_USER_KEY = '@samudra_kural_user_session';

export const saveUserSession = async (user: FishermanUser): Promise<void> => {
  try {
    const json = JSON.stringify(user);
    await AsyncStorage.setItem(ASYNC_USER_KEY, json);
    if (SecureStore && typeof SecureStore.setItemAsync === 'function') {
      try {
        await SecureStore.setItemAsync(USER_KEY, json);
      } catch (e) {}
    }
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
    if (SecureStore && typeof SecureStore.getItemAsync === 'function') {
      const secureJson = await SecureStore.getItemAsync(USER_KEY);
      if (secureJson) {
        return JSON.parse(secureJson);
      }
    }
  } catch (error) {
    console.error('Error reading user session:', error);
  }
  return null;
};

export const clearSession = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(ASYNC_USER_KEY);
    await AsyncStorage.removeItem(ASYNC_CG_OFFICER_KEY);
    await AsyncStorage.removeItem(TOKEN_KEY);
    if (SecureStore && typeof SecureStore.deleteItemAsync === 'function') {
      try {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(USER_KEY);
      } catch (e) {}
    }
  } catch (error) {
    console.error('Error clearing session:', error);
  }
};

// --- Coastal Guard Officer Session & Account Storage ---
export interface CGOfficerUser {
  officerId: string;
  rank: string;
  station: string;
  badgeNo?: string;
  clearanceLevel?: string;
}

const ASYNC_CG_OFFICER_KEY = '@samudra_kural_cg_officer_session';
const SECURE_CG_OFFICER_KEY = 'samudra_kural_cg_officer_data';
const ASYNC_CG_ACCOUNTS_KEY = '@samudra_kural_cg_registered_accounts';

export const saveCGOfficerSession = async (officer: any): Promise<void> => {
  try {
    const json = JSON.stringify(officer);
    await AsyncStorage.setItem(ASYNC_CG_OFFICER_KEY, json);
    if (SecureStore && typeof SecureStore.setItemAsync === 'function') {
      try {
        await SecureStore.setItemAsync(SECURE_CG_OFFICER_KEY, json);
      } catch (e) {}
    }
  } catch (error) {
    console.error('Error saving CG officer session:', error);
  }
};

export const getCGOfficerSession = async (): Promise<any | null> => {
  try {
    const asyncJson = await AsyncStorage.getItem(ASYNC_CG_OFFICER_KEY);
    if (asyncJson) {
      return JSON.parse(asyncJson);
    }
    if (SecureStore && typeof SecureStore.getItemAsync === 'function') {
      const secureJson = await SecureStore.getItemAsync(SECURE_CG_OFFICER_KEY);
      if (secureJson) {
        return JSON.parse(secureJson);
      }
    }
  } catch (error) {}
  return null;
};

export const clearCGOfficerSession = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(ASYNC_CG_OFFICER_KEY);
    if (SecureStore && typeof SecureStore.deleteItemAsync === 'function') {
      try {
        await SecureStore.deleteItemAsync(SECURE_CG_OFFICER_KEY);
      } catch (e) {}
    }
  } catch (error) {}
};


const ASYNC_FISHERMAN_ACCOUNTS_KEY = '@samudra_kural_fisherman_registered_accounts';

const DEFAULT_FISHERMAN_ACCOUNTS: (FishermanUser & { pin: string })[] = [
  {
    name: 'Ramanan K. (Fisherman)',
    phone: '9876543210',
    pin: '123456',
    address: 'No. 42, Harbour Main Road, Kasimedu',
    pincode: '600013',
    emergencyPhone: '+91 94440 99999',
    vesselName: 'Sea King IX',
    vesselRegistration: 'TN-01-MM-8492',
    vesselType: 'Mechanized Motorized Trawler',
    homePort: 'Kasimedu Harbour, Chennai',
    licenseNumber: 'IND-TN-2024-94021',
    aadhaarNumber: 'XXXX-XXXX-8492',
  },
];

const DEFAULT_CG_ACCOUNTS: any[] = [
  {
    id: 'CG-OFFICER-DEMO-01',
    name: 'Cmdr. V. Raman',
    serviceId: 'CG-9402',
    rank: 'Commandant (ICG)',
    station: 'Kasimedu Coast Guard Station, Chennai',
    phone: '9444099999',
    email: 'officer.raman@indiancoastguard.gov.in',
    jurisdiction: 'Tamil Nadu Coastal Zone - District 13',
    pin: '123456',
    badgeNumber: 'CG-9402',
  },
];

export const saveFishermanRegisteredAccounts = async (accounts: any[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(ASYNC_FISHERMAN_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (error) {
    console.error('Error saving fisherman registered accounts:', error);
  }
};

export const getFishermanRegisteredAccounts = async (): Promise<any[]> => {
  try {
    const json = await AsyncStorage.getItem(ASYNC_FISHERMAN_ACCOUNTS_KEY);
    if (json) {
      const stored = JSON.parse(json);
      if (Array.isArray(stored) && stored.length > 0) {
        return stored;
      }
    }
  } catch (error) {}
  return DEFAULT_FISHERMAN_ACCOUNTS;
};

export const registerFishermanAccount = async (account: any): Promise<void> => {
  const current = await getFishermanRegisteredAccounts();
  const filtered = current.filter(a => a.phone !== account.phone);
  const updated = [account, ...filtered];
  await saveFishermanRegisteredAccounts(updated);
};

export const saveCGRegisteredAccounts = async (accounts: any[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(ASYNC_CG_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (error) {
    console.error('Error saving CG registered accounts:', error);
  }
};

export const getCGRegisteredAccounts = async (): Promise<any[]> => {
  try {
    const json = await AsyncStorage.getItem(ASYNC_CG_ACCOUNTS_KEY);
    if (json) {
      const stored = JSON.parse(json);
      if (Array.isArray(stored) && stored.length > 0) {
        return stored;
      }
    }
  } catch (error) {}
  return DEFAULT_CG_ACCOUNTS;
};

export const registerCGOfficerAccount = async (account: any): Promise<void> => {
  const current = await getCGRegisteredAccounts();
  const filtered = current.filter(a => a.serviceId !== account.serviceId && a.phone !== account.phone);
  const updated = [account, ...filtered];
  await saveCGRegisteredAccounts(updated);
};
