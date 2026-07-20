import { describe, expect, it, vi } from 'vitest';

import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import { listsRepositoryInternals as lists } from '@/mobile/app/data/repositories/listsRepository';

vi.mock('@/mobile/app/platform/supabase/media', () => ({
  uploadImageAsset: vi.fn(),
  uploadPlaceMediaAsset: vi.fn(),
}));

vi.mock('@/mobile/app/platform/media/videoThumbnails', () => ({
  generateVideoThumbnailUri: vi.fn(),
}));

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: { auth: {}, from: vi.fn() },
}));

vi.mock('@/mobile/app/data/outbox/mediaCleanupOutbox', () => ({
  deleteStorageAssetsWithRetry: vi.fn(),
}));

vi.mock('@/mobile/app/data/repositories/moderationReports', () => ({
  submitModerationReport: vi.fn(),
}));

vi.mock('@/mobile/app/data/repositories/visibleDataRepository', () => ({
  fetchVisibleDataContext: vi.fn(),
  fetchVisibleListsPage: vi.fn(),
}));

const basePlace: Place = {
  id: 'place-1',
  name: 'Cafe',
  title: 'Title',
  menuUrl: 'https://example.com/menu',
  lat: 41,
  lng: 29,
  address: 'Address',
  notes: 'Notes',
  rating: 4,
  category: 'cafe',
  categories: ['coffee'],
  studentDiscount: true,
  priceRange: 2,
  priceMin: 10,
  priceMax: 20,
  bestTime: 'morning',
  bestTimes: ['morning'],
  atmosphere: ['cozy'],
  specialFeatures: ['WiFi'],
  media: [{ type: 'photo', url: 'https://cdn.example.com/photo.jpg' }],
  sourceAttribution: {
    listId: 'source-list', placeId: 'source-place', placeName: 'Source',
    userAvatar: 'avatar.jpg', userId: 'source-user', userName: 'Ada',
  },
  addedAt: '2026-07-18T00:00:00.000Z',
};

function baseList(overrides: Partial<PlaceList> = {}): PlaceList {
  return {
    id: 'list-1', userId: 'user-1', name: 'Favorites', description: 'Description',
    emoji: 'coffee', coverImage: 'https://cdn.example.com/cover.jpg', places: [basePlace],
    isPublic: true, createdAt: '2026-07-18T00:00:00.000Z', updatedAt: '2026-07-18T00:00:00.000Z',
    ...overrides,
  };
}

