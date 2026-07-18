import AsyncStorage from '@react-native-async-storage/async-storage';

const SCREEN_INDEX_VERSION = 1;
const SCREEN_INDEX_TTL_MS = 1000 * 60 * 60 * 24;
const SCREEN_INDEX_PREFIX = 'sorita.screen-index';

type ScreenIndexPayload<TIndex> = {
  index: TIndex;
  savedAt: number;
  userId: string;
  version: number;
};

function getStorageKey(userId: string, indexName: string) {
  return `${SCREEN_INDEX_PREFIX}.${SCREEN_INDEX_VERSION}.${userId}.${indexName}`;
}

function isExpired(savedAt: number, ttlMs: number) {
  return !Number.isFinite(savedAt) || Date.now() - savedAt > ttlMs;
}

export async function readScreenIndex<TIndex>(
  userId: string,
  indexName: string,
  ttlMs = SCREEN_INDEX_TTL_MS,
) {
  const key = getStorageKey(userId, indexName);
  const rawValue = await AsyncStorage.getItem(key);

  if (!rawValue) {
    return null;
  }

  try {
    const payload = JSON.parse(rawValue) as Partial<ScreenIndexPayload<TIndex>>;

    if (
      payload.version !== SCREEN_INDEX_VERSION ||
      payload.userId !== userId ||
      typeof payload.savedAt !== 'number' ||
      payload.index == null ||
      isExpired(payload.savedAt, ttlMs)
    ) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return payload.index as TIndex;
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

export async function writeScreenIndex<TIndex>(
  userId: string,
  indexName: string,
  index: TIndex,
) {
  const payload: ScreenIndexPayload<TIndex> = {
    index,
    savedAt: Date.now(),
    userId,
    version: SCREEN_INDEX_VERSION,
  };

  await AsyncStorage.setItem(getStorageKey(userId, indexName), JSON.stringify(payload));
}

export async function clearScreenIndexesForUser(userId: string) {
  const keys = await AsyncStorage.getAllKeys();
  const userPrefix = `${SCREEN_INDEX_PREFIX}.${SCREEN_INDEX_VERSION}.${userId}.`;
  const matchingKeys = keys.filter((key) => key.startsWith(userPrefix));

  if (matchingKeys.length > 0) {
    await AsyncStorage.multiRemove(matchingKeys);
  }
}
