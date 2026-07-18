import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getSecureStorageItem,
  setSecureStorageItem,
} from '@/mobile/app/platform/storage/secureKeyValueStore';

const DEVICE_ID_STORAGE_KEY = 'sorita_device_id';

export async function getOrCreateDeviceId() {
  const secureStoreValue = await getSecureStorageItem(DEVICE_ID_STORAGE_KEY);

  if (secureStoreValue) {
    return secureStoreValue;
  }

  const asyncStorageValue = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);

  if (asyncStorageValue) {
    await setSecureStorageItem(DEVICE_ID_STORAGE_KEY, asyncStorageValue);
    await AsyncStorage.removeItem(DEVICE_ID_STORAGE_KEY);
    return asyncStorageValue;
  }

  const nextDeviceId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `device-${Date.now()}`;

  await setSecureStorageItem(DEVICE_ID_STORAGE_KEY, nextDeviceId);
  await AsyncStorage.removeItem(DEVICE_ID_STORAGE_KEY);
  return nextDeviceId;
}
