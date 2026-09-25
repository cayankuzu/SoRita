import AsyncStorage from '@react-native-async-storage/async-storage';
import type { InitialState } from '@react-navigation/native';

const NAVIGATION_STATE_STORAGE_VERSION = 2;
// Long enough to come back to the same screen after Android closed the app in
// the background (a photo picked, a map opened); a later launch starts on the
// home feed, as a new session should, not deep in yesterday's stack.
const NAVIGATION_STATE_TTL_MS = 1000 * 60 * 30;
const NAVIGATION_STATE_STORAGE_PREFIX = `sorita.navigation.state.v${NAVIGATION_STATE_STORAGE_VERSION}`;
const LEGACY_NAVIGATION_STATE_STORAGE_KEY = 'sorita.navigation.state.v1';

type PersistedNavigationStateEnvelope = {
  ownerUserId: string;
  savedAt: number;
  state: InitialState;
  version: typeof NAVIGATION_STATE_STORAGE_VERSION;
};

function buildStorageKey(ownerUserId: string) {
  return `${NAVIGATION_STATE_STORAGE_PREFIX}:${ownerUserId}`;
}

function isPersistedNavigationState(value: unknown): value is InitialState {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as InitialState).routes));
}

function isFresh(savedAt: number) {
  const ageMs = Date.now() - savedAt;
  return Number.isFinite(savedAt) && ageMs >= 0 && ageMs <= NAVIGATION_STATE_TTL_MS;
}

function isPersistedNavigationStateEnvelope(
  value: unknown,
  ownerUserId: string,
): value is PersistedNavigationStateEnvelope {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PersistedNavigationStateEnvelope>;

  return (
    candidate.version === NAVIGATION_STATE_STORAGE_VERSION &&
    candidate.ownerUserId === ownerUserId &&
    typeof candidate.savedAt === 'number' &&
    isFresh(candidate.savedAt) &&
    isPersistedNavigationState(candidate.state)
  );
}

export async function getPersistedNavigationState(ownerUserId: string) {
  const storageKey = buildStorageKey(ownerUserId);

  // The legacy global value cannot be attributed safely on a shared device.
  await AsyncStorage.removeItem(LEGACY_NAVIGATION_STATE_STORAGE_KEY);
  const rawValue = await AsyncStorage.getItem(storageKey);

  if (!rawValue) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!isPersistedNavigationStateEnvelope(parsed, ownerUserId)) {
      await AsyncStorage.removeItem(storageKey);
      return undefined;
    }

    return parsed.state;
  } catch {
    await AsyncStorage.removeItem(storageKey);
    return undefined;
  }
}

export async function savePersistedNavigationState(
  ownerUserId: string,
  state: InitialState | undefined,
) {
  if (!state) {
    await clearPersistedNavigationState(ownerUserId);
    return;
  }

  const payload: PersistedNavigationStateEnvelope = {
    ownerUserId,
    savedAt: Date.now(),
    state,
    version: NAVIGATION_STATE_STORAGE_VERSION,
  };

  await AsyncStorage.removeItem(LEGACY_NAVIGATION_STATE_STORAGE_KEY);
  await AsyncStorage.setItem(buildStorageKey(ownerUserId), JSON.stringify(payload));
}

export async function clearPersistedNavigationState(ownerUserId?: string | null) {
  const keys = [LEGACY_NAVIGATION_STATE_STORAGE_KEY];

  if (ownerUserId) {
    keys.push(buildStorageKey(ownerUserId));
  }

  await AsyncStorage.multiRemove(keys);
}

export const navigationStateStorageInternals = {
  legacyStorageKey: LEGACY_NAVIGATION_STATE_STORAGE_KEY,
  storagePrefix: NAVIGATION_STATE_STORAGE_PREFIX,
  ttlMs: NAVIGATION_STATE_TTL_MS,
};
