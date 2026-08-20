import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PlaceComment } from '@/mobile/app/data/contracts/entities';
import type { VisibleDataSnapshot } from '@/mobile/app/data/repositories/visibleDataRepository';

// v2 prevents four-item legacy media snapshots from masking complete server data.
const CACHE_VERSION = 2;
const MAX_CACHED_LISTS = 24;
const MAX_CACHED_PLACES_PER_LIST = 32;
const MAX_CACHED_COMMENTS_PER_PLACE = 8;
const MAX_CACHED_REPLIES_PER_COMMENT = 4;
const SNAPSHOT_TTL_MS = 1000 * 60 * 60 * 12;
const STORAGE_KEY_PREFIX = 'sorita.visible-data.snapshot';

type VisibleDataSnapshotCachePayload = {
  savedAt: string;
  snapshot: VisibleDataSnapshot;
  version: number;
};

function getStorageKey(viewerId: string) {
  return `${STORAGE_KEY_PREFIX}.${viewerId}`;
}

function trimComments(
  comments: PlaceComment[] | undefined,
  maxCount: number,
): PlaceComment[] | undefined {
  if (!comments?.length) {
    return undefined;
  }

  return comments.slice(0, maxCount).map((comment) => ({
    ...comment,
    replies: trimComments(comment.replies, MAX_CACHED_REPLIES_PER_COMMENT),
  }));
}

function trimSnapshot(snapshot: VisibleDataSnapshot): VisibleDataSnapshot {
  return {
    ...snapshot,
    lists: snapshot.lists.slice(0, MAX_CACHED_LISTS).map((list) => ({
      ...list,
      places: list.places.slice(0, MAX_CACHED_PLACES_PER_LIST).map((place) => ({
        ...place,
        comments: trimComments(place.comments, MAX_CACHED_COMMENTS_PER_PLACE),
      })),
    })),
  };
}

function isValidPayload(value: unknown): value is VisibleDataSnapshotCachePayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Partial<VisibleDataSnapshotCachePayload>;
  return (
    payload.version === CACHE_VERSION &&
    typeof payload.savedAt === 'string' &&
    Boolean(payload.snapshot) &&
    typeof payload.snapshot === 'object' &&
    Array.isArray(payload.snapshot.lists) &&
    Array.isArray(payload.snapshot.users) &&
    Array.isArray(payload.snapshot.allUsers) &&
    Array.isArray(payload.snapshot.blockRows)
  );
}

function isExpired(savedAt: string) {
  const savedAtMs = new Date(savedAt).getTime();

  if (!Number.isFinite(savedAtMs)) {
    return true;
  }

  return Date.now() - savedAtMs > SNAPSHOT_TTL_MS;
}

export async function getPersistedVisibleDataSnapshot(viewerId: string) {
  const storageKey = getStorageKey(viewerId);
  const rawValue = await AsyncStorage.getItem(storageKey);

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!isValidPayload(parsedValue)) {
      await AsyncStorage.removeItem(storageKey);
      return null;
    }

    if (isExpired(parsedValue.savedAt)) {
      await AsyncStorage.removeItem(storageKey);
      return null;
    }

    return parsedValue.snapshot;
  } catch {
    await AsyncStorage.removeItem(storageKey);
    return null;
  }
}

export async function savePersistedVisibleDataSnapshot(
  viewerId: string,
  snapshot: VisibleDataSnapshot,
) {
  const payload: VisibleDataSnapshotCachePayload = {
    savedAt: new Date().toISOString(),
    snapshot: trimSnapshot(snapshot),
    version: CACHE_VERSION,
  };

  await AsyncStorage.setItem(getStorageKey(viewerId), JSON.stringify(payload));
}