describe('listsRepository persistence internals', () => {
  it('detects every persistence-relevant place field while ignoring duplicate array entries', () => {
    expect(lists.arePlacesEquivalentForPersistence(basePlace, { ...basePlace })).toBe(true);
    expect(lists.arePlacesEquivalentForPersistence(basePlace, {
      ...basePlace, categories: ['coffee', 'coffee'],
    })).toBe(true);

    const variants: Place[] = [
      { ...basePlace, id: 'other' },
      { ...basePlace, sourceAttribution: { ...basePlace.sourceAttribution!, listId: 'other' } },
      { ...basePlace, sourceAttribution: { ...basePlace.sourceAttribution!, placeId: 'other' } },
      { ...basePlace, sourceAttribution: { ...basePlace.sourceAttribution!, placeName: 'Other' } },
      { ...basePlace, sourceAttribution: { ...basePlace.sourceAttribution!, userAvatar: 'other' } },
      { ...basePlace, sourceAttribution: { ...basePlace.sourceAttribution!, userId: 'other' } },
      { ...basePlace, sourceAttribution: { ...basePlace.sourceAttribution!, userName: 'Other' } },
      { ...basePlace, name: 'Other' },
      { ...basePlace, title: 'Other' },
      { ...basePlace, menuUrl: 'https://other.example' },
      { ...basePlace, lat: 40 },
      { ...basePlace, lng: 30 },
      { ...basePlace, address: 'Other' },
      { ...basePlace, notes: 'Other' },
      { ...basePlace, rating: 3 },
      { ...basePlace, category: 'other' },
      { ...basePlace, studentDiscount: false },
      { ...basePlace, priceRange: 3 },
      { ...basePlace, priceMin: 11 },
      { ...basePlace, priceMax: 21 },
      { ...basePlace, bestTime: 'evening' },
      { ...basePlace, categories: ['dessert'] },
      { ...basePlace, bestTimes: ['evening'] },
      { ...basePlace, atmosphere: ['busy'] },
      { ...basePlace, specialFeatures: ['Terrace'] },
      { ...basePlace, media: [{ type: 'photo', url: 'https://cdn.example.com/other.jpg' }] },
    ];
    for (const variant of variants) {
      expect(lists.arePlacesEquivalentForPersistence(basePlace, variant)).toBe(false);
    }
    expect(lists.areStringArraysEqual(undefined, [])).toBe(true);
    expect(lists.areStringArraysEqual(['a'], ['a', 'b'])).toBe(false);
    expect(lists.areStringArraysEqual(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(lists.uniqueOrderedStrings(['a', 'a', '', 'b'])).toEqual(['a', 'b']);
  });

  it('normalizes list/menu copy and compares all list metadata fields', () => {
    expect(lists.normalizeListNameForPersistence('  Favorites  ')).toBe('Favorites');
    expect(lists.normalizeListDescriptionForPersistence('  line one\nline two  ')).toBe('line one\nline two');
    expect(lists.normalizeListDescriptionForPersistence('   ')).toBeNull();
    expect(lists.normalizeListDescriptionForPersistence()).toBeNull();
    expect(lists.normalizePlaceMenuUrlForPersistence()).toBeNull();
    expect(lists.normalizePlaceMenuUrlForPersistence('  ')).toBeNull();
    expect(lists.normalizePlaceMenuUrlForPersistence('example.com/menu')).toBe('https://example.com/menu');
    expect(() => lists.normalizePlaceMenuUrlForPersistence('http://localhost/menu')).toThrow();

    const current = baseList();
    expect(lists.areListMetadataEquivalentForPersistence(current, { ...current }, current.coverImage)).toBe(true);
    for (const variant of [
      baseList({ userId: 'other' }),
      baseList({ name: 'Other' }),
      baseList({ description: 'Other' }),
      baseList({ emoji: 'other' }),
      baseList({ isPublic: false }),
      baseList({ coverImage: 'https://cdn.example.com/other.jpg' }),
    ]) {
      expect(lists.areListMetadataEquivalentForPersistence(current, variant, current.coverImage)).toBe(false);
    }
    expect(lists.areListMetadataEquivalentForPersistence(
      baseList({ emoji: undefined, description: undefined }),
      baseList({ emoji: undefined, description: undefined, coverImage: undefined }),
      null,
    )).toBe(true);
  });

  it('resolves place-name fallbacks, pending URIs, and referenced storage assets', () => {
    expect(lists.resolvePlaceName(basePlace)).toBe('Cafe');
    expect(lists.resolvePlaceName({ ...basePlace, name: '', title: ' Title ' })).toBe('Title');
    expect(lists.resolvePlaceName({ ...basePlace, name: '', title: '', address: ' Address ' })).toBe('Address');
    expect(lists.resolvePlaceName({ ...basePlace, name: '', title: '', address: '' })).toBeTruthy();
    expect(lists.isPendingUploadUri('file://photo.jpg')).toBe(true);
    expect(lists.isPendingUploadUri('content://photo')).toBe(true);
    expect(lists.isPendingUploadUri('https://cdn.example.com/photo.jpg')).toBe(false);
    expect(lists.isPendingUploadUri(null)).toBe(false);
    expect(lists.getPlaceStorageUrls()).toEqual([]);
    expect(lists.getPlaceStorageUrls({
      ...basePlace,
      media: [
        { type: 'photo', url: 'photo.jpg' },
        { type: 'video', url: 'video.mp4', thumbnailUrl: 'thumb.jpg' },
      ],
    })).toEqual(['photo.jpg', 'video.mp4', 'thumb.jpg']);
  });

  it('tracks bounded upload progress exactly once per logical unit', () => {
    const progress = vi.fn();
    const tracker = lists.createProgressTracker(2, progress);
    expect(progress).toHaveBeenCalledWith(0);
    tracker.setUnitProgress('photo', -1);
    tracker.setUnitProgress('photo', 0.5);
    tracker.setUnitProgress('cover', 2);
    tracker.completeUnit('photo');
    tracker.completeUnit('photo');
    tracker.setUnitProgress('photo', 0.8);
    tracker.advance();
    tracker.advance(10);
    expect(progress.mock.calls.flat()).toEqual(expect.arrayContaining([0, 25, 75, 99]));

    const noProgress = lists.createProgressTracker(0);
    expect(() => {
      noProgress.advance();
      noProgress.completeUnit('x');
      noProgress.setUnitProgress('x', 0.5);
    }).not.toThrow();
  });

  it('estimates list work from covers, places, media, and pending thumbnails', () => {
    expect(lists.estimateUpdateListsUnits([])).toBe(1);
    expect(lists.estimateListUpdateUnits(baseList({ coverImage: undefined, places: [] }))).toBe(1);
    const list = baseList({
      places: [{
        ...basePlace,
        media: [
          { type: 'photo', url: '' },
          { type: 'video', url: 'file://video.mp4', thumbnailUrl: 'file://thumb.jpg' },
          { type: 'video', url: 'https://cdn.example.com/video.mp4', thumbnailUrl: 'https://cdn.example.com/thumb.jpg' },
        ],
      }],
    });
    expect(lists.estimateListUpdateUnits(list)).toBe(6);
    expect(lists.estimateUpdateListsUnits([list, baseList({ places: [] })])).toBe(8);
    const persistedList = baseList({
      places: [{
        ...basePlace,
        media: [{ type: 'video', url: 'https://cdn.example.com/video.mp4' }],
      }],
    });
    expect(lists.estimateListUpdateUnits(persistedList, persistedList)).toBe(2);
  });
});
