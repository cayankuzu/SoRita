import {
  deleteSecureStorageItem,
  getSecureStorageItem,
  setSecureStorageItem,
} from '@/mobile/app/platform/storage/secureKeyValueStore';
import { supabase } from '@/mobile/app/platform/supabase/client';

const ACTIVE_PUSH_TOKEN_CAPABILITY_STORAGE_KEY = 'sorita.push.active-capability.v1';
const PUSH_TOKEN_CLEANUP_TOMBSTONES_STORAGE_KEY = 'sorita.push.cleanup-tombstones.v1';
const MAX_PENDING_PUSH_TOKEN_TOMBSTONES = 8;
let cleanupMutationQueue: Promise<void> = Promise.resolve();

export type PushTokenCleanupCapability = {
  cleanupSecret: string;
  token: string;
};

type PushTokenCleanupTombstone = PushTokenCleanupCapability & {
  createdAt: string;
};

type PushCleanupStorage = {
  deleteSecureStorageItem: (key: string) => Promise<void>;
  getSecureStorageItem: (key: string) => Promise<string | null>;
  setSecureStorageItem: (key: string, value: string) => Promise<void>;
};

type PushTokenCleanupDependencies = {
  revokeToken: (params: PushTokenCleanupCapability) => Promise<boolean>;
  storage: PushCleanupStorage;
};

export class PushTokenCleanupPreparationError extends Error {
  constructor(message = 'Push token cleanup could not be safely prepared.', options?: ErrorOptions) {
    super(message, options);
    this.name = 'PushTokenCleanupPreparationError';
  }
}

function hasControlCharacter(value: string) {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127;
  });
}

function isSafeToken(value: unknown): value is string {
  return (
    typeof value === 'string'
    && value.length >= 8
    && value.length <= 2048
    && !hasControlCharacter(value)
  );
}

function isCleanupSecret(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/iu.test(value);
}

function isCapability(value: unknown): value is PushTokenCleanupCapability {
  return Boolean(
    value
    && typeof value === 'object'
    && isSafeToken((value as Partial<PushTokenCleanupCapability>).token)
    && isCleanupSecret((value as Partial<PushTokenCleanupCapability>).cleanupSecret),
  );
}

function parseCapability(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return isCapability(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseTombstones(value: string | null): PushTokenCleanupTombstone[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (candidate): candidate is PushTokenCleanupTombstone =>
        isCapability(candidate)
        && typeof (candidate as Partial<PushTokenCleanupTombstone>).createdAt === 'string'
        && Number.isFinite(Date.parse((candidate as PushTokenCleanupTombstone).createdAt)),
    );
  } catch {
    return [];
  }
}

