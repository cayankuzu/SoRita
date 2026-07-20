import { describe, expect, it } from 'vitest';

import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import { buildOwnedPlaceListUpdates } from '@/mobile/app/features/places/application/ownedPlaceListUpdates';

const originalPlace: Place = {
  id: 'place-1',
  name: 'Galata',
  lat: 41.0256,
  lng: 28.9741,
  address: 'Eski adres',
  addedAt: '2026-01-01T00:00:00.000Z',
};

function createList(id: string, places: Place[]): PlaceList {
  return {
    id,
    userId: 'user-1',
    name: id,
    places,
    isPublic: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };
}

describe('buildOwnedPlaceListUpdates', () => {
  it('updates, moves, and normalizes a place without touching unrelated lists', () => {
    const updatedAt = '2026-07-18T12:00:00.000Z';
    const source = createList('source', [originalPlace]);
    const target = createList('target', []);
    const unrelated = createList('unrelated', []);
    const placeData: Omit<Place, 'id' | 'addedAt'> = {
      ...originalPlace,
      address: '  Yeni adres  ',
      notes: '  Not  ',
      title: '  Başlık  ',
    };

    const updates = buildOwnedPlaceListUpdates({
      createId: () => 'place-copy',
      editableLists: [source, target, unrelated],
      place: originalPlace,
      placeData,
      targetListIds: ['target', 'target'],
      updatedAt,
    });

    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({ id: 'source', places: [], updatedAt });
    expect(updates[1]).toMatchObject({
      id: 'target',
      places: [
        {
          id: 'place-copy',
          address: 'Yeni adres',
          notes: 'Not',
          title: 'Başlık',
          addedAt: originalPlace.addedAt,
          updatedAt,
        },
      ],
      updatedAt,
    });
  });

  it('preserves identity and list membership timestamp for an in-place edit', () => {
    const source = createList('source', [originalPlace]);

    const [updatedList] = buildOwnedPlaceListUpdates({
      createId: () => 'unused',
      editableLists: [source],
      place: originalPlace,
      placeData: { ...originalPlace, name: 'Galata Kulesi' },
      targetListIds: ['source'],
      updatedAt: '2026-07-18T12:00:00.000Z',
    });

    expect(updatedList.updatedAt).toBe(source.updatedAt);
    expect(updatedList.places[0]).toMatchObject({
      id: originalPlace.id,
      name: 'Galata Kulesi',
      addedAt: originalPlace.addedAt,
    });
  });

  it('matches legacy places without ids by normalized coordinates and name', () => {
    const legacyMatch = { ...originalPlace, id: '', name: '  GALATA  ' };
    const source = createList('source', [
      { ...legacyMatch, lat: legacyMatch.lat + 1 },
      { ...legacyMatch, lng: legacyMatch.lng + 1 },
      { ...legacyMatch, name: 'Başka yer' },
      legacyMatch,
    ]);

    const [updatedList] = buildOwnedPlaceListUpdates({
      createId: () => 'unused',
      editableLists: [source],
      place: originalPlace,
      placeData: { ...originalPlace, name: 'Galata Kulesi' },
      targetListIds: ['source'],
      updatedAt: '2026-07-18T12:00:00.000Z',
    });

    expect(updatedList.places).toHaveLength(4);
    expect(updatedList.places[3]).toMatchObject({ id: 'unused', name: 'Galata Kulesi' });
  });

  it('uses the production id generator when a new membership has no injected factory', () => {
    const { id: _id, addedAt: _addedAt, ...placeData } = originalPlace;
    const [updatedList] = buildOwnedPlaceListUpdates({
      editableLists: [createList('target', [])],
      place: originalPlace,
      placeData,
      targetListIds: ['target'],
      updatedAt: '2026-07-18T12:00:00.000Z',
    });

    expect(updatedList.places[0].id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
