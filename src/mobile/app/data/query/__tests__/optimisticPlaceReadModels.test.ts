import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import {
  inferOptimisticPlaceLikeState,
  updatePlaceReadModelCaches,
} from '@/mobile/app/data/query/optimisticPlaceReadModels';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';

const createdAt = '2026-07-31T12:00:00.000Z';

function createPlace(id: string): Place {
  return { id, name: id, lat: 41, lng: 29, addedAt: createdAt, updatedAt: createdAt };
}

function createLikedPlace(id: string): Place {
  return { ...createPlace(id), likedBy: ['viewer'], likes: 1 };
}

function createList(id: string, places: Place[]): PlaceList {
  return {
    id,
    userId: 'owner',
    name: id,
    places,
    isPublic: true,
    createdAt,
    updatedAt: createdAt,
  };
}

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function createFeedItem(place: Place) {
  return {
    key: `list:${place.id}`,
    listId: 'list',
    listIsPublic: true,
    listName: 'List',
    memberships: [],
    ownerId: 'owner',
    place,
    sortTime: 1,
  };
}

describe('optimisticPlaceReadModels', () => {
  it('updates feed, explore, profile, and list-detail caches together', () => {
    const queryClient = createClient();
    const target = createPlace('target');
    const other = createPlace('other');
    const targetItem = createFeedItem(target);
    const otherItem = createFeedItem(other);

    queryClient.setQueryData(queryKeys.feed.page('viewer'), {
      pageParams: [null],
      pages: [{ items: [targetItem, otherItem] }],
    });
    queryClient.setQueryData(queryKeys.explore.page('viewer', 'all', ''), {
      pageParams: [null],
      pages: [{ listItems: [], placeItems: [targetItem, otherItem], userItems: [] }],
    });
    queryClient.setQueryData(queryKeys.profile.content('viewer', 'owner', 'places'), {
      pageParams: [null],
      pages: [{
        lists: [createList('list', [target, other])],
        places: [targetItem, otherItem],
      }],
    });
    queryClient.setQueryData(queryKeys.list.places('viewer', 'list'), {
      pageParams: [null],
      pages: [{ items: [target, other] }],
    });

    updatePlaceReadModelCaches(queryClient, 'target', (place) => ({
      ...place,
      likedBy: ['viewer'],
      likes: 1,
    }));

    expect(queryClient.getQueryData(queryKeys.feed.page('viewer'))).toMatchObject({
      pages: [{ items: [{ place: { id: 'target', likes: 1 } }, { place: { id: 'other' } }] }],
    });
    expect(queryClient.getQueryData(queryKeys.explore.page('viewer', 'all', ''))).toMatchObject({
      pages: [{
        placeItems: [{ place: { id: 'target', likes: 1 } }, { place: { id: 'other' } }],
      }],
    });
    expect(queryClient.getQueryData(queryKeys.profile.content('viewer', 'owner', 'places'))).toMatchObject({
      pages: [{
        lists: [{ places: [{ id: 'target', likes: 1 }, { id: 'other' }] }],
        places: [{ place: { id: 'target', likes: 1 } }, { place: { id: 'other' } }],
      }],
    });
    expect(queryClient.getQueryData(queryKeys.list.places('viewer', 'list'))).toMatchObject({
      pages: [{ items: [{ id: 'target', likes: 1 }, { id: 'other' }] }],
    });
  });

  it.each([
    ['infinite visible lists', queryKeys.visibleData.lists('viewer'), {
      pageParams: [0], pages: [[createList('list', [createLikedPlace('target')])]],
    }],
    ['visible context', queryKeys.visibleData.context('viewer'), {
      lists: [createList('list', [createLikedPlace('target')])],
    }],
    ['list detail', queryKeys.list.places('viewer', 'list'), {
      pageParams: [null], pages: [{ items: [createLikedPlace('target')] }],
    }],
    ['explore', queryKeys.explore.page('viewer', 'all', ''), {
      pageParams: [null],
      pages: [{ listItems: [], placeItems: [createFeedItem(createLikedPlace('target'))], userItems: [] }],
    }],
    ['profile', queryKeys.profile.content('viewer', 'owner', 'places'), {
      pageParams: [null],
      pages: [{ lists: [], places: [createFeedItem(createLikedPlace('target'))] }],
    }],
  ])('infers a liked place from %s', (_label, queryKey, data) => {
    const queryClient = createClient();
    queryClient.setQueryData(queryKey, data);

    expect(inferOptimisticPlaceLikeState(queryClient, {
      placeId: 'target',
      userId: 'viewer',
    })).toBe(true);
  });

  it('ignores malformed cache records and returns false when the place is absent', () => {
    const queryClient = createClient();
    const malformedValues = [
      null,
      [],
      {},
      { pages: [], pageParams: null },
      { pages: [[{}]], pageParams: [] },
      { pages: [{ items: [null] }], pageParams: [] },
      { pages: [{}], pageParams: [] },
    ];

    malformedValues.forEach((value, index) => {
      queryClient.setQueryData([...queryKeys.feed.all, `bad-${index}`], value);
      queryClient.setQueryData([...queryKeys.explore.all, `bad-${index}`], value);
      queryClient.setQueryData([...queryKeys.profile.all, `bad-${index}`], value);
      queryClient.setQueryData([...queryKeys.list.all, 'places', `bad-${index}`], value);
      queryClient.setQueryData([...queryKeys.visibleData.all, `bad-${index}`], value);
    });

    expect(() => updatePlaceReadModelCaches(queryClient, 'missing', (place) => place)).not.toThrow();
    expect(inferOptimisticPlaceLikeState(queryClient, {
      placeId: 'missing',
      userId: 'viewer',
    })).toBe(false);
  });
});
