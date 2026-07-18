import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchExplorePage } from '@/mobile/app/data/repositories/exploreRepository';
import { fetchHomeFeedPage } from '@/mobile/app/data/repositories/homeFeedRepository';
import {
  fetchListDetailHeader,
  fetchListPlacesPage,
} from '@/mobile/app/data/repositories/listDetailRepository';
import {
  fetchProfileContentPage,
  fetchProfileSummary,
} from '@/mobile/app/data/repositories/profileRepository';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

const mediaJson = JSON.stringify([
  { type: 'photo', url: 'https://cdn.example.com/photo.jpg' },
  { mimeType: 'video/mp4', url: 'https://cdn.example.com/video.mp4' },
]);

const isoA = '2026-07-14T10:00:00.000Z';
const isoB = '2026-07-15T10:00:00.000Z';

function createPlacePayload(overrides: Record<string, unknown> = {}) {
  return {
    addedAt: isoA,
    address: 'Istiklal Cd.',
    atmosphere: ['calm'],
    bestTime: 'evening',
    bestTimes: ['evening'],
    categories: ['coffee'],
    category: 'Cafe',
    commentCount: '3',
    lat: 41.01,
    likeCount: '7',
    listCoverImageUrl: 'https://cdn.example.com/list.jpg',
    listEmoji: 'coffee',
    listId: 'list-1',
    listIsPublic: true,
    listName: 'Coffee',
    listUpdatedAt: isoB,
    lng: 29.01,
    media: mediaJson,
    menuUrl: 'https://menu.example.com',
    notes: 'Good espresso',
    ownerId: 'owner-1',
    ownerName: 'Ada',
    ownerProfilePhotoUrl: 'https://cdn.example.com/profile.jpg',
    ownerUsername: 'ada',
    placeId: 'place-1',
    placeName: 'Roastery',
    placeTitle: 'Best table',
    priceMax: '20',
    priceMin: '10',
    priceRange: '2',
    rating: '4.5',
    specialFeatures: ['wifi'],
    studentDiscount: true,
    updatedAt: isoB,
    viewerHasLiked: true,
    ...overrides,
  };
}

