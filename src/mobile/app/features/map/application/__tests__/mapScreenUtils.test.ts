import { describe, expect, it, vi } from 'vitest';

import {
  buildActiveEditorMarker,
  buildChangedListsForPlaceSave,
  buildSelectedSearchMarker,
  EXISTING_PLACE_MAP_PRESS_MAX_DISTANCE,
  findExistingPlaceMatch,
  findExistingPlaceMatchByCoordinates,
  getMapOverlayLayout,
  isEquivalentPlace,
  normalizePlaceLabel,
} from '@/mobile/app/features/map/application/mapScreenUtils';

vi.mock('@/shared/utils/id', () => ({
  createUuid: () => 'generated-place-id',
}));

describe('mapScreenUtils', () => {
  it('moves search results into a bounded bottom sheet on short map scenes', () => {
    expect(getMapOverlayLayout(480, 104)).toEqual({
      controlBottom: 12,
      isShort: true,
      resultsBottom: 68,
      resultsMaxHeight: 324,
      resultsTop: undefined,
      searchTop: 10,
    });

    expect(getMapOverlayLayout(760, 104)).toEqual({
      controlBottom: 12,
      isShort: false,
      resultsBottom: undefined,
      resultsMaxHeight: 324,
      resultsTop: 120,
      searchTop: 10,
    });

    expect(getMapOverlayLayout(280, 104).resultsMaxHeight).toBe(124);
  });

  it('normalizes and compares equivalent places', () => {
    expect(normalizePlaceLabel('  Kahve  Dunyasi ')).toBe('kahve dunyasi');
    expect(normalizePlaceLabel()).toBeUndefined();
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
    ).toBe(false);
    expect(
      isEquivalentPlace(
        { id: '', name: 'Cafe', lat: 1, lng: 1 },
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
        {
          list: {
            id: 'list-2',
            userId: 'viewer',
            name: 'Closer list',
            places: [],
            isPublic: true,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
          place: {
            id: 'place-2',
            name: 'Kahve Dunyasi',
            lat: 39.933401,
            lng: 32.859699,
            addedAt: '2025-01-01T00:00:00.000Z',
          },
        },
      ],
      39.933401,
      32.859699,
      ' kahve   dunyasi ',
    );

    expect(match?.place.id).toBe('place-2');
  });

  it('finds an existing nearby place match by coordinates only', () => {
    const match = findExistingPlaceMatchByCoordinates(
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
    );

    expect(match?.place.id).toBe('place-1');
  });

  it('keeps map press matching tight so nearby taps do not open place cards', () => {
    const match = findExistingPlaceMatchByCoordinates(
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
      39.93341,
      32.85971,
      EXISTING_PLACE_MAP_PRESS_MAX_DISTANCE,
    );

    expect(match).toBeNull();
  });

  it('builds search and editor markers only when they are unique', () => {
    expect(buildSelectedSearchMarker(null, [], '#000')).toBeNull();
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

    expect(buildActiveEditorMarker(null, false, '#222', 'Fallback')).toBeNull();
    expect(
      buildActiveEditorMarker({ lat: 2, lng: 2, name: '' }, true, '#222', 'Fallback'),
    ).toBeNull();
    expect(
      buildActiveEditorMarker(
        {
          lat: 2,
          lng: 2,
          name: '',
          existingPlace: { id: 'place-1', name: 'Existing', lat: 2, lng: 2, addedAt: '' },
        },
        false,
        '#222',
        'Fallback',
      ),
    ).toMatchObject({ name: 'Existing' });
    expect(
      buildActiveEditorMarker({ lat: 2, lng: 2, name: '' }, false, '#222', 'Fallback'),
    ).toMatchObject({ name: 'Fallback' });
  });

  it('returns null for unnamed searches and skips unaffected lists', () => {
    expect(findExistingPlaceMatch([], 1, 2)).toBeNull();
    expect(
      buildChangedListsForPlaceSave({
        lists: [{
          id: 'list-1', userId: 'viewer', name: 'List', isPublic: true,
          createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z', places: [],
        }],
        selectedListIds: [],
        sourcePlace: null,
        placeData: { name: 'Cafe', lat: 1, lng: 2 },
        user: { id: 'viewer', name: 'Viewer' },
      }),
    ).toEqual([]);
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

  it('preserves list updatedAt when only an existing place card is edited', () => {
    const changedLists = buildChangedListsForPlaceSave({
      lists: [
        {
          id: 'list-1',
          userId: 'viewer',
          name: 'Favorites',
          isPublic: true,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-09T00:00:00.000Z',
          places: [
            {
              id: 'place-1',
              name: 'Cafe',
              lat: 1,
              lng: 1,
              addedAt: '2025-01-01T00:00:00.000Z',
              updatedAt: '2025-01-02T00:00:00.000Z',
            },
          ],
        },
      ],
      selectedListIds: ['list-1'],
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

    expect(changedLists).toHaveLength(1);
    expect(changedLists[0]?.updatedAt).toBe('2025-01-09T00:00:00.000Z');
    expect(changedLists[0]?.places[0]?.updatedAt).toBeTruthy();
    expect(changedLists[0]?.places[0]?.name).toBe('Cafe Updated');
  });

  it('preserves multiline title and notes in list updates', () => {
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
      ],
      selectedListIds: ['list-1'],
      sourcePlace: {
        id: 'place-1',
        name: 'Cafe',
        lat: 1,
        lng: 1,
        addedAt: '2025-01-01T00:00:00.000Z',
      },
      placeData: {
        name: 'Cafe',
        lat: 1,
        lng: 1,
        title: '\r\nKat 1\r\nKat 2\r\n',
        notes: '\r\nA\r\nV\r\nB\r\n',
      },
      user: {
        id: 'viewer',
        name: 'Viewer',
      },
    });

    expect(changedLists[0]?.places[0]).toMatchObject({
      title: 'Kat 1\nKat 2',
      notes: 'A\nV\nB',
    });
  });
});
