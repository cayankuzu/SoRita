import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  MapViewport,
  PersistedMapScreenState,
} from '@/mobile/app/contracts/mapScreenState';

const MAP_SCREEN_STATE_STORAGE_PREFIX = 'sorita.map-screen.state.v1';

function buildStorageKey(userId: string) {
  return `${MAP_SCREEN_STATE_STORAGE_PREFIX}:${userId}`;
}

function isPersistedMapViewport(value: unknown): value is MapViewport {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as MapViewport).latitude === 'number' &&
      typeof (value as MapViewport).longitude === 'number',
  );
}

function isPersistedMapScreenState(value: unknown): value is PersistedMapScreenState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PersistedMapScreenState>;

  return (
    typeof candidate.markerFilter === 'string' &&
    (candidate.editorData == null || typeof candidate.editorData === 'object') &&
    (candidate.editorDraft == null || typeof candidate.editorDraft === 'object') &&
    (candidate.manualViewport == null || isPersistedMapViewport(candidate.manualViewport)) &&
    (candidate.minimizedEditor == null || typeof candidate.minimizedEditor === 'object') &&
    (candidate.minimizedExistingPlace == null ||
      typeof candidate.minimizedExistingPlace === 'object') &&
    (candidate.selectedExistingPlace == null ||
      typeof candidate.selectedExistingPlace === 'object') &&
    (candidate.selectedSearchResult == null ||
      typeof candidate.selectedSearchResult === 'object') &&
    (candidate.userViewport == null || isPersistedMapViewport(candidate.userViewport))
  );
}

export async function getPersistedMapScreenState(userId: string) {
  const rawValue = await AsyncStorage.getItem(buildStorageKey(userId));

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!isPersistedMapScreenState(parsed)) {
      await clearPersistedMapScreenState(userId);
      return null;
    }

    return parsed;
  } catch {
    await clearPersistedMapScreenState(userId);
    return null;
  }
}

export async function savePersistedMapScreenState(
  userId: string,
  state: PersistedMapScreenState,
) {
  await AsyncStorage.setItem(buildStorageKey(userId), JSON.stringify(state));
}

export async function clearPersistedMapScreenState(userId: string) {
  await AsyncStorage.removeItem(buildStorageKey(userId));
}
