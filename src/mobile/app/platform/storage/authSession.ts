import * as SecureStore from 'expo-secure-store';
import type { Session } from '@supabase/supabase-js';

type RestorableAuthSession = {
  access_token: string;
  refresh_token: string;
};

type PersistedAuthUserSnapshot = {
  id: string;
  email: string;
  name: string;
  username: string;
};

type PersistedAuthPayload = RestorableAuthSession & {
  user?: PersistedAuthUserSnapshot | null;
};

const AUTH_SESSION_STORAGE_KEY = 'sorita.auth.session';

async function readPersistedAuthPayload(): Promise<PersistedAuthPayload | null> {
  const rawValue = await SecureStore.getItemAsync(AUTH_SESSION_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<PersistedAuthPayload> | null;

    if (!parsed?.access_token || !parsed.refresh_token) {
      await clearPersistedAuthSession();
      return null;
    }

    return {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
      user:
        parsed.user &&
        typeof parsed.user === 'object' &&
        typeof parsed.user.id === 'string' &&
        typeof parsed.user.email === 'string' &&
        typeof parsed.user.name === 'string' &&
        typeof parsed.user.username === 'string'
          ? parsed.user
          : null,
    };
  } catch {
    await clearPersistedAuthSession();
    return null;
  }
}

export async function savePersistedAuthSession(session: Session | null) {
  if (!session?.access_token || !session.refresh_token) {
    await clearPersistedAuthSession();
    return;
  }

  const existingPayload = await readPersistedAuthPayload();
  const payload: PersistedAuthPayload = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    user: existingPayload?.user ?? null,
  };

  await SecureStore.setItemAsync(AUTH_SESSION_STORAGE_KEY, JSON.stringify(payload));
}

export async function getPersistedAuthSession(): Promise<RestorableAuthSession | null> {
  const payload = await readPersistedAuthPayload();

  if (!payload) {
    return null;
  }

  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  };
}

export async function savePersistedAuthUser(user: PersistedAuthUserSnapshot | null) {
  const payload = await readPersistedAuthPayload();

  if (!payload) {
    return;
  }

  await SecureStore.setItemAsync(
    AUTH_SESSION_STORAGE_KEY,
    JSON.stringify({
      ...payload,
      user,
    } satisfies PersistedAuthPayload),
  );
}

export async function getPersistedAuthUser<
  TUser extends PersistedAuthUserSnapshot = PersistedAuthUserSnapshot,
>(): Promise<TUser | null> {
  const payload = await readPersistedAuthPayload();
  return (payload?.user as TUser | undefined) ?? null;
}

export async function clearPersistedAuthSession() {
  await SecureStore.deleteItemAsync(AUTH_SESSION_STORAGE_KEY);
}
