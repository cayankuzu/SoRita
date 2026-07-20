import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const FALLBACK_KEY_PREFIX = 'sorita.secure-store-fallback:';
const TOMBSTONE_KEY_PREFIX = 'sorita.secure-store-deleted:';
const TOMBSTONE_VALUE = '1';

let hasLoggedSecureStoreFailure = false;
const deletedKeys = new Set<string>();

export class SecureStorageUnavailableError extends Error {
  constructor(operation: 'read' | 'write', options?: ErrorOptions) {
    super(`Secure storage ${operation} failed.`, options);
    this.name = 'SecureStorageUnavailableError';
  }
}

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
  void import('@/mobile/app/platform/feedback/logger')
    .then(({ logger }) => {
      logger.warn('storage', `SecureStore ${operation} failed; secure storage is failing closed.`, {
        error,
        key,
      });
    })
    .catch(() => undefined);
}

async function removeLegacyFallback(key: string) {
  await AsyncStorage.removeItem(getFallbackKey(key));
}

export async function getSecureStorageItem(key: string) {
  const tombstone = await AsyncStorage.getItem(getTombstoneKey(key)).catch(() => null);

  if (deletedKeys.has(key) || tombstone === TOMBSTONE_VALUE) {
    await removeLegacyFallback(key).catch(() => undefined);
    return null;
  }

  try {
    const secureValue = await SecureStore.getItemAsync(key);
    await removeLegacyFallback(key).catch(() => undefined);
    return secureValue;
  } catch (error) {
    warnSecureStoreFailure('read', key, error);
    await removeLegacyFallback(key).catch(() => undefined);
    return null;
  }
}

export async function setSecureStorageItem(key: string, value: string) {
  try {
    await SecureStore.setItemAsync(key, value);
    await removeLegacyFallback(key);
    await AsyncStorage.removeItem(getTombstoneKey(key));
    deletedKeys.delete(key);
    return;
  } catch (error) {
    warnSecureStoreFailure('write', key, error);
    await removeLegacyFallback(key).catch(() => undefined);
    throw new SecureStorageUnavailableError('write', { cause: error });
  }
}

export async function deleteSecureStorageItem(key: string) {
  try {
    await SecureStore.deleteItemAsync(key);
    await AsyncStorage.removeItem(getTombstoneKey(key));
    deletedKeys.delete(key);
  } catch (error) {
    warnSecureStoreFailure('delete', key, error);
    deletedKeys.add(key);
    await AsyncStorage.setItem(getTombstoneKey(key), TOMBSTONE_VALUE);
  }

  await removeLegacyFallback(key);
}
