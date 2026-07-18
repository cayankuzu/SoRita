import { describe, expect, it, vi } from 'vitest';

import {
  buildEditorSourceKey,
  filterSafeSelectedLists,
  getInitialBestTimes,
  getInitialSelectedCategories,
  getInitialSelectedLists,
  isEquivalentTargetPlace,
  reorderPhotos,
  swapPhotos,
  toggleArrayValue,
} from '@/mobile/app/features/map/application/placeEditorStateUtils';

describe('placeEditorStateUtils', () => {
  it('compares equivalent target places', () => {
    expect(
      isEquivalentTargetPlace(
        { id: 'place-1', name: 'Cafe', lat: 1, lng: 1 },
        { id: 'place-1', name: 'Other', lat: 2, lng: 2 },
      ),
    ).toBe(true);

    expect(
      isEquivalentTargetPlace(
        { id: 'place-1', name: ' Cafe ', lat: 1, lng: 1 },
        { name: 'cafe', lat: 1.000001, lng: 1.000001 },
      ),
    ).toBe(true);
  });

  it('reorders, swaps photos and toggles array values', () => {
    expect(reorderPhotos(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(reorderPhotos(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
    expect(swapPhotos(['a', 'b', 'c'], 0, 2)).toEqual(['c', 'b', 'a']);
    expect(swapPhotos(['a', 'b'], 1, 1)).toEqual(['a', 'b']);

    const setter = vi.fn((updater) => updater(['wifi']));
    toggleArrayValue('wifi', setter);
    expect(setter).toHaveBeenCalled();
  });

  it('derives initial editor state from existing places and lists', () => {
    const place = {
      id: 'place-1',
      name: 'Cafe',
      lat: 1,
      lng: 1,
      category: 'coffee',
      bestTime: 'morning',
      addedAt: '2025-01-01T00:00:00.000Z',
    };
    const lists = [
      {
        id: 'list-1',
        userId: 'viewer',
        name: 'Favorites',
        places: [place],
        isPublic: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
      {
        id: 'list-2',
        userId: 'viewer',
        name: 'Later',
        places: [],
        isPublic: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ];

    expect(getInitialSelectedCategories(place)).toEqual(['coffee']);
    expect(getInitialSelectedCategories(null)).toEqual([]);
    expect(getInitialBestTimes(place)).toEqual(['morning']);
    expect(getInitialSelectedLists(place, lists)).toEqual(['list-1']);
    expect(getInitialSelectedLists(null, lists)).toEqual([]);
    expect(buildEditorSourceKey({ existingPlace: place, lat: 1, lng: 1, placeName: 'Cafe' })).toContain('place-1');
  });

  it('filters unsafe list selections', () => {
    expect(
      filterSafeSelectedLists(
        ['list-1', 'list-2', 'missing'],
        new Set(['list-2']),
        new Set(['list-2']),
        new Set(['list-1', 'list-2']),
      ),
    ).toEqual(['list-1', 'list-2']);
  });
});
