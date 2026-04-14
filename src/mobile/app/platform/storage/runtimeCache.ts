import AsyncStorage from '@react-native-async-storage/async-storage';

export const RUNTIME_CACHE_VERSION = 1;
const STORAGE_CACHE_PREFIX = `sorita:runtime:storage:v${RUNTIME_CACHE_VERSION}:`;
const NOTIFICATION_CACHE_PREFIX = `sorita:runtime:notifications:v${RUNTIME_CACHE_VERSION}:`;

function getStorageCacheKey(userId: string) {
  return `${STORAGE_CACHE_PREFIX}${userId}`;
}

function getNotificationCacheKey(userId: string) {
  return `${NOTIFICATION_CACHE_PREFIX}${userId}`;
}

async function readSnapshot<T>(key: string): Promise<T | null> {
  const rawValue = await AsyncStorage.getItem(key);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

async function writeSnapshot<T>(key: string, value: T) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

type PersistedSnapshotEnvelope = {
  version: number;
  userId: string;
};

export async function loadPersistedStorageSnapshot<T extends PersistedSnapshotEnvelope>(userId: string) {
  const snapshot = await readSnapshot<T>(getStorageCacheKey(userId));

  if (!snapshot || snapshot.version !== RUNTIME_CACHE_VERSION || snapshot.userId !== userId) {
    return null;
  }

  return snapshot;
}

export async function savePersistedStorageSnapshot<T extends PersistedSnapshotEnvelope>(snapshot: T) {
  await writeSnapshot(getStorageCacheKey(snapshot.userId), snapshot);
}

export async function clearPersistedStorageSnapshot(userId: string) {
  await AsyncStorage.removeItem(getStorageCacheKey(userId));
}

export async function loadPersistedNotificationSnapshot<T extends PersistedSnapshotEnvelope>(userId: string) {
  const snapshot = await readSnapshot<T>(getNotificationCacheKey(userId));

  if (!snapshot || snapshot.version !== RUNTIME_CACHE_VERSION || snapshot.userId !== userId) {
    return null;
  }

  return snapshot;
}

export async function savePersistedNotificationSnapshot<T extends PersistedSnapshotEnvelope>(snapshot: T) {
  await writeSnapshot(getNotificationCacheKey(snapshot.userId), snapshot);
}

export async function clearPersistedNotificationSnapshot(userId: string) {
  await AsyncStorage.removeItem(getNotificationCacheKey(userId));
}
