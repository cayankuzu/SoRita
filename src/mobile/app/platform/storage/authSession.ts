import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';

const AUTH_SESSION_KEY = 'sorita.auth.session.v1';

type PersistedAuthSession = {
  access_token: string;
  refresh_token: string;
};

export async function savePersistedAuthSession(session: Session | null) {
  if (!session?.access_token || !session.refresh_token) {
    await AsyncStorage.removeItem(AUTH_SESSION_KEY);
    return;
  }

  const payload: PersistedAuthSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  };

  await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(payload));
}

export async function getPersistedAuthSession(): Promise<PersistedAuthSession | null> {
  const rawValue = await AsyncStorage.getItem(AUTH_SESSION_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<PersistedAuthSession>;

    if (
      typeof parsed.access_token !== 'string' ||
      typeof parsed.refresh_token !== 'string' ||
      !parsed.access_token ||
      !parsed.refresh_token
    ) {
      await AsyncStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }

    return {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
    };
  } catch {
    await AsyncStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }
}

export async function clearPersistedAuthSession() {
  await AsyncStorage.removeItem(AUTH_SESSION_KEY);
}
