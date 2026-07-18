import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { logger } from '@/mobile/app/platform/feedback/logger';

const FALLBACK_KEY_PREFIX = 'sorita.secure-store-fallback:';
const TOMBSTONE_KEY_PREFIX = 'sorita.secure-store-deleted:';
const TOMBSTONE_VALUE = '1';

let hasLoggedSecureStoreFailure = false;

function getFallbackKey(key: string) {
  return `${FALLBACK_KEY_PREFIX}${key}`;
}

function getTombstoneKey(key: string) {
  return `${TOMBSTONE_KEY_PREFIX}${key}`;
}

function warnSecureStoreFailure(operation: string, key: string, error: unknown) {
  if (hasLoggedSecureStoreFailure) {
    return;
  }

  hasLoggedSecureStoreFailure = true;
  logger.warn('storage', `SecureStore ${operation} failed; using AsyncStorage fallback.`, {
    error,
    key,
  });
}

export async function getSecureStorageItem(key: string) {
  const tombstone = await AsyncStorage.getItem(getTombstoneKey(key));

  if (tombstone === TOMBSTONE_VALUE) {
    return null;
  }

  try {
    const secureValue = await SecureStore.getItemAsync(key);

    if (secureValue != null) {
      return secureValue;
    }
  } catch (error) {
    warnSecureStoreFailure('read', key, error);
  }

  return AsyncStorage.getItem(getFallbackKey(key));
}

export async function setSecureStorageItem(key: string, value: string) {
  try {
    await SecureStore.setItemAsync(key, value);
    await AsyncStorage.removeItem(getFallbackKey(key));
    await AsyncStorage.removeItem(getTombstoneKey(key));
    return;
  } catch (error) {
    warnSecureStoreFailure('write', key, error);
  }

  await AsyncStorage.setItem(getFallbackKey(key), value);
  await AsyncStorage.removeItem(getTombstoneKey(key));
}

export async function deleteSecureStorageItem(key: string) {
  try {
    await SecureStore.deleteItemAsync(key);
    await AsyncStorage.removeItem(getTombstoneKey(key));
  } catch (error) {
    warnSecureStoreFailure('delete', key, error);
    await AsyncStorage.setItem(getTombstoneKey(key), TOMBSTONE_VALUE);
  }

  await AsyncStorage.removeItem(getFallbackKey(key));
}
