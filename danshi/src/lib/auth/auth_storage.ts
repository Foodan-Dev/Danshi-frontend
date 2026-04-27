import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { STORAGE_KEYS } from '@/src/constants/app';

const canUseSecureStore = Platform.OS !== 'web';

async function getNativeSecureItem(key: string): Promise<string | undefined> {
  try {
    const secureValue = await SecureStore.getItemAsync(key);
    if (secureValue != null) return secureValue;
  } catch {}

  try {
    const legacyValue = await AsyncStorage.getItem(key);
    if (legacyValue == null) return undefined;
    try {
      await SecureStore.setItemAsync(key, legacyValue);
      await AsyncStorage.removeItem(key);
    } catch {}
    return legacyValue;
  } catch {
    return undefined;
  }
}

async function setNativeSecureItem(key: string, value?: string | null) {
  try {
    if (!value) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {}

  // 清理历史遗留的明文 token，避免 native 端继续保存在 AsyncStorage 中。
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}

async function getStoredValue(key: string): Promise<string | undefined> {
  if (canUseSecureStore) {
    return getNativeSecureItem(key);
  }
  try {
    const value = await AsyncStorage.getItem(key);
    return value ?? undefined;
  } catch {
    return undefined;
  }
}

async function setStoredValue(key: string, value?: string | null) {
  if (canUseSecureStore) {
    await setNativeSecureItem(key, value);
    return;
  }
  try {
    if (!value) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
  } catch {}
}

export async function getToken(): Promise<string | undefined> {
  return getStoredValue(STORAGE_KEYS.AUTH_TOKEN);
}

export async function setToken(token: string | undefined | null) {
  await setStoredValue(STORAGE_KEYS.AUTH_TOKEN, token);
}

export async function clearToken() {
  await setToken(undefined);
}

export async function getRefreshToken(): Promise<string | undefined> {
  return getStoredValue(STORAGE_KEYS.REFRESH_TOKEN);
}

export async function setRefreshToken(token: string | undefined | null) {
  await setStoredValue(STORAGE_KEYS.REFRESH_TOKEN, token);
}

export async function clearRefreshToken() {
  await setRefreshToken(undefined);
}

export const AuthStorage = {
  getToken,
  setToken,
  clearToken,
  getRefreshToken,
  setRefreshToken,
  clearRefreshToken,
};