function createCleanupSecret() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${crypto.randomUUID().replace(/-/gu, '')}${crypto.randomUUID().replace(/-/gu, '')}`;
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  throw new PushTokenCleanupPreparationError('Secure random generation is unavailable.');
}

async function defaultRevokeToken(params: PushTokenCleanupCapability) {
  const { data, error } = await supabase.rpc('revoke_push_token_with_cleanup_secret', {
    input_cleanup_secret: params.cleanupSecret,
    input_token: params.token,
  });

  if (error) {
    throw error;
  }

  return data === true;
}

const defaultDependencies: PushTokenCleanupDependencies = {
  revokeToken: defaultRevokeToken,
  storage: {
    deleteSecureStorageItem,
    getSecureStorageItem,
    setSecureStorageItem,
  },
};

function withCleanupMutationLock<T>(operation: () => Promise<T>) {
  const result = cleanupMutationQueue.then(operation, operation);
  cleanupMutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function getActivePushTokenCleanupCapability(
  storage: PushCleanupStorage = defaultDependencies.storage,
) {
  return parseCapability(await storage.getSecureStorageItem(ACTIVE_PUSH_TOKEN_CAPABILITY_STORAGE_KEY));
}

async function rememberActivePushTokenCleanupCapabilityUnlocked(
  token: string,
  cleanupSecret?: string,
  storage: PushCleanupStorage = defaultDependencies.storage,
) {
  if (!isSafeToken(token)) {
    throw new PushTokenCleanupPreparationError('Push token is invalid.');
  }

  const activeSecret = cleanupSecret && isCleanupSecret(cleanupSecret)
    ? cleanupSecret
    : createCleanupSecret();

  const capability = {
    cleanupSecret: activeSecret.toLowerCase(),
    token,
  } satisfies PushTokenCleanupCapability;

  try {
    await storage.setSecureStorageItem(
      ACTIVE_PUSH_TOKEN_CAPABILITY_STORAGE_KEY,
      JSON.stringify(capability),
    );
  } catch (error) {
    throw new PushTokenCleanupPreparationError(undefined, { cause: error });
  }

  return capability;
}

async function stagePushTokenCleanupTombstoneUnlocked(
  capability: PushTokenCleanupCapability,
  storage: PushCleanupStorage = defaultDependencies.storage,
) {
  if (!isCapability(capability)) {
    throw new PushTokenCleanupPreparationError('Push cleanup capability is invalid.');
  }

  const tombstones = parseTombstones(
    await storage.getSecureStorageItem(PUSH_TOKEN_CLEANUP_TOMBSTONES_STORAGE_KEY),
  );
  const existing = tombstones.some(
    (candidate) => candidate.token === capability.token && candidate.cleanupSecret === capability.cleanupSecret,
  );

  if (existing) {
    return false;
  }

  // Never evict an older revocation capability to make room for a newer one.
  // Losing it could let a previously bound account keep receiving delivery.
  if (tombstones.length >= MAX_PENDING_PUSH_TOKEN_TOMBSTONES) {
    throw new PushTokenCleanupPreparationError('Too many pending push cleanup tombstones.');
  }

  const nextTombstones = [
    ...tombstones,
    { ...capability, createdAt: new Date().toISOString() },
  ];

  try {
    await storage.setSecureStorageItem(
      PUSH_TOKEN_CLEANUP_TOMBSTONES_STORAGE_KEY,
      JSON.stringify(nextTombstones),
    );
  } catch (error) {
    throw new PushTokenCleanupPreparationError(undefined, { cause: error });
  }

  return true;
}

async function clearPushTokenCleanupTombstoneUnlocked(
  capability: PushTokenCleanupCapability,
  storage: PushCleanupStorage = defaultDependencies.storage,
) {
  const current = parseTombstones(
    await storage.getSecureStorageItem(PUSH_TOKEN_CLEANUP_TOMBSTONES_STORAGE_KEY),
  );
  const next = current.filter(
    (candidate) => candidate.token !== capability.token || candidate.cleanupSecret !== capability.cleanupSecret,
  );

  if (next.length === 0) {
    await storage.deleteSecureStorageItem(PUSH_TOKEN_CLEANUP_TOMBSTONES_STORAGE_KEY);
  } else if (next.length !== current.length) {
    await storage.setSecureStorageItem(
      PUSH_TOKEN_CLEANUP_TOMBSTONES_STORAGE_KEY,
      JSON.stringify(next),
    );
  }

  const active = await getActivePushTokenCleanupCapability(storage);
  if (active?.token === capability.token && active.cleanupSecret === capability.cleanupSecret) {
    await storage.deleteSecureStorageItem(ACTIVE_PUSH_TOKEN_CAPABILITY_STORAGE_KEY);
  }
}

async function flushPendingPushTokenCleanupTombstonesUnlocked(
  dependencies: PushTokenCleanupDependencies = defaultDependencies,
) {
  const tombstones = parseTombstones(
    await dependencies.storage.getSecureStorageItem(PUSH_TOKEN_CLEANUP_TOMBSTONES_STORAGE_KEY),
  );

  if (tombstones.length === 0) {
    return { attempted: 0, pending: 0, revoked: 0 };
  }

  const retained: PushTokenCleanupTombstone[] = [];
  let revoked = 0;

  for (const tombstone of tombstones) {
    try {
      if (await dependencies.revokeToken(tombstone)) {
        revoked += 1;
        const active = await getActivePushTokenCleanupCapability(dependencies.storage);
        if (active?.token === tombstone.token && active.cleanupSecret === tombstone.cleanupSecret) {
          await dependencies.storage.deleteSecureStorageItem(ACTIVE_PUSH_TOKEN_CAPABILITY_STORAGE_KEY);
        }
      } else {
        // A mismatched capability is retained and blocks a future account
        // registration. Removing it would turn a cleanup failure into a cross-
        // account delivery risk.
        retained.push(tombstone);
      }
    } catch {
      retained.push(tombstone);
    }
  }

  if (retained.length === 0) {
    await dependencies.storage.deleteSecureStorageItem(PUSH_TOKEN_CLEANUP_TOMBSTONES_STORAGE_KEY);
  } else {
    await dependencies.storage.setSecureStorageItem(
      PUSH_TOKEN_CLEANUP_TOMBSTONES_STORAGE_KEY,
      JSON.stringify(retained),
    );
  }

  return {
    attempted: tombstones.length,
    pending: retained.length,
    revoked,
  };
}

export function rememberActivePushTokenCleanupCapability(
  token: string,
  cleanupSecret?: string,
  storage: PushCleanupStorage = defaultDependencies.storage,
) {
  return withCleanupMutationLock(() =>
    rememberActivePushTokenCleanupCapabilityUnlocked(token, cleanupSecret, storage));
}

export function stagePushTokenCleanupTombstone(
  capability: PushTokenCleanupCapability,
  storage: PushCleanupStorage = defaultDependencies.storage,
) {
  return withCleanupMutationLock(() =>
    stagePushTokenCleanupTombstoneUnlocked(capability, storage));
}

export function clearPushTokenCleanupTombstone(
  capability: PushTokenCleanupCapability,
  storage: PushCleanupStorage = defaultDependencies.storage,
) {
  return withCleanupMutationLock(() =>
    clearPushTokenCleanupTombstoneUnlocked(capability, storage));
}

export function flushPendingPushTokenCleanupTombstones(
  dependencies: PushTokenCleanupDependencies = defaultDependencies,
) {
  return withCleanupMutationLock(() => flushPendingPushTokenCleanupTombstonesUnlocked(dependencies));
}

export const pushTokenCleanupInternals = {
  ACTIVE_PUSH_TOKEN_CAPABILITY_STORAGE_KEY,
  PUSH_TOKEN_CLEANUP_TOMBSTONES_STORAGE_KEY,
  parseCapability,
  parseTombstones,
  resetMutationQueueForTests() {
    cleanupMutationQueue = Promise.resolve();
  },
};
