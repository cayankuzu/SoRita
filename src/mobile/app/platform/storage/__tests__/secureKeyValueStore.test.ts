import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { describe, expect, it, vi } from 'vitest';

import {
  deleteSecureStorageItem,
  getSecureStorageItem,
  SecureStorageUnavailableError,
  setSecureStorageItem,
} from '@/mobile/app/platform/storage/secureKeyValueStore';

const key = 'sorita.test.secure-key';
const fallbackKey = `sorita.secure-store-fallback:${key}`;
const tombstoneKey = `sorita.secure-store-deleted:${key}`;

describe('secureKeyValueStore', () => {
  it('uses SecureStore when the native module is healthy', async () => {
    await setSecureStorageItem(key, 'secure-value');

    await expect(getSecureStorageItem(key)).resolves.toBe('secure-value');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(key, 'secure-value');
    await expect(AsyncStorage.getItem(fallbackKey)).resolves.toBeNull();
  });

  it('fails closed without persisting secrets when SecureStore rejects writes', async () => {
    vi.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('native options cast'));

    await expect(setSecureStorageItem(key, 'secret-value')).rejects.toBeInstanceOf(
      SecureStorageUnavailableError,
    );

    await expect(AsyncStorage.getItem(fallbackKey)).resolves.toBeNull();
    await expect(getSecureStorageItem(key)).resolves.toBeNull();
  });

  it('never restores a legacy fallback when SecureStore reads fail', async () => {
    await AsyncStorage.setItem(fallbackKey, 'legacy-secret-value');
    vi.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('native options cast'));

    await expect(getSecureStorageItem(key)).resolves.toBeNull();
    await expect(AsyncStorage.getItem(fallbackKey)).resolves.toBeNull();
  });

  it('keeps a delete tombstone when SecureStore cannot delete a stale native value', async () => {
    await SecureStore.setItemAsync(key, 'stale-secure-value');
    vi.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('native options cast'));

    await deleteSecureStorageItem(key);

    await expect(AsyncStorage.getItem(fallbackKey)).resolves.toBeNull();
    await expect(AsyncStorage.getItem(tombstoneKey)).resolves.toBe('1');
    await expect(getSecureStorageItem(key)).resolves.toBeNull();
  });
});
