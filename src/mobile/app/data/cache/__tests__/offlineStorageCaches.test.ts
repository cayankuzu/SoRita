import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearEntityCacheForUser,
  readEntityCache,
  writeEntityCache,
} from '@/mobile/app/data/cache/entityCacheStorage';
import {
  clearScreenIndexesForUser,
  readScreenIndex,
  writeScreenIndex,
} from '@/mobile/app/data/cache/screenIndexStorage';

const nowMs = Date.parse('2026-07-15T10:00:00.000Z');

describe('offline storage caches', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(nowMs);
  });

  it('reads, expires, and clears entity caches per user', async () => {
    await expect(readEntityCache('user-1', 'places')).resolves.toBeNull();

    await writeEntityCache('user-1', 'places', {
      'place-1': { id: 'place-1', name: 'Roastery' },
    });

    await expect(readEntityCache('user-1', 'places')).resolves.toEqual({
      'place-1': { id: 'place-1', name: 'Roastery' },
    });

    vi.mocked(Date.now).mockReturnValue(nowMs + 2000);
    await expect(readEntityCache('user-1', 'places', 1000)).resolves.toBeNull();

    await writeEntityCache('user-1', 'places', {
      'place-1': { id: 'place-1' },
    });
    await writeEntityCache('user-2', 'places', {
      'place-2': { id: 'place-2' },
    });

    await clearEntityCacheForUser('user-1');

    await expect(readEntityCache('user-1', 'places')).resolves.toBeNull();
    await expect(readEntityCache('user-2', 'places')).resolves.toEqual({
      'place-2': { id: 'place-2' },
    });
  });

  it('drops malformed and mismatched entity cache payloads', async () => {
    await AsyncStorage.setItem('sorita.entity-cache.1.user-1.places', '{broken');
    await expect(readEntityCache('user-1', 'places')).resolves.toBeNull();

    await AsyncStorage.setItem(
      'sorita.entity-cache.1.user-1.places',
      JSON.stringify({
        entities: {},
        savedAt: nowMs,
        userId: 'another-user',
        version: 1,
      }),
    );

    await expect(readEntityCache('user-1', 'places')).resolves.toBeNull();
  });

  it('reads, expires, and clears screen indexes per user', async () => {
    await expect(readScreenIndex('user-1', 'home')).resolves.toBeNull();

    await writeScreenIndex('user-1', 'home', {
      ids: ['feed-1'],
    });

    await expect(readScreenIndex('user-1', 'home')).resolves.toEqual({
      ids: ['feed-1'],
    });

    vi.mocked(Date.now).mockReturnValue(nowMs + 2000);
    await expect(readScreenIndex('user-1', 'home', 1000)).resolves.toBeNull();

    await writeScreenIndex('user-1', 'home', { ids: ['feed-1'] });
    await writeScreenIndex('user-2', 'home', { ids: ['feed-2'] });
    await clearScreenIndexesForUser('user-1');

    await expect(readScreenIndex('user-1', 'home')).resolves.toBeNull();
    await expect(readScreenIndex('user-2', 'home')).resolves.toEqual({
      ids: ['feed-2'],
    });
  });

  it('drops malformed and mismatched screen index payloads', async () => {
    await AsyncStorage.setItem('sorita.screen-index.1.user-1.home', '{broken');
    await expect(readScreenIndex('user-1', 'home')).resolves.toBeNull();

    await AsyncStorage.setItem(
      'sorita.screen-index.1.user-1.home',
      JSON.stringify({
        index: null,
        savedAt: nowMs,
        userId: 'user-1',
        version: 1,
      }),
    );

    await expect(readScreenIndex('user-1', 'home')).resolves.toBeNull();
  });
});
