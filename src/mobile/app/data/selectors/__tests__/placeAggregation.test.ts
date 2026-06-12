import { describe, expect, it } from 'vitest';

import { buildPlaceFeedCardItems } from '@/mobile/app/data/selectors/placeAggregation';
import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';

describe('buildPlaceFeedCardItems', () => {
  it('flattens places and sorts them by the place timestamp only', () => {
    const owner: User = {
      id: 'owner',
      email: 'owner@example.com',
      name: 'Owner',
      username: 'owner',
    };
    const lists: PlaceList[] = [
      {
        id: 'older',
        userId: owner.id,
        name: 'Older',
        isPublic: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-10T00:00:00.000Z',
        places: [
          {
            id: 'p1',
            name: 'A',
            lat: 1,
            lng: 1,
            addedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      },
      {
        id: 'newer',
        userId: owner.id,
        name: 'Newer',
        isPublic: false,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-04T00:00:00.000Z',
        places: [
          {
            id: 'p2',
            name: 'B',
            lat: 2,
            lng: 2,
            addedAt: '2025-01-03T00:00:00.000Z',
            updatedAt: '2025-01-05T00:00:00.000Z',
          },
        ],
      },
    ];

    const items = buildPlaceFeedCardItems(lists, () => owner);

    expect(items.map((item) => item.place.id)).toEqual(['p2', 'p1']);
    expect(items[0]).toMatchObject({
      key: 'newer:p2',
      ownerId: owner.id,
      listId: 'newer',
      listName: 'Newer',
      listIsPublic: false,
      owner,
    });
  });

  it('does not move old place cards forward when only the parent list updated', () => {
    const owner: User = {
      id: 'owner',
      email: 'owner@example.com',
      name: 'Owner',
      username: 'owner',
    };
    const lists: PlaceList[] = [
      {
        id: 'list-a',
        userId: owner.id,
        name: 'List A',
        isPublic: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-08T00:00:00.000Z',
        places: [
          {
            id: 'old-place',
            name: 'Old Place',
            lat: 1,
            lng: 1,
            addedAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-02T00:00:00.000Z',
          },
        ],
      },
      {
        id: 'list-b',
        userId: owner.id,
        name: 'List B',
        isPublic: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-03T00:00:00.000Z',
        places: [
          {
            id: 'new-place',
            name: 'New Place',
            lat: 2,
            lng: 2,
            addedAt: '2025-01-04T00:00:00.000Z',
            updatedAt: '2025-01-04T00:00:00.000Z',
          },
        ],
      },
    ];

    const items = buildPlaceFeedCardItems(lists, () => owner);

    expect(items.map((item) => item.place.id)).toEqual(['new-place', 'old-place']);
  });
});