describe('read model repositories', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('maps explore pages and cursors from mixed RPC rows', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          item_id: 'list-1',
          kind: 'list',
          rank: '10',
          item: {
            coverImageUrl: 'https://cdn.example.com/list.jpg',
            description: 'Saved cafes',
            emoji: 'coffee',
            id: 'list-1',
            isPublic: true,
            name: 'Coffee',
            ownerId: 'owner-1',
            ownerName: 'Ada',
            ownerProfilePhotoUrl: 'https://cdn.example.com/profile.jpg',
            ownerUsername: 'ada',
            updatedAt: isoB,
          },
        },
        {
          item_id: 'place-1',
          kind: 'place',
          rank: 9,
          item: JSON.stringify(createPlacePayload()),
        },
        {
          item_id: 'user-1',
          kind: 'user',
          rank: 8,
          item: {
            bio: 'Coffee guide',
            id: 'user-1',
            isPublicAccount: false,
            name: 'Mina',
            profilePhotoUrl: 'https://cdn.example.com/mina.jpg',
            username: 'mina',
          },
        },
        {
          item_id: 'broken',
          kind: 'list',
          rank: 'not-a-number',
          item: '{broken',
        },
      ],
      error: null,
    });

    const page = await fetchExplorePage({
      kind: 'all',
      limit: 4,
      query: 'coffee',
      viewerId: 'viewer-1',
    });

    expect(rpcMock).toHaveBeenCalledWith('explore_page', {
      p_cursor_id: null,
      p_cursor_rank: null,
      p_kind: 'all',
      p_limit: 4,
      p_query: 'coffee',
    });
    expect(page.listItems).toHaveLength(1);
    expect(page.listItems[0]?.owner?.username).toBe('ada');
    expect(page.placeItems[0]?.place.photos).toEqual(['https://cdn.example.com/photo.jpg']);
    expect(page.placeItems[0]?.place.likedBy).toEqual(['viewer-1']);
    expect(page.userItems[0]).toMatchObject({
      id: 'user-1',
      isPublicAccount: false,
      username: 'mina',
    });
    expect(page.nextCursor).toEqual({ id: 'broken', rank: 0 });
  });

  it('maps home feed pages and propagates RPC errors', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          ...createPlacePayload({
            feed_item_id: 'feed-1',
            item_id: undefined,
            published_at: isoB,
            owner_id: 'owner-1',
            owner_name: 'Ada',
            owner_username: 'ada',
            owner_profile_photo_url: 'https://cdn.example.com/profile.jpg',
            list_id: 'list-1',
            list_name: 'Coffee',
            list_emoji: 'coffee',
            list_cover_image_url: 'https://cdn.example.com/list.jpg',
            list_is_public: true,
            place_id: 'place-1',
            place_name: 'Roastery',
            place_title: 'Best table',
            menu_url: 'https://menu.example.com',
            added_at: isoA,
            updated_at: isoB,
            like_count: '2',
            comment_count: '1',
            viewer_has_liked: true,
          }),
        },
      ],
      error: null,
    });

    const page = await fetchHomeFeedPage({
      limit: 1,
      viewerId: 'viewer-1',
    });

    expect(rpcMock).toHaveBeenCalledWith('feed_page', {
      p_cursor_id: null,
      p_cursor_published_at: null,
      p_limit: 1,
    });
    expect(page.items[0]?.key).toBe('list-1:place-1');
    expect(page.items[0]?.place.likes).toBe(2);
    expect(page.nextCursor).toEqual({ id: 'feed-1', publishedAt: isoB });

    const error = new Error('feed failed');
    rpcMock.mockResolvedValueOnce({ data: null, error });
    await expect(fetchHomeFeedPage({ viewerId: 'viewer-1' })).rejects.toThrow(error);
  });

  it('maps list detail headers and paged places', async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: [
          {
            created_at: isoA,
            list_cover_image_url: 'https://cdn.example.com/list.jpg',
            list_description: 'Favorite places',
            list_emoji: 'coffee',
            list_id: 'list-1',
            list_is_public: false,
            list_name: 'Coffee',
            owner_id: 'owner-1',
            owner_name: 'Ada',
            owner_profile_photo_url: null,
            owner_username: 'ada',
            place_count: '5',
            updated_at: isoB,
            like_count: '4',
            viewer_has_liked: true,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            added_at: isoA,
            categories: [],
            comment_count: '0',
            lat: 41.01,
            like_count: '1',
            lng: 29.01,
            media: [{ url: 'https://cdn.example.com/photo.jpg' }],
            place_id: 'place-1',
            place_name: 'Roastery',
            rating: 'not-a-number',
            student_discount: false,
            updated_at: isoB,
            viewer_has_liked: true,
          },
        ],
        error: null,
      });

    await expect(fetchListDetailHeader('list-1')).resolves.toMatchObject({
      list: {
        id: 'list-1',
        isPublic: false,
        likedBy: ['owner-1'],
      },
      owner: {
        id: 'owner-1',
        username: 'ada',
      },
      placeCount: 5,
    });

    const placesPage = await fetchListPlacesPage({
      cursor: { addedAt: isoA, id: 'place-0' },
      limit: 1,
      listId: 'list-1',
      viewerId: 'viewer-1',
    });

    expect(rpcMock).toHaveBeenLastCalledWith('list_places_page', {
      p_cursor_added_at: isoA,
      p_cursor_id: 'place-0',
      p_limit: 1,
      p_list_id: 'list-1',
    });
    expect(placesPage.items[0]).toMatchObject({
      id: 'place-1',
      photos: ['https://cdn.example.com/photo.jpg'],
      likedBy: ['viewer-1'],
    });
    expect(placesPage.nextCursor).toEqual({ addedAt: isoA, id: 'place-1' });

    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await expect(fetchListDetailHeader('missing')).resolves.toBeNull();
  });

  it('maps profile summary and content pages', async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: [
          {
            bio: 'Coffee notes',
            can_view_content: true,
            cover_photo_url: 'https://cdn.example.com/cover.jpg',
            follower_count: '12',
            following_count: 3,
            id: 'user-1',
            interests: ['coffee'],
            is_blocked_by_viewer: false,
            is_blocking_viewer: true,
            is_public_account: false,
            list_count: '2',
            name: 'Mina',
            place_count: '9',
            profile_photo_url: 'https://cdn.example.com/profile.jpg',
            username: 'mina',
            viewer_has_followed: true,
            viewer_has_pending_follow_request: false,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            item_id: 'list-1',
            sort_at: isoB,
            item: {
              type: 'list',
              coverImageUrl: 'https://cdn.example.com/list.jpg',
              createdAt: isoA,
              id: 'list-1',
              isPublic: true,
              likeCount: '8',
              name: 'Coffee',
              ownerId: 'user-1',
              updatedAt: isoB,
              viewerHasLiked: true,
            },
          },
          {
            item_id: 'place-1',
            sort_at: isoA,
            item: JSON.stringify({
              ...createPlacePayload({
                ownerId: 'user-1',
                type: 'place',
              }),
            }),
          },
          {
            item_id: 'broken',
            sort_at: isoA,
            item: '{broken',
          },
        ],
        error: null,
      });

    await expect(fetchProfileSummary('user-1')).resolves.toMatchObject({
      canViewContent: true,
      followerCount: 12,
      isBlockingViewer: true,
      user: {
        id: 'user-1',
        isPublicAccount: false,
        interests: ['coffee'],
      },
      viewerHasFollowed: true,
    });

    const content = await fetchProfileContentPage({
      cursor: { id: 'old', sortAt: isoA },
      limit: 3,
      tab: 'gallery',
      userId: 'user-1',
      viewerId: 'viewer-1',
    });

    expect(rpcMock).toHaveBeenLastCalledWith('profile_content_page', {
      p_cursor: isoA,
      p_cursor_id: 'old',
      p_limit: 3,
      p_tab: 'gallery',
      p_user_id: 'user-1',
    });
    expect(content.lists[0]).toMatchObject({
      id: 'list-1',
      likedBy: ['viewer-1'],
    });
    expect(content.places[0]?.place.photos).toEqual(['https://cdn.example.com/photo.jpg']);
    expect(content.nextCursor).toEqual({ id: 'broken', sortAt: isoA });

    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await expect(fetchProfileSummary('missing')).resolves.toBeNull();
  });
});
