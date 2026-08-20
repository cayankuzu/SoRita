import { describe, expect, it } from 'vitest';

import { queryKeys } from '@/mobile/app/data/query/queryKeys';

describe('queryKeys', () => {
  it('normalizes optional identity and paging inputs deterministically', () => {
    expect(queryKeys.accountAvailability.email('ada@example.com')).toEqual([
      'accountAvailability',
      'email',
      'ada@example.com',
      null,
    ]);
    expect(queryKeys.accountAvailability.username('ada', 'viewer-1')).toEqual([
      'accountAvailability',
      'username',
      'ada',
      'viewer-1',
    ]);
    expect(queryKeys.notifications.page('viewer-1')).toEqual([
      'notifications',
      'page',
      'viewer-1',
      'all',
    ]);
    expect(queryKeys.notifications.page('viewer-1', 'likes')).toEqual([
      'notifications',
      'page',
      'viewer-1',
      'likes',
    ]);
    expect(queryKeys.feed.page('viewer-1')).toEqual([
      'feed',
      'page',
      'viewer-1',
      'server-v1',
    ]);
    expect(queryKeys.feed.page('viewer-1', 'server-v2')).toEqual([
      'feed',
      'page',
      'viewer-1',
      'server-v2',
    ]);
  });

  it('keeps explore filters stable for absent and populated values', () => {
    expect(queryKeys.explore.page('viewer-1', 'places', 'kahve')).toEqual([
      'explore',
      'page',
      'viewer-1',
      'places',
      'kahve',
      null,
    ]);
    expect(
      queryKeys.explore.page('viewer-1', 'places', 'kahve', {
        openNow: true,
        price: 2,
      }),
    ).toEqual([
      'explore',
      'page',
      'viewer-1',
      'places',
      'kahve',
      JSON.stringify({ openNow: true, price: 2 }),
    ]);
  });

  it('normalizes map location precision and optional labels', () => {
    expect(queryKeys.map.locationCards('viewer-1', 41.0123456, 29.0123456)).toEqual([
      'map',
      'location-cards',
      'viewer-1',
      '41.01235',
      '29.01235',
      null,
      null,
    ]);
    expect(
      queryKeys.map.locationCards('viewer-1', 41, 29, 'owner-1', '  İSTANBUL  '),
    ).toEqual([
      'map',
      'location-cards',
      'viewer-1',
      '41.00000',
      '29.00000',
      'owner-1',
      'istanbul',
    ]);
    expect(queryKeys.map.locationCards('viewer-1', 41, 29, '', '   ').slice(-2)).toEqual([
      null,
      null,
    ]);
  });

  it('normalizes absent and explicit visible-list filters', () => {
    expect(queryKeys.visibleData.lists('viewer-1')).toEqual([
      'visibleData',
      'lists',
      'viewer-1',
      null,
      null,
      false,
      false,
      null,
      null,
    ]);
    expect(
      queryKeys.visibleData.lists('viewer-1', {
        includePlaceComments: true,
        listId: 'list-1',
        ownerId: 'owner-1',
        pageSize: 20,
        publicOnly: true,
        scope: 'profile',
      }),
    ).toEqual([
      'visibleData',
      'lists',
      'viewer-1',
      'owner-1',
      'list-1',
      true,
      true,
      20,
      'profile',
    ]);
    expect(
      queryKeys.visibleData.lists('viewer-1', {
        includePlaceComments: null,
        pageSize: 0,
        publicOnly: false,
        scope: '',
      }).slice(-4),
    ).toEqual([false, false, null, null]);
  });
});
