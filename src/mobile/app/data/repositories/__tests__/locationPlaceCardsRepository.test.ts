import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchLocationPlaceCardsPage } from '@/mobile/app/data/repositories/locationPlaceCardsRepository';

const { fetchProfileContentPageMock, rpcMock } = vi.hoisted(() => ({
  fetchProfileContentPageMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: { rpc: rpcMock },
}));

vi.mock('@/mobile/app/data/repositories/profileRepository', () => ({
  fetchProfileContentPage: fetchProfileContentPageMock,
}));

describe('locationPlaceCardsRepository', () => {
  beforeEach(() => {
    fetchProfileContentPageMock.mockReset();
    rpcMock.mockReset();
  });

  it('maps a cursor page and preserves the authoritative count and visibility', async () => {
    rpcMock.mockResolvedValue({
      data: [{
        added_at: '2026-08-16T10:00:00.000Z',
        has_private_list: true,
        has_public_list: true,
        lat: 41.01,
        like_count: '3',
        list_created_at: '2026-08-01T10:00:00.000Z',
        list_id: 'list-1',
        list_is_public: true,
        list_name: 'Kahve',
        list_owner_id: 'owner-1',
        list_updated_at: '2026-08-15T10:00:00.000Z',
        lng: 29.01,
        media: [{ type: 'photo', url: 'https://cdn.example/place.jpg' }],
        owner_name: 'Ada',
        owner_profile_photo_url: 'https://cdn.example/ada.jpg',
        owner_username: 'ada',
        place_id: 'place-1',
        place_name: 'Roastery',
        total_count: '21',
        updated_at: '2026-08-17T10:00:00.000Z',
        viewer_has_liked: true,
      }],
      error: null,
    });

    const page = await fetchLocationPlaceCardsPage({
      cursor: { id: 'place-0', updatedAt: '2026-08-18T10:00:00.000Z' },
      lat: 41.01,
      limit: 1,
      lng: 29.01,
      ownerId: 'owner-1',
      placeName: ' Roastery ',
      viewerId: 'viewer-1',
    });

    expect(rpcMock).toHaveBeenCalledWith('location_place_cards_page', {
      p_cursor_id: 'place-0',
      p_cursor_updated_at: '2026-08-18T10:00:00.000Z',
      p_lat: 41.01,
      p_limit: 1,
      p_lng: 29.01,
      p_owner_id: 'owner-1',
      p_place_name: 'Roastery',
    });
    expect(page).toMatchObject({
      markerVisibility: 'mixed',
      nextCursor: { id: 'place-1', updatedAt: '2026-08-17T10:00:00.000Z' },
      totalCount: 21,
    });
    expect(page.items[0]).toMatchObject({
      list: { id: 'list-1', places: [{ id: 'place-1' }] },
      owner: { id: 'owner-1', username: 'ada' },
      place: { id: 'place-1', likedBy: ['viewer-1'] },
    });
  });

  it('propagates read-model errors', async () => {
    const error = new Error('location read failed');
    rpcMock.mockResolvedValue({ data: null, error });

    await expect(fetchLocationPlaceCardsPage({ lat: 1, lng: 2 })).rejects.toBe(error);
  });

  it('falls back to the deployed profile read model when the location RPC is missing', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST202',
        message: 'Could not find the function public.location_place_cards_page',
      },
    });
    fetchProfileContentPageMock.mockResolvedValue({
      lists: [],
      places: [
        {
          key: 'list-1:place-1',
          listId: 'list-1',
          listIsPublic: true,
          listName: 'Kahve',
          locationPlaceCardsCount: 2,
          memberships: [
            {
              listId: 'list-1',
              listIsPublic: true,
              listName: 'Kahve',
              updatedAt: '2026-08-18T10:00:00.000Z',
            },
          ],
          owner: {
            email: '',
            id: 'owner-1',
            name: 'Ada',
            username: 'ada',
          },
          ownerId: 'owner-1',
          place: {
            addedAt: '2026-08-17T10:00:00.000Z',
            id: 'place-1',
            lat: 41.01,
            lng: 29.01,
            name: 'Roastery',
            updatedAt: '2026-08-18T10:00:00.000Z',
          },
          sortTime: 1,
        },
        {
          key: 'list-2:place-2',
          listId: 'list-2',
          listIsPublic: false,
          listName: 'Favoriler',
          locationPlaceCardsCount: 2,
          memberships: [],
          owner: {
            email: '',
            id: 'owner-1',
            name: 'Ada',
            username: 'ada',
          },
          ownerId: 'owner-1',
          place: {
            addedAt: '2026-08-16T10:00:00.000Z',
            id: 'place-2',
            lat: 41.010001,
            lng: 29.010001,
            name: 'Roastery',
            updatedAt: '2026-08-17T10:00:00.000Z',
          },
          sortTime: 0,
        },
      ],
    });

    const page = await fetchLocationPlaceCardsPage({
      lat: 41.01,
      lng: 29.01,
      ownerId: 'owner-1',
      placeName: 'Roastery',
      viewerId: 'viewer-1',
    });

    expect(fetchProfileContentPageMock).toHaveBeenCalledWith({
      cursor: null,
      limit: 50,
      tab: 'places',
      userId: 'owner-1',
      viewerId: 'viewer-1',
    });
    expect(page).toMatchObject({
      markerVisibility: 'mixed',
      totalCount: 2,
    });
    expect(page.items.map(({ list }) => list.id)).toEqual(['list-1', 'list-2']);
  });
});
