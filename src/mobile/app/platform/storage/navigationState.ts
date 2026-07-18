import AsyncStorage from '@react-native-async-storage/async-storage';
import type { InitialState } from '@react-navigation/native';

const NAVIGATION_STATE_STORAGE_KEY = 'sorita.navigation.state.v1';

function isPersistedNavigationState(value: unknown): value is InitialState {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as InitialState).routes));
}

export async function getPersistedNavigationState() {
  const rawValue = await AsyncStorage.getItem(NAVIGATION_STATE_STORAGE_KEY);

  if (!rawValue) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!isPersistedNavigationState(parsed)) {
      await clearPersistedNavigationState();
      return undefined;
    }

    return parsed;
  } catch {
    await clearPersistedNavigationState();
    return undefined;
  }
}

export async function savePersistedNavigationState(state: InitialState | undefined) {
  if (!state) {
    await clearPersistedNavigationState();
    return;
  }

  await AsyncStorage.setItem(NAVIGATION_STATE_STORAGE_KEY, JSON.stringify(state));
}

export async function clearPersistedNavigationState() {
  await AsyncStorage.removeItem(NAVIGATION_STATE_STORAGE_KEY);
}
