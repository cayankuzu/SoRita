import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  MapViewport,
  MarkerFilterOption,
  PersistedMapScreenState,
} from '@/mobile/app/contracts/mapScreenState';

const MAP_SCREEN_STATE_STORAGE_VERSION = 2;
const MAP_SCREEN_STATE_TTL_MS = 1000 * 60 * 60 * 24;
const MAP_SCREEN_STATE_STORAGE_PREFIX = `sorita.map-screen.state.v${MAP_SCREEN_STATE_STORAGE_VERSION}`;
const LEGACY_MAP_SCREEN_STATE_STORAGE_PREFIX = 'sorita.map-screen.state.v1';
const MARKER_FILTER_OPTIONS = new Set<MarkerFilterOption>([
  'all',
  'public',
  'private',
  'mixed',
  'none',
]);

type PersistedMapScreenStateEnvelope = {
  ownerUserId: string;
  savedAt: number;
  state: PersistedMapScreenState;
  version: typeof MAP_SCREEN_STATE_STORAGE_VERSION;
};

function buildStorageKey(userId: string) {
  return `${MAP_SCREEN_STATE_STORAGE_PREFIX}:${userId}`;
}

function buildLegacyStorageKey(userId: string) {
  return `${LEGACY_MAP_SCREEN_STATE_STORAGE_PREFIX}:${userId}`;
}

function isPersistedMapViewport(value: unknown): value is MapViewport {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<MapViewport>;

  return (
    typeof candidate.latitude === 'number' &&
    Number.isFinite(candidate.latitude) &&
    typeof candidate.longitude === 'number' &&
    Number.isFinite(candidate.longitude) &&
    (candidate.zoom == null ||
      (typeof candidate.zoom === 'number' && Number.isFinite(candidate.zoom)))
  );
}

function isNullableObject(value: unknown) {
  return value == null || (typeof value === 'object' && !Array.isArray(value));
}

function isPersistedMapScreenState(value: unknown): value is PersistedMapScreenState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PersistedMapScreenState>;

  return (
    typeof candidate.markerFilter === 'string' &&
    MARKER_FILTER_OPTIONS.has(candidate.markerFilter as MarkerFilterOption) &&
    isNullableObject(candidate.editorData) &&
    isNullableObject(candidate.editorDraft) &&
    (candidate.manualViewport == null || isPersistedMapViewport(candidate.manualViewport)) &&
    isNullableObject(candidate.minimizedEditor) &&
    isNullableObject(candidate.minimizedExistingPlace) &&
    isNullableObject(candidate.selectedExistingPlace) &&
    isNullableObject(candidate.selectedSearchResult) &&
    (candidate.userViewport == null || isPersistedMapViewport(candidate.userViewport))
  );
}

function isFresh(savedAt: number) {
  const ageMs = Date.now() - savedAt;
  return Number.isFinite(savedAt) && ageMs >= 0 && ageMs <= MAP_SCREEN_STATE_TTL_MS;
}

function isPersistedMapScreenStateEnvelope(
  value: unknown,
  ownerUserId: string,
): value is PersistedMapScreenStateEnvelope {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PersistedMapScreenStateEnvelope>;

  return (
    candidate.version === MAP_SCREEN_STATE_STORAGE_VERSION &&
    candidate.ownerUserId === ownerUserId &&
    typeof candidate.savedAt === 'number' &&
    isFresh(candidate.savedAt) &&
    isPersistedMapScreenState(candidate.state)
  );
}

export async function getPersistedMapScreenState(userId: string) {
  const storageKey = buildStorageKey(userId);

  // V1 values have no timestamp, so they cannot satisfy the bounded-retention contract.
  await AsyncStorage.removeItem(buildLegacyStorageKey(userId));
  const rawValue = await AsyncStorage.getItem(storageKey);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!isPersistedMapScreenStateEnvelope(parsed, userId)) {
      await AsyncStorage.removeItem(storageKey);
      return null;
    }

    return parsed.state;
  } catch {
    await AsyncStorage.removeItem(storageKey);
    return null;
  }
}

export async function savePersistedMapScreenState(
  userId: string,
  state: PersistedMapScreenState,
) {
  const payload: PersistedMapScreenStateEnvelope = {
    ownerUserId: userId,
    savedAt: Date.now(),
    state,
    version: MAP_SCREEN_STATE_STORAGE_VERSION,
  };

  await AsyncStorage.removeItem(buildLegacyStorageKey(userId));
  await AsyncStorage.setItem(buildStorageKey(userId), JSON.stringify(payload));
}

export async function clearPersistedMapScreenState(userId: string) {
  await AsyncStorage.multiRemove([
    buildStorageKey(userId),
    buildLegacyStorageKey(userId),
  ]);
}

export const mapScreenStateStorageInternals = {
  legacyStoragePrefix: LEGACY_MAP_SCREEN_STATE_STORAGE_PREFIX,
  storagePrefix: MAP_SCREEN_STATE_STORAGE_PREFIX,
  ttlMs: MAP_SCREEN_STATE_TTL_MS,
};
