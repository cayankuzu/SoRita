import { describe, expect, it } from 'vitest';

import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';
import { estimateProfilePagerHeights } from '@/mobile/app/features/profile/ui/profilePagerLayout';

function createPlace(overrides: Partial<Place> = {}): Place {
  return {
    addedAt: '2026-07-17T00:00:00.000Z',
    id: overrides.id ?? 'place-1',
    lat: overrides.lat ?? 41.0,
    lng: overrides.lng ?? 29.0,
    name: overrides.name ?? 'Test Place',
    ...overrides,
  };
}

function createList(overrides: Partial<PlaceList> = {}): PlaceList {
  return {
    createdAt: '2026-07-17T00:00:00.000Z',
    id: overrides.id ?? 'list-1',
    isPublic: overrides.isPublic ?? true,
    name: overrides.name ?? 'Test List',
    places: overrides.places ?? [createPlace()],
    updatedAt: '2026-07-17T00:00:00.000Z',
    userId: overrides.userId ?? 'user-1',
    ...overrides,
  };
}

function createPlaceFeedItem(
  overrides: Partial<PlaceFeedCardItem> = {},
): PlaceFeedCardItem {
  return {
    key: overrides.key ?? 'feed-1',
    listId: overrides.listId ?? 'list-1',
    listIsPublic: overrides.listIsPublic ?? true,
    listName: overrides.listName ?? 'Test List',
    memberships: overrides.memberships ?? [],
    owner: overrides.owner ?? null,
    ownerId: overrides.ownerId ?? 'user-1',
    place: overrides.place ?? createPlace(),
    sortTime: overrides.sortTime ?? Date.now(),
    ...overrides,
  };
}

describe('estimateProfilePagerHeights', () => {
  it('returns a stable empty-state height when a tab has no content', () => {
    const heights = estimateProfilePagerHeights({
      columnCount: 2,
      columnGap: 10,
      hasNextPage: false,
      pageWidth: 412,
      screenPadding: 16,
      tabs: {
        gallery: [],
        lists: [],
        places: [],
      },
    });

    expect(heights.lists).toBeGreaterThanOrEqual(280);
    expect(heights.places).toBeGreaterThanOrEqual(280);
    expect(heights.gallery).toBeGreaterThanOrEqual(280);
  });

  it('grows as more grid items are added', () => {
    const small = estimateProfilePagerHeights({
      columnCount: 2,
      columnGap: 10,
      hasNextPage: false,
      pageWidth: 412,
      screenPadding: 16,
      tabs: {
        gallery: [createPlaceFeedItem()],
        lists: [createList()],
        places: [createPlaceFeedItem()],
      },
    });
    const large = estimateProfilePagerHeights({
      columnCount: 2,
      columnGap: 10,
      hasNextPage: true,
      pageWidth: 412,
      screenPadding: 16,
      tabs: {
        gallery: Array.from({ length: 8 }, (_, index) =>
          createPlaceFeedItem({
            key: `gallery-${index}`,
            place: createPlace({
              id: `gallery-place-${index}`,
              notes: 'Uzun aciklama satiri '.repeat(4),
            }),
          }),
        ),
        lists: Array.from({ length: 8 }, (_, index) =>
          createList({
            description: 'Liste aciklamasi '.repeat(5),
            id: `list-${index}`,
          }),
        ),
        places: Array.from({ length: 8 }, (_, index) =>
          createPlaceFeedItem({
            key: `place-${index}`,
            place: createPlace({
              id: `place-${index}`,
              notes: 'Mekan notu '.repeat(6),
              rating: 4.5,
            }),
          }),
        ),
      },
    });

    expect(large.lists).toBeGreaterThan(small.lists);
    expect(large.places).toBeGreaterThan(small.places);
    expect(large.gallery).toBeGreaterThan(small.gallery);
  });
});
