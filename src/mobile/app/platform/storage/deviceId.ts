import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_STORAGE_KEY = 'sorita_device_id';

export async function getOrCreateDeviceId() {
  const existingDeviceId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);

  if (existingDeviceId) {
    return existingDeviceId;
  }

  const nextDeviceId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `device-${Date.now()}`;

  await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, nextDeviceId);
  return nextDeviceId;
}
