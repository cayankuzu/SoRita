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
  ownerUserId: string | null;
  user: PersistedAuthUserSnapshot | null;
};

const AUTH_SESSION_STORAGE_KEY = 'sorita.auth.session';
let cachedPayload: PersistedAuthPayload | null | undefined;
let storageOperationQueue: Promise<void> = Promise.resolve();

function runStorageOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = storageOperationQueue.then(operation);
  storageOperationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function parseOwnerUserId(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 256
    ? value
    : null;
}

function parsePersistedAuthUser(value: unknown): PersistedAuthUserSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const user = value as Partial<PersistedAuthUserSnapshot>;

  return typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    typeof user.name === 'string' &&
    typeof user.username === 'string'
    ? (value as PersistedAuthUserSnapshot)
    : null;
}

async function deletePersistedAuthPayload() {
  cachedPayload = null;
  await deleteSecureStorageItem(AUTH_SESSION_STORAGE_KEY);
}

async function writePersistedAuthPayload(payload: PersistedAuthPayload) {
  try {
    await setSecureStorageItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(payload));
    cachedPayload = payload;
  } catch (error) {
    // A secure-store write can fail after partially committing. Force the next
    // queued operation to re-read durable state instead of trusting stale memory.
    cachedPayload = undefined;
    throw error;
  }
}

async function loadPersistedAuthPayload(): Promise<PersistedAuthPayload | null> {
  const rawValue = await getSecureStorageItem(AUTH_SESSION_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<PersistedAuthPayload> | null;

    if (!parsed?.access_token || !parsed.refresh_token) {
      await deletePersistedAuthPayload();
      return null;
    }

    const ownerUserId = parseOwnerUserId(parsed.ownerUserId);
    const parsedUser = parsePersistedAuthUser(parsed.user);
    const user = ownerUserId && parsedUser?.id === ownerUserId ? parsedUser : null;
    const payload: PersistedAuthPayload = {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
      ownerUserId,
      user,
    };

    if (parsed.user != null && user === null) {
      await writePersistedAuthPayload(payload);
    }

    return payload;
  } catch (error) {
    if (error instanceof SyntaxError) {
      await deletePersistedAuthPayload();
      return null;
    }

    throw error;
  }
}

async function readPersistedAuthPayload(): Promise<PersistedAuthPayload | null> {
  if (cachedPayload !== undefined) {
    return cachedPayload;
  }

  cachedPayload = await loadPersistedAuthPayload();
  return cachedPayload;
}

export function savePersistedAuthSession(session: Session | null) {
  return runStorageOperation(async () => {
    if (!session?.access_token || !session.refresh_token) {
      await deletePersistedAuthPayload();
      return;
    }

    const existingPayload = await readPersistedAuthPayload();
    const ownerUserId = parseOwnerUserId(session.user?.id);
    const preservedUser =
      ownerUserId &&
      existingPayload?.ownerUserId === ownerUserId &&
      existingPayload.user?.id === ownerUserId
        ? existingPayload.user
        : null;

    await writePersistedAuthPayload({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      ownerUserId,
      user: preservedUser,
    });
  });
}

export function getPersistedAuthSession(): Promise<RestorableAuthSession | null> {
  return runStorageOperation(async () => {
    const payload = await readPersistedAuthPayload();

    if (!payload) {
      return null;
    }

    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    };
  });
}

export function savePersistedAuthUser(user: PersistedAuthUserSnapshot | null) {
  return runStorageOperation(async () => {
    const payload = await readPersistedAuthPayload();

    if (!payload) {
      return;
    }

    if (user && (!payload.ownerUserId || user.id !== payload.ownerUserId)) {
      return;
    }

    await writePersistedAuthPayload({
      ...payload,
      user,
    });
  });
}

export function getPersistedAuthUser<
  TUser extends PersistedAuthUserSnapshot = PersistedAuthUserSnapshot,
>(): Promise<TUser | null> {
  return runStorageOperation(async () => {
    const payload = await readPersistedAuthPayload();

    if (!payload?.ownerUserId || payload.user?.id !== payload.ownerUserId) {
      return null;
    }

    return payload.user as TUser;
  });
}

export function clearPersistedAuthSession() {
  return runStorageOperation(deletePersistedAuthPayload);
}

export const authSessionStorageInternals = {
  resetMemoryCache() {
    cachedPayload = undefined;
  },
};
