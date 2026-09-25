import { describe, expect, it } from 'vitest';

import {
  mapPayloadOwner,
  mapPlaceFeedCard,
  parseMediaPayload,
  toNumber,
  type PlaceFeedCardPayload,
} from '@/mobile/app/data/mappers/placeFeedCardMapper';

const basePayload: PlaceFeedCardPayload = {
  addedAt: '2026-09-01T10:00:00.000Z',
  lat: 41.01,
  listId: 'list-1',
  listName: 'Kahveler',
  lng: 29.02,
  ownerId: 'owner-1',
  ownerName: 'Ada',
  ownerUsername: 'ada',
  placeId: 'place-1',
  placeName: 'Kafe',
  updatedAt: '2026-09-02T10:00:00.000Z',
};

describe('placeFeedCardMapper', () => {
  it('reads numbers that Postgres sends as strings and ignores what is not a number', () => {
    expect(toNumber(4)).toBe(4);
    expect(toNumber('4.5')).toBe(4.5);
    expect(toNumber('abc')).toBeUndefined();
    expect(toNumber(null)).toBeUndefined();
    expect(toNumber(undefined)).toBeUndefined();
  });

  it('reads media as an array or a JSON string, and survives bad JSON', () => {
    const photo = { type: 'photo' as const, url: 'https://cdn.example.com/a.jpg' };

    expect(parseMediaPayload([photo])).toEqual([expect.objectContaining(photo)]);
    expect(parseMediaPayload(JSON.stringify([photo]))).toEqual([expect.objectContaining(photo)]);
    expect(parseMediaPayload('{not json')).toEqual([]);
    expect(parseMediaPayload(null)).toEqual([]);
  });

  it('maps a minimal payload with every optional field missing', () => {
    const item = mapPlaceFeedCard(basePayload, 'viewer-1');

    expect(item).toMatchObject({
      key: 'list-1:place-1',
      listIsPublic: true,
      locationPlaceCardsCount: 1,
      memberships: [{ listId: 'list-1', updatedAt: basePayload.updatedAt }],
      ownerId: 'owner-1',
      sortTime: new Date(basePayload.updatedAt).getTime(),
    });
    expect(item.place).toMatchObject({
      commentCount: 0,
      likes: 0,
      media: [],
      photos: [],
      studentDiscount: false,
    });
    expect(item.place.likedBy).toBeUndefined();
    expect(item.place.addedBy).toEqual({ userId: 'owner-1', userName: 'Ada', userAvatar: undefined });
  });

  it('keeps working when the server sends nulls, strings and fields it did not before', () => {
    const payload = {
      ...basePayload,
      categories: null,
      commentCount: '3',
      likeCount: '7',
      listIsPublic: false,
      listUpdatedAt: '2026-09-03T10:00:00.000Z',
      locationPlaceCardsCount: '2',
      media: JSON.stringify([{ type: 'photo', url: 'https://cdn.example.com/b.jpg' }]),
      publishedAt: '2026-09-04T10:00:00.000Z',
      rating: 'not-a-number',
      somethingNew: { nested: true },
      viewerHasLiked: true,
    } as PlaceFeedCardPayload;

    const item = mapPlaceFeedCard(payload, 'viewer-1');

    expect(item.listIsPublic).toBe(false);
    expect(item.memberships[0]?.updatedAt).toBe('2026-09-03T10:00:00.000Z');
    expect(item.locationPlaceCardsCount).toBe(2);
    expect(item.sortTime).toBe(new Date('2026-09-04T10:00:00.000Z').getTime());
    expect(item.place).toMatchObject({
      commentCount: 3,
      likedBy: ['viewer-1'],
      likes: 7,
      photos: ['https://cdn.example.com/b.jpg'],
    });
    expect(item.place.rating).toBeUndefined();
    expect(item.place.categories).toBeUndefined();
    expect(item.place).not.toHaveProperty('somethingNew');
  });

  it('does not credit a like without a viewer, and leaves the owner out when the row has none', () => {
    expect(mapPlaceFeedCard({ ...basePayload, viewerHasLiked: true }, null).place.likedBy).toBeUndefined();
    expect(mapPayloadOwner({ ownerId: '' })).toBeNull();

    const ownerless = mapPlaceFeedCard({ ...basePayload, ownerId: '' }, 'viewer-1');
    expect(ownerless.owner).toBeNull();
    expect(ownerless.place.addedBy).toBeUndefined();
  });
});
