import type { Session } from '@supabase/supabase-js';

import {
  deleteSecureStorageItem,
  getSecureStorageItem,
  setSecureStorageItem,
} from '@/mobile/app/platform/storage/secureKeyValueStore';

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
let cachedPayload: PersistedAuthPayload | null | undefined;
let payloadReadInFlight: Promise<PersistedAuthPayload | null> | null = null;

async function loadPersistedAuthPayload(): Promise<PersistedAuthPayload | null> {
  const rawValue = await getSecureStorageItem(AUTH_SESSION_STORAGE_KEY);

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

async function readPersistedAuthPayload(): Promise<PersistedAuthPayload | null> {
  if (cachedPayload !== undefined) {
    return cachedPayload;
  }

  if (payloadReadInFlight) {
    return payloadReadInFlight;
  }

  payloadReadInFlight = loadPersistedAuthPayload()
    .then((payload) => {
      cachedPayload = payload;
      return payload;
    })
    .finally(() => {
      payloadReadInFlight = null;
    });

  return payloadReadInFlight;
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

  await setSecureStorageItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(payload));
  cachedPayload = payload;
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

  const nextPayload = {
    ...payload,
    user,
  } satisfies PersistedAuthPayload;

  await setSecureStorageItem(
    AUTH_SESSION_STORAGE_KEY,
    JSON.stringify(nextPayload),
  );
  cachedPayload = nextPayload;
}

export async function getPersistedAuthUser<
  TUser extends PersistedAuthUserSnapshot = PersistedAuthUserSnapshot,
>(): Promise<TUser | null> {
  const payload = await readPersistedAuthPayload();
  return (payload?.user as TUser | undefined) ?? null;
}

export async function clearPersistedAuthSession() {
  cachedPayload = null;
  payloadReadInFlight = null;
  await deleteSecureStorageItem(AUTH_SESSION_STORAGE_KEY);
}

export const authSessionStorageInternals = {
  resetMemoryCache() {
    cachedPayload = undefined;
    payloadReadInFlight = null;
  },
};
