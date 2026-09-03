import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import {
  PushTokenCleanupPreparationError,
  clearPushTokenCleanupTombstone,
  flushPendingPushTokenCleanupTombstones,
  getActivePushTokenCleanupCapability,
  pushTokenCleanupInternals,
  rememberActivePushTokenCleanupCapability,
  stagePushTokenCleanupTombstone,
  type PushTokenCleanupCapability,
} from '@/mobile/app/platform/notifications/pushTokenCleanup';

function createSecureStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));

  return {
    deleteSecureStorageItem: vi.fn(async (key: string) => {
      values.delete(key);
    }),
    getSecureStorageItem: vi.fn(async (key: string) => values.get(key) ?? null),
    setSecureStorageItem: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    values,
  };
}

const cleanupSecret = 'a'.repeat(64);
const capability: PushTokenCleanupCapability = {
  cleanupSecret,
  token: 'ExponentPushToken[test-device-token]',
};

describe('pushTokenCleanup', () => {
  beforeEach(() => {
    pushTokenCleanupInternals.resetMutationQueueForTests();
  });

  it('retains a failed logout revocation tombstone and clears it only after an idempotent success', async () => {
    const storage = createSecureStorage();
    await rememberActivePushTokenCleanupCapability(
      capability.token,
      capability.cleanupSecret,
      storage,
    );
    await stagePushTokenCleanupTombstone(capability, storage);

    const failedRevoke = vi.fn().mockResolvedValue(false);
    await expect(flushPendingPushTokenCleanupTombstones({
      revokeToken: failedRevoke,
      storage,
    })).resolves.toEqual({ attempted: 1, pending: 1, revoked: 0 });
    expect(await getActivePushTokenCleanupCapability(storage)).toEqual(capability);

    const successfulRevoke = vi.fn().mockResolvedValue(true);
    await expect(flushPendingPushTokenCleanupTombstones({
      revokeToken: successfulRevoke,
      storage,
    })).resolves.toEqual({ attempted: 1, pending: 0, revoked: 1 });
    expect(successfulRevoke).toHaveBeenCalledWith(expect.objectContaining(capability));
    await expect(getActivePushTokenCleanupCapability(storage)).resolves.toBeNull();
  });

  it('deduplicates a staged capability and does not delete it when a transport call throws', async () => {
    const storage = createSecureStorage();
    await expect(stagePushTokenCleanupTombstone(capability, storage)).resolves.toBe(true);
    await expect(stagePushTokenCleanupTombstone(capability, storage)).resolves.toBe(false);

    await expect(flushPendingPushTokenCleanupTombstones({
      revokeToken: vi.fn().mockRejectedValue(new Error('offline')),
      storage,
    })).resolves.toEqual({ attempted: 1, pending: 1, revoked: 0 });

    const storedValues = [...storage.values.values()].join('\n');
    expect(storedValues).toContain(capability.token);
    expect(storedValues).toContain(capability.cleanupSecret);
  });

  it('fails closed when secure storage cannot persist the pre-logout tombstone', async () => {
    const storage = createSecureStorage();
    storage.setSecureStorageItem.mockRejectedValueOnce(new Error('secure storage unavailable'));

    await expect(stagePushTokenCleanupTombstone(capability, storage)).rejects.toBeInstanceOf(
      PushTokenCleanupPreparationError,
    );
  });

  it('fails closed instead of evicting an older pending cleanup capability', async () => {
    const storage = createSecureStorage();

    for (let index = 0; index < 8; index += 1) {
      await stagePushTokenCleanupTombstone({
        cleanupSecret: index.toString(16).repeat(64),
        token: `ExponentPushToken[pending-${index}]`,
      }, storage);
    }

    await expect(stagePushTokenCleanupTombstone({
      cleanupSecret: 'f'.repeat(64),
      token: 'ExponentPushToken[pending-overflow]',
    }, storage)).rejects.toBeInstanceOf(PushTokenCleanupPreparationError);

    const stored = [...storage.values.values()].join('\n');
    expect(stored).toContain('ExponentPushToken[pending-0]');
  });

  it('removes an active capability only when its matching tombstone has completed', async () => {
    const storage = createSecureStorage();
    await rememberActivePushTokenCleanupCapability(
      capability.token,
      capability.cleanupSecret,
      storage,
    );
    await stagePushTokenCleanupTombstone(capability, storage);
    await clearPushTokenCleanupTombstone(capability, storage);

    await expect(getActivePushTokenCleanupCapability(storage)).resolves.toBeNull();
  });

  it('serializes concurrent tombstone updates so neither revocation capability is lost', async () => {
    const storage = createSecureStorage();
    const secondCapability: PushTokenCleanupCapability = {
      cleanupSecret: 'b'.repeat(64),
      token: 'ExponentPushToken[second-device-token]',
    };

    await Promise.all([
      stagePushTokenCleanupTombstone(capability, storage),
      stagePushTokenCleanupTombstone(secondCapability, storage),
    ]);

    const serialized = storage.values.get(
      pushTokenCleanupInternals.PUSH_TOKEN_CLEANUP_TOMBSTONES_STORAGE_KEY,
    );
    expect(pushTokenCleanupInternals.parseTombstones(serialized ?? null)).toEqual(
      expect.arrayContaining([
        expect.objectContaining(capability),
        expect.objectContaining(secondCapability),
      ]),
    );
  });
});
