import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cancelAndDrainStartupQueryCacheWork,
  flushStartupQueryCachePersist,
  isStartupQueryKeyAllowed,
  persistStartupQueryCache,
  restoreStartupQueryCache,
  scheduleStartupQueryCachePersist,
  startupQueryCacheInternals,
} from '@/mobile/app/data/cache/startupQueryCache';
import { writeScreenIndex } from '@/mobile/app/data/cache/screenIndexStorage';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

describe('startupQueryCache', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('restores only viewer-scoped startup read models and keeps the first infinite page', async () => {
    const sourceClient = createClient();
    const feedKey = queryKeys.feed.page('user-1', 'server-v1');
    const unrelatedKey = queryKeys.profile.summary('user-1', 'another-user');

    const updatedAt = Date.now();
    sourceClient.setQueryData(feedKey, {
      pageParams: [null, { id: 'cursor-1' }],
      pages: [
        { items: [{ key: 'feed-1' }] },
        { items: [{ key: 'feed-2' }] },
      ],
    }, { updatedAt });
    sourceClient.setQueryData(unrelatedKey, { user: { id: 'another-user' } }, { updatedAt });

    await expect(persistStartupQueryCache(sourceClient, 'user-1')).resolves.toBe(true);

    const restoredClient = createClient();
    await expect(restoreStartupQueryCache(restoredClient, 'user-1')).resolves.toBe(1);
    expect(restoredClient.getQueryData(feedKey)).toEqual({
      pageParams: [null],
      pages: [{ items: [{ key: 'feed-1' }] }],
    });
    expect(restoredClient.getQueryData(unrelatedKey)).toBeUndefined();
    expect(restoredClient.getQueryState(feedKey)?.dataUpdatedAt).toBe(updatedAt);
  });

  it('never serializes local or signed media URLs', async () => {
    const queryClient = createClient();
    const feedKey = queryKeys.feed.page('user-1', 'server-v1');

    queryClient.setQueryData(feedKey, {
      pageParams: [null],
      pages: [{
        items: [{
          local: 'file:///private/photo.jpg',
          public: 'https://cdn.example.com/photo.jpg',
          signed: 'https://api.example.com/storage/v1/object/sign/a.jpg?token=secret',
          storage: 'sorita-storage://place-media-private/user-1/photo.jpg',
        }],
      }],
    }, { updatedAt: Date.now() });

    await persistStartupQueryCache(queryClient, 'user-1');

    const rawValue = await AsyncStorage.getItem(
      'sorita.screen-index.1.user-1.startup-queries-v3',
    );
    expect(rawValue).toContain('https://cdn.example.com/photo.jpg');
    expect(rawValue).toContain('sorita-storage://place-media-private/user-1/photo.jpg');
    expect(rawValue).not.toContain('file:///private/photo.jpg');
    expect(rawValue).not.toContain('token=secret');
  });

  it('rejects cross-user, search and arbitrary-profile keys', () => {
    expect(isStartupQueryKeyAllowed(queryKeys.feed.page('user-1'), 'user-1')).toBe(true);
    expect(isStartupQueryKeyAllowed(queryKeys.feed.page('user-2'), 'user-1')).toBe(false);
    expect(isStartupQueryKeyAllowed(queryKeys.explore.page('user-1', 'lists', 'coffee'), 'user-1')).toBe(false);
    expect(isStartupQueryKeyAllowed(queryKeys.profile.summary('user-1', 'user-2'), 'user-1')).toBe(false);
  });

  it('allows only the bounded startup variants for every domain', () => {
    const userId = 'user-1';

    expect(isStartupQueryKeyAllowed([], '')).toBe(false);
    expect(isStartupQueryKeyAllowed(['feed', 'other', userId], userId)).toBe(false);
    expect(isStartupQueryKeyAllowed(queryKeys.explore.page(userId, 'lists', ''), userId)).toBe(true);
    expect(isStartupQueryKeyAllowed(queryKeys.explore.page(userId, 'places', ''), userId)).toBe(false);
    expect(isStartupQueryKeyAllowed(queryKeys.profile.summary(userId, userId), userId)).toBe(true);
    expect(isStartupQueryKeyAllowed(queryKeys.profile.content(userId, userId, 'lists'), userId)).toBe(true);
    expect(isStartupQueryKeyAllowed(queryKeys.profile.content(userId, userId, 'places'), userId)).toBe(false);
    expect(isStartupQueryKeyAllowed(queryKeys.notifications.list(userId), userId)).toBe(true);
    expect(isStartupQueryKeyAllowed(queryKeys.notifications.unreadCount(userId), userId)).toBe(true);
    expect(isStartupQueryKeyAllowed(['notifications', 'other', userId], userId)).toBe(false);
    expect(isStartupQueryKeyAllowed(queryKeys.map.markers(userId), userId)).toBe(true);
    expect(isStartupQueryKeyAllowed(['map', 'other', userId], userId)).toBe(false);
    expect(isStartupQueryKeyAllowed(['settings', 'page', userId], userId)).toBe(false);
  });

  it('bounds malformed snapshots and detects ephemeral URL variants', () => {
    expect(startupQueryCacheInternals.isValidSnapshot({ queries: [] })).toBe(true);
    expect(startupQueryCacheInternals.isValidSnapshot({ queries: [{ data: {}, queryKey: [] }] })).toBe(false);
    expect(startupQueryCacheInternals.isValidSnapshot(null)).toBe(false);
    expect(startupQueryCacheInternals.isValidSnapshot({ queries: 'invalid' })).toBe(false);
    expect(startupQueryCacheInternals.isValidSnapshot({ queries: Array.from({ length: 8 }, () => ({})) })).toBe(false);
    expect(startupQueryCacheInternals.isValidSnapshot({
      queries: [null],
    })).toBe(false);
    expect(startupQueryCacheInternals.isValidSnapshot({
      queries: [{ data: {}, dataUpdatedAt: 1, queryKey: 'invalid' }],
    })).toBe(false);
    expect(startupQueryCacheInternals.isValidSnapshot({
      queries: [{ data: {}, dataUpdatedAt: Number.NaN, queryKey: [] }],
    })).toBe(false);
    expect(startupQueryCacheInternals.isValidSnapshot({
      queries: [{ data: {}, dataUpdatedAt: 0, queryKey: [] }],
    })).toBe(false);
    expect(startupQueryCacheInternals.isValidSnapshot({
      queries: [{ data: undefined, dataUpdatedAt: 1, queryKey: [] }],
    })).toBe(false);
    expect(startupQueryCacheInternals.isEphemeralMediaUri('file:///photo.jpg')).toBe(true);
    expect(startupQueryCacheInternals.isEphemeralMediaUri('content://photo/1')).toBe(true);
    expect(startupQueryCacheInternals.isEphemeralMediaUri('blob:photo/1')).toBe(true);
    expect(startupQueryCacheInternals.isEphemeralMediaUri('data:image/png;base64,a')).toBe(true);
    expect(startupQueryCacheInternals.isEphemeralMediaUri('https://api.test/storage/v1/object/sign/a')).toBe(true);
    expect(startupQueryCacheInternals.isEphemeralMediaUri('https://cdn.test/a?X-Amz-Signature=x')).toBe(true);
    expect(startupQueryCacheInternals.isEphemeralMediaUri('https://cdn.test/a?expires=2')).toBe(true);
    expect(startupQueryCacheInternals.isEphemeralMediaUri('https://cdn.test/a.webp')).toBe(false);
  });

  it('trims only infinite data and applies per-domain retention', () => {
    expect(startupQueryCacheInternals.cloneForPersistence(undefined)).toBeUndefined();
    expect(startupQueryCacheInternals.trimInfiniteQueryData(null)).toBeNull();
    expect(startupQueryCacheInternals.trimInfiniteQueryData({ pages: [] })).toEqual({ pages: [] });
    expect(startupQueryCacheInternals.trimInfiniteQueryData({ pageParams: [], pages: [], value: 1 })).toEqual({
      pageParams: [], pages: [], value: 1,
    });
    expect(startupQueryCacheInternals.getStartupQueryRetentionMs(['notifications'])).toBe(2 * 60 * 60 * 1000);
    expect(startupQueryCacheInternals.getStartupQueryRetentionMs(['explore'])).toBe(6 * 60 * 60 * 1000);
    expect(startupQueryCacheInternals.getStartupQueryRetentionMs(['feed'])).toBe(12 * 60 * 60 * 1000);
    expect(startupQueryCacheInternals.getStartupQueryRetentionMs(['map'])).toBe(24 * 60 * 60 * 1000);
    expect(startupQueryCacheInternals.getStartupQueryRetentionMs(['profile'])).toBe(24 * 60 * 60 * 1000);
    expect(startupQueryCacheInternals.getStartupQueryRetentionMs(['unknown'])).toBe(0);
  });

  it('skips empty and oversized snapshots', async () => {
    const emptyClient = createClient();
    await expect(persistStartupQueryCache(emptyClient, 'user-1')).resolves.toBe(false);

    const oversizedClient = createClient();
    oversizedClient.setQueryData(
      queryKeys.feed.page('user-1'),
      { payload: 'x'.repeat(startupQueryCacheInternals.MAX_PERSISTED_PAYLOAD_BYTES + 1) },
      { updatedAt: Date.now() },
    );
    await expect(persistStartupQueryCache(oversizedClient, 'user-1')).resolves.toBe(false);
  });

  it('rejects malformed and expired entries while deduplicating restores', async () => {
    const userId = 'restore-user';
    const now = Date.now();
    const profileKey = queryKeys.profile.summary(userId, userId);

    await writeScreenIndex(userId, 'startup-queries-v3', {
      queries: [
        { data: { unread: 2 }, dataUpdatedAt: now - 3 * 60 * 60 * 1000, queryKey: queryKeys.notifications.unreadCount(userId) },
        { data: { user: { id: userId } }, dataUpdatedAt: now, queryKey: profileKey },
        { data: { secret: true }, dataUpdatedAt: now, queryKey: queryKeys.profile.summary(userId, 'other') },
      ],
    });

    const client = createClient();
    const firstRestore = restoreStartupQueryCache(client, userId);
    expect(restoreStartupQueryCache(client, userId)).toBe(firstRestore);
    await expect(firstRestore).resolves.toBe(1);
    expect(client.getQueryData(profileKey)).toEqual({ user: { id: userId } });

    await writeScreenIndex(userId, 'startup-queries-v3', { invalid: true });
    await expect(restoreStartupQueryCache(createClient(), userId)).resolves.toBe(0);
  });

  it('flushes a pending persistence request and reports when none remains', async () => {
    vi.useFakeTimers();
    const client = createClient();
    client.setQueryData(queryKeys.feed.page('flush-user'), { pages: [], pageParams: [] }, {
      updatedAt: Date.now(),
    });

    scheduleStartupQueryCachePersist(client, 'flush-user');
    scheduleStartupQueryCachePersist(client, 'flush-user');
    await expect(flushStartupQueryCachePersist('flush-user')).resolves.toBe(true);
    await expect(flushStartupQueryCachePersist('flush-user')).resolves.toBe(false);
  });

  it('cancels pending persistence so signed-out user data cannot be rewritten', async () => {
    vi.useFakeTimers();
    const client = createClient();
    const userId = 'signed-out-user';
    client.setQueryData(queryKeys.feed.page(userId), { pages: [], pageParams: [] }, {
      updatedAt: Date.now(),
    });

    scheduleStartupQueryCachePersist(client, userId);
    await cancelAndDrainStartupQueryCacheWork(userId);
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(AsyncStorage.getItem(
      `sorita.screen-index.1.${userId}.startup-queries-v3`,
    )).resolves.toBeNull();
    await expect(flushStartupQueryCachePersist(userId)).resolves.toBe(false);
  });
});
