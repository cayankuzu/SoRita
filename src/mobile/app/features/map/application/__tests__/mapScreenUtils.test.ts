import { describe, expect, it, vi } from 'vitest';

import {
  buildActiveEditorMarker,
  buildChangedListsForPlaceSave,
  buildSelectedSearchMarker,
  findExistingPlaceMatch,
  isEquivalentPlace,
  normalizePlaceLabel,
} from '@/mobile/app/features/map/application/mapScreenUtils';

vi.mock('@/shared/utils/id', () => ({
  createUuid: () => 'generated-place-id',
}));

describe('mapScreenUtils', () => {
  it('normalizes and compares equivalent places', () => {
    expect(normalizePlaceLabel('  Kahve  Dunyasi ')).toBe('kahve dunyasi');
    expect(
      isEquivalentPlace(
        { id: 'a', name: 'Cafe', lat: 1, lng: 1 },
        { id: 'a', name: 'Cafe', lat: 5, lng: 5 },
      ),
    ).toBe(true);
    expect(
      isEquivalentPlace(
        { id: 'a', name: 'Cafe', lat: 1, lng: 1 },
        { id: 'b', name: ' cafe ', lat: 1.000001, lng: 1.000001 },
      ),
    ).toBe(true);
  });

  it('finds an existing nearby place match by normalized name', () => {
    const match = findExistingPlaceMatch(
      [
        {
          list: {
            id: 'list-1',
            userId: 'viewer',
            name: 'List',
            places: [],
            isPublic: true,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
          place: {
            id: 'place-1',
            name: 'Kahve Dunyasi',
            lat: 39.9334,
            lng: 32.8597,
            addedAt: '2025-01-01T00:00:00.000Z',
          },
        },
      ],
      39.933401,
      32.859699,
      ' kahve   dunyasi ',
    );

    expect(match?.place.id).toBe('place-1');
  });

  it('builds search and editor markers only when they are unique', () => {
    expect(
      buildSelectedSearchMarker(
        { lat: 1, lng: 1, name: 'Cafe' },
        [{ list: {} as never, place: { id: 'p1', name: 'Cafe', lat: 1, lng: 1, addedAt: '' } }],
        '#000',
      ),
    ).toBeNull();

    expect(
      buildSelectedSearchMarker(
        { lat: 2, lng: 2, name: 'Cafe' },
        [],
        '#111',
      ),
    ).toEqual({
      lat: 2,
      lng: 2,
      name: 'Cafe',
      markerColor: '#111',
    });

    expect(
      buildActiveEditorMarker(
        { lat: 2, lng: 2, name: 'Draft' },
        false,
        '#222',
        'Fallback',
      ),
    ).toEqual({
      lat: 2,
      lng: 2,
      name: 'Draft',
      markerColor: '#222',
    });
  });

  it('builds list updates for new, updated, and removed places', () => {
    const changedLists = buildChangedListsForPlaceSave({
      lists: [
        {
          id: 'list-1',
          userId: 'viewer',
          name: 'Favorites',
          isPublic: true,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          places: [
            {
              id: 'place-1',
              name: 'Cafe',
              lat: 1,
              lng: 1,
              addedAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        },
        {
          id: 'list-2',
          userId: 'viewer',
          name: 'Later',
          isPublic: true,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          places: [],
        },
      ],
      selectedListIds: ['list-2'],
      sourcePlace: {
        id: 'place-1',
        name: 'Cafe',
        lat: 1,
        lng: 1,
        addedAt: '2025-01-01T00:00:00.000Z',
      },
      placeData: {
        name: 'Cafe Updated',
        lat: 1,
        lng: 1,
      },
      user: {
        id: 'viewer',
        name: 'Viewer',
      },
    });

    expect(changedLists).toHaveLength(2);
    expect(changedLists[0]?.places).toEqual([]);
    expect(changedLists[1]?.places[0]?.id).toBe('generated-place-id');
    expect(changedLists[1]?.places[0]?.name).toBe('Cafe Updated');
  });
});
