import { beforeEach, describe, expect, it, vi } from 'vitest';

const cancelQueriesMock = vi.fn();
const clearQueriesMock = vi.fn();
const removeAllChannelsMock = vi.fn();
const purgePrivateSignedReadUrlStateMock = vi.fn();
const cancelAndDrainStartupQueryCacheWorkMock = vi.fn();
const clearScreenIndexesForUserMock = vi.fn();
const clearPersistedVisibleDataSnapshotMock = vi.fn();
const clearEntityCacheForUserMock = vi.fn();
const clearOutboxForUserMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock('@/mobile/app/data/query/queryClient', () => ({
  queryClient: {
    cancelQueries: cancelQueriesMock,
    clear: clearQueriesMock,
  },
}));

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: { removeAllChannels: removeAllChannelsMock },
}));

vi.mock('@/mobile/app/platform/supabase/media', () => ({
  purgePrivateSignedReadUrlState: purgePrivateSignedReadUrlStateMock,
}));

vi.mock('@/mobile/app/data/cache/startupQueryCache', () => ({
  cancelAndDrainStartupQueryCacheWork: cancelAndDrainStartupQueryCacheWorkMock,
}));

vi.mock('@/mobile/app/data/cache/screenIndexStorage', () => ({
  clearScreenIndexesForUser: clearScreenIndexesForUserMock,
}));

vi.mock('@/mobile/app/data/cache/visibleDataSnapshotCache', () => ({
  clearPersistedVisibleDataSnapshot: clearPersistedVisibleDataSnapshotMock,
}));

vi.mock('@/mobile/app/data/cache/entityCacheStorage', () => ({
  clearEntityCacheForUser: clearEntityCacheForUserMock,
}));

vi.mock('@/mobile/app/data/outbox/outboxStorage', () => ({
  clearOutboxForUser: clearOutboxForUserMock,
}));

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: { error: loggerErrorMock },
}));

describe('purgeAuthenticatedUserState', () => {
  beforeEach(() => {
    [
      cancelQueriesMock,
      clearQueriesMock,
      removeAllChannelsMock,
      purgePrivateSignedReadUrlStateMock,
      cancelAndDrainStartupQueryCacheWorkMock,
      clearScreenIndexesForUserMock,
      clearPersistedVisibleDataSnapshotMock,
      clearEntityCacheForUserMock,
      clearOutboxForUserMock,
      loggerErrorMock,
    ].forEach((mock) => mock.mockReset());
    cancelQueriesMock.mockResolvedValue(undefined);
    removeAllChannelsMock.mockResolvedValue([]);
    cancelAndDrainStartupQueryCacheWorkMock.mockResolvedValue(undefined);
    clearScreenIndexesForUserMock.mockResolvedValue(undefined);
    clearPersistedVisibleDataSnapshotMock.mockResolvedValue(undefined);
    clearEntityCacheForUserMock.mockResolvedValue(undefined);
    clearOutboxForUserMock.mockResolvedValue(undefined);
  });

  it('clears volatile and durable state for only the signed-out user', async () => {
    const { purgeAuthenticatedUserState } = await import(
      '@/mobile/app/app-shell/auth/session/authUserStatePurge'
    );

    await expect(purgeAuthenticatedUserState('user-1')).resolves.toBeUndefined();

    expect(cancelQueriesMock).toHaveBeenCalledTimes(1);
    expect(clearQueriesMock).toHaveBeenCalledTimes(1);
    expect(removeAllChannelsMock).toHaveBeenCalledTimes(1);
    expect(purgePrivateSignedReadUrlStateMock).toHaveBeenCalledTimes(1);
    expect(cancelAndDrainStartupQueryCacheWorkMock).toHaveBeenCalledWith('user-1');
    expect(clearScreenIndexesForUserMock).toHaveBeenCalledWith('user-1');
    expect(clearPersistedVisibleDataSnapshotMock).toHaveBeenCalledWith('user-1');
    expect(clearEntityCacheForUserMock).toHaveBeenCalledWith('user-1');
    expect(clearOutboxForUserMock).toHaveBeenCalledWith('user-1');
  });

  it('continues every cleanup, logs sanitized operation names, and rejects once', async () => {
    cancelQueriesMock.mockRejectedValueOnce(new Error('secret query failure'));
    clearEntityCacheForUserMock.mockRejectedValueOnce(new Error('private storage failure'));
    const { purgeAuthenticatedUserState } = await import(
      '@/mobile/app/app-shell/auth/session/authUserStatePurge'
    );

    await expect(purgeAuthenticatedUserState('user-2')).rejects.toMatchObject({
      failedOperations: ['query-cache', 'entity-cache'],
      name: 'AuthUserStatePurgeError',
    });

    expect(clearQueriesMock).toHaveBeenCalledTimes(1);
    expect(clearScreenIndexesForUserMock).toHaveBeenCalledWith('user-2');
    expect(clearOutboxForUserMock).toHaveBeenCalledWith('user-2');
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'auth',
      'Authenticated user state purge was incomplete.',
      { failedOperations: ['query-cache', 'entity-cache'] },
    );
    expect(loggerErrorMock.mock.calls.flat().join(' ')).not.toContain('secret query failure');
    expect(loggerErrorMock.mock.calls.flat().join(' ')).not.toContain('private storage failure');
  });
});
