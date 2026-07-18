import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
import type { VisibleDataSnapshot } from '@/mobile/app/data/repositories/visibleDataRepository';
import {
  getPersistedVisibleDataSnapshot,
  savePersistedVisibleDataSnapshot,
} from '@/mobile/app/data/cache/visibleDataSnapshotCache';

const storageKey = 'sorita.visible-data.snapshot.viewer-1';

function buildUser(id: string): User {
  return {
    email: `${id}@example.com`,
    id,
    name: id,
    username: id,
  };
}

function buildSnapshot(listCount = 1, placesPerList = 1, commentsPerPlace = 1): VisibleDataSnapshot {
  const lists: PlaceList[] = Array.from({ length: listCount }, (_, listIndex) => ({
    createdAt: '2026-07-14T00:00:00.000Z',
    id: `list-${listIndex}`,
    isPublic: true,
    name: `List ${listIndex}`,
    places: Array.from({ length: placesPerList }, (_, placeIndex) => ({
      addedAt: '2026-07-14T00:00:00.000Z',
      comments: Array.from({ length: commentsPerPlace }, (_, commentIndex) => ({
        content: `Comment ${commentIndex}`,
        createdAt: '2026-07-14T00:00:00.000Z',
        id: `comment-${listIndex}-${placeIndex}-${commentIndex}`,
        replies: Array.from({ length: 8 }, (_, replyIndex) => ({
          content: `Reply ${replyIndex}`,
          createdAt: '2026-07-14T00:00:00.000Z',
          id: `reply-${listIndex}-${placeIndex}-${commentIndex}-${replyIndex}`,
          updatedAt: '2026-07-14T00:00:00.000Z',
          userId: 'viewer-1',
        })),
        updatedAt: '2026-07-14T00:00:00.000Z',
        userId: 'viewer-1',
      })),
      id: `place-${listIndex}-${placeIndex}`,
      lat: 41,
      lng: 29,
      name: `Place ${placeIndex}`,
    })),
    updatedAt: '2026-07-14T00:00:00.000Z',
    userId: 'viewer-1',
  }));

  return {
    allUsers: [buildUser('viewer-1')],
    blockRows: [],
    currentUser: buildUser('viewer-1'),
    lists,
    users: [buildUser('viewer-1')],
  };
}

describe('visibleDataSnapshotCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists a bounded viewer-scoped snapshot with savedAt metadata', async () => {
    await savePersistedVisibleDataSnapshot('viewer-1', buildSnapshot(30, 50, 20));

    const rawValue = await AsyncStorage.getItem(storageKey);
    expect(rawValue).toBeTruthy();

    const payload = JSON.parse(rawValue || '{}') as {
      savedAt: string;
      snapshot: VisibleDataSnapshot;
      version: number;
    };
    expect(payload.version).toBe(1);
    expect(payload.savedAt).toBe('2026-07-14T12:00:00.000Z');
    expect(payload.snapshot.lists).toHaveLength(24);
    expect(payload.snapshot.lists[0]?.places).toHaveLength(32);
    expect(payload.snapshot.lists[0]?.places[0]?.comments).toHaveLength(8);
    expect(payload.snapshot.lists[0]?.places[0]?.comments?.[0]?.replies).toHaveLength(4);
  });

  it('returns fresh snapshots and removes expired snapshots', async () => {
    const snapshot = buildSnapshot();

    await AsyncStorage.setItem(
      storageKey,
      JSON.stringify({
        savedAt: '2026-07-14T00:00:01.000Z',
        snapshot,
        version: 1,
      }),
    );
    await expect(getPersistedVisibleDataSnapshot('viewer-1')).resolves.toEqual(snapshot);

    await AsyncStorage.setItem(
      storageKey,
      JSON.stringify({
        savedAt: '2026-07-13T23:59:59.000Z',
        snapshot,
        version: 1,
      }),
    );
    await expect(getPersistedVisibleDataSnapshot('viewer-1')).resolves.toBeNull();
    await expect(AsyncStorage.getItem(storageKey)).resolves.toBeNull();
  });

  it('removes invalid or malformed payloads instead of using stale cache', async () => {
    await AsyncStorage.setItem(storageKey, JSON.stringify({ snapshot: buildSnapshot(), version: 1 }));
    await expect(getPersistedVisibleDataSnapshot('viewer-1')).resolves.toBeNull();
    await expect(AsyncStorage.getItem(storageKey)).resolves.toBeNull();

    await AsyncStorage.setItem(storageKey, '{not-json');
    await expect(getPersistedVisibleDataSnapshot('viewer-1')).resolves.toBeNull();
    await expect(AsyncStorage.getItem(storageKey)).resolves.toBeNull();
  });
});
