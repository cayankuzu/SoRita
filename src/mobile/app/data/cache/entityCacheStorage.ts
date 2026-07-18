import AsyncStorage from '@react-native-async-storage/async-storage';

const ENTITY_CACHE_VERSION = 1;
const ENTITY_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const ENTITY_CACHE_PREFIX = 'sorita.entity-cache';

type EntityCachePayload<TEntity> = {
  entities: Record<string, TEntity>;
  savedAt: number;
  userId: string;
  version: number;
};

function getStorageKey(userId: string, entityName: string) {
  return `${ENTITY_CACHE_PREFIX}.${ENTITY_CACHE_VERSION}.${userId}.${entityName}`;
}

function isExpired(savedAt: number, ttlMs: number) {
  return !Number.isFinite(savedAt) || Date.now() - savedAt > ttlMs;
}

export async function readEntityCache<TEntity>(
  userId: string,
  entityName: string,
  ttlMs = ENTITY_CACHE_TTL_MS,
) {
  const key = getStorageKey(userId, entityName);
  const rawValue = await AsyncStorage.getItem(key);

  if (!rawValue) {
    return null;
  }

  try {
    const payload = JSON.parse(rawValue) as Partial<EntityCachePayload<TEntity>>;

    if (
      payload.version !== ENTITY_CACHE_VERSION ||
      payload.userId !== userId ||
      typeof payload.savedAt !== 'number' ||
      !payload.entities ||
      typeof payload.entities !== 'object' ||
      isExpired(payload.savedAt, ttlMs)
    ) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return payload.entities as Record<string, TEntity>;
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

export async function writeEntityCache<TEntity>(
  userId: string,
  entityName: string,
  entities: Record<string, TEntity>,
) {
  const payload: EntityCachePayload<TEntity> = {
    entities,
    savedAt: Date.now(),
    userId,
    version: ENTITY_CACHE_VERSION,
  };

  await AsyncStorage.setItem(getStorageKey(userId, entityName), JSON.stringify(payload));
}

export async function clearEntityCacheForUser(userId: string) {
  const keys = await AsyncStorage.getAllKeys();
  const userPrefix = `${ENTITY_CACHE_PREFIX}.${ENTITY_CACHE_VERSION}.${userId}.`;
  const matchingKeys = keys.filter((key) => key.startsWith(userPrefix));

  if (matchingKeys.length > 0) {
    await AsyncStorage.multiRemove(matchingKeys);
  }
}
