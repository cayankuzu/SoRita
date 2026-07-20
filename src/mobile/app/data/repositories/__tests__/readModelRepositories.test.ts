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

  it('maps sparse feed rows, array media, invalid metadata, cursors, and abort signals', async () => {
    const rows = [
      {
        feed_item_id: 'feed-sparse', published_at: '', owner_id: 'owner-sparse',
        owner_name: 'Sparse', owner_username: 'sparse', owner_profile_photo_url: null,
        list_id: 'list-sparse', list_name: 'Sparse list', list_emoji: null,
        list_cover_image_url: null, list_is_public: false, place_id: 'place-sparse',
        place_name: 'Sparse place', place_title: null, menu_url: null, lat: 1, lng: 2,
        address: null, notes: null, rating: 'bad', category: null, categories: [],
        student_discount: null, price_range: null, price_min: 'bad', price_max: 12,
        best_time: null, best_times: [], atmosphere: [], special_features: [],
        added_at: isoA, updated_at: isoB,
        media: [{ type: 'photo', url: 'https://cdn.example.com/array.jpg' }],
        like_count: 4, comment_count: null, viewer_has_liked: false,
      },
      {
        feed_item_id: 'feed-invalid-media', published_at: isoA, owner_id: 'owner-2',
        owner_name: 'Owner 2', owner_username: 'owner2',
        owner_profile_photo_url: 'https://cdn.example.com/owner.jpg',
        list_id: 'list-2', list_name: 'List 2', list_emoji: 'pin',
        list_cover_image_url: 'https://cdn.example.com/cover.jpg', list_is_public: true,
        place_id: 'place-2', place_name: 'Place 2', place_title: 'Title',
        menu_url: 'https://menu.example.com', lat: 3, lng: 4, address: 'Address',
        notes: 'Notes', rating: 5, category: 'Cafe', categories: ['coffee'],
        student_discount: true, price_range: '2', price_min: 1, price_max: '3',
        best_time: 'morning', best_times: ['morning'], atmosphere: ['calm'],
        special_features: ['wifi'], added_at: isoA, updated_at: isoB, media: '{broken',
        like_count: 'bad', comment_count: '2', viewer_has_liked: true,
      },
    ];
    const signal = new AbortController().signal;
    const request = Promise.resolve({ data: rows, error: null }) as Promise<{
      data: typeof rows;
      error: null;
    }> & { abortSignal: ReturnType<typeof vi.fn> };
    request.abortSignal = vi.fn(() => request);
    rpcMock.mockReturnValue(request);

    const page = await fetchHomeFeedPage({
      cursor: { id: 'cursor-id', publishedAt: isoA }, limit: 5, signal, viewerId: 'viewer',
    });

    expect(request.abortSignal).toHaveBeenCalledWith(signal);
    expect(rpcMock).toHaveBeenCalledWith('feed_page', {
      p_cursor_id: 'cursor-id', p_cursor_published_at: isoA, p_limit: 5,
    });
    expect(page.nextCursor).toBeUndefined();
    expect(page.items[0]).toMatchObject({
      listEmoji: undefined, listCoverImage: undefined, sortTime: Date.parse(isoB),
      owner: { profilePhoto: undefined },
      place: {
        title: undefined, menuUrl: undefined, address: undefined, notes: undefined,
        rating: undefined, categories: undefined, studentDiscount: false,
        priceMin: undefined, priceMax: 12, media: [{ type: 'photo' }],
        photos: ['https://cdn.example.com/array.jpg'], likes: 4, commentCount: 0,
        likedBy: undefined, addedBy: { userAvatar: undefined },
      },
    });
    expect(page.items[1]?.place).toMatchObject({
      media: [], likes: 0, commentCount: 2, likedBy: ['viewer'], rating: 5,
      categories: ['coffee'], bestTimes: ['morning'], atmosphere: ['calm'],
      specialFeatures: ['wifi'],
    });

    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    await expect(fetchHomeFeedPage({ viewerId: 'viewer' })).resolves.toEqual({
      items: [], nextCursor: undefined,
    });
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

  it('normalizes sparse list details and propagates header and place errors', async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: [{
          created_at: isoA, list_cover_image_url: null, list_description: null,
          list_emoji: null, list_id: 'sparse-list', list_is_public: true,
          list_name: 'Sparse', owner_id: 'owner', owner_name: 'Owner',
          owner_profile_photo_url: 'https://cdn.example.com/owner.jpg',
          owner_username: 'owner', place_count: 'bad', updated_at: isoB,
          like_count: 3, viewer_has_liked: false,
        }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{
          place_id: 'sparse-place', added_at: isoA, updated_at: isoB,
          place_name: 'Sparse place', place_title: null, menu_url: null,
          lat: 1, lng: 2, address: null, notes: null, rating: 4,
          category: null, categories: [], student_discount: null,
          price_range: 'bad', price_min: 2, price_max: null, best_time: null,
          best_times: [], atmosphere: [], special_features: [], media: null,
          like_count: null, comment_count: 'bad', viewer_has_liked: true,
        }, {
          place_id: 'invalid-media', added_at: isoA, updated_at: isoB,
          place_name: 'Invalid media', lat: 3, lng: 4, media: '{broken',
          like_count: 0, comment_count: 1, viewer_has_liked: true,
        }],
        error: null,
      });

    await expect(fetchListDetailHeader('sparse-list')).resolves.toMatchObject({
      owner: { profilePhoto: 'https://cdn.example.com/owner.jpg' },
      placeCount: 0,
      list: {
        description: undefined, emoji: undefined, coverImage: undefined,
        likes: 3, likedBy: undefined,
      },
    });
    const page = await fetchListPlacesPage({ listId: 'sparse-list' });
    expect(page.nextCursor).toBeUndefined();
    expect(page.items[0]).toMatchObject({
      title: undefined, menuUrl: undefined, address: undefined, notes: undefined,
      rating: 4, category: undefined, categories: undefined, studentDiscount: false,
      priceRange: undefined, priceMin: 2, priceMax: undefined, bestTime: undefined,
      bestTimes: undefined, atmosphere: undefined, specialFeatures: undefined,
      media: [], photos: [], likes: 0, likedBy: undefined, commentCount: 0,
    });
    expect(page.items[1]?.media).toEqual([]);

    const headerError = new Error('header failed');
    rpcMock.mockResolvedValueOnce({ data: null, error: headerError });
    await expect(fetchListDetailHeader('sparse-list')).rejects.toThrow(headerError);
    const placesError = new Error('places failed');
    rpcMock.mockResolvedValueOnce({ data: null, error: placesError });
    await expect(fetchListPlacesPage({ listId: 'sparse-list' })).rejects.toThrow(placesError);
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

  it('applies explore defaults, aborts requests, and maps sparse/malformed rows safely', async () => {
    const abortSignal = new AbortController().signal;
    const response = Promise.resolve({
      data: [
        {
          item_id: 'list-empty', kind: 'list', rank: 3,
          item: {
            id: 'list-empty', name: '', ownerId: '', ownerName: null, ownerUsername: null,
            isPublic: false, updatedAt: null, description: null, emoji: null, coverImageUrl: null,
          },
        },
        {
          item_id: 'place-array', kind: 'place', rank: 2,
          item: createPlacePayload({
            address: null, atmosphere: [], bestTime: null, bestTimes: [], categories: [], category: null,
            commentCount: null, likeCount: 'bad', listCoverImageUrl: null, listEmoji: null,
            listIsPublic: false, listUpdatedAt: null, media: [{ url: 'https://cdn.example.com/a.jpg' }],
            menuUrl: null, notes: null, ownerId: '', ownerName: null, ownerProfilePhotoUrl: null,
            ownerUsername: null, placeTitle: null, priceMax: null, priceMin: 'bad', priceRange: null,
            rating: null, specialFeatures: [], studentDiscount: false, viewerHasLiked: false,
          }),
        },
        {
          item_id: 'place-bad-media', kind: 'place', rank: 'bad',
          item: createPlacePayload({ media: '{bad', ownerId: 'owner-2' }),
        },
        {
          item_id: 'user-empty', kind: 'user', rank: 1,
          item: { id: 'user-empty', name: '', username: '', bio: null, profilePhotoUrl: null, isPublicAccount: true },
        },
        { item_id: 'invalid-place', kind: 'place', rank: 0, item: '' },
        { item_id: 'invalid-user', kind: 'user', rank: 0, item: null },
        { item_id: 'unknown-kind', kind: 'other', rank: 0, item: {} },
      ],
      error: null,
    }) as Promise<{ data: unknown[]; error: null }> & { abortSignal: ReturnType<typeof vi.fn> };
    response.abortSignal = vi.fn(() => response);
    rpcMock.mockReturnValue(response);

    const page = await fetchExplorePage({ abortSignal, viewerId: 'viewer-1' });
    expect(response.abortSignal).toHaveBeenCalledWith(abortSignal);
    expect(rpcMock).toHaveBeenCalledWith('explore_page', {
      p_cursor_id: null, p_cursor_rank: null, p_kind: 'all', p_limit: 20, p_query: '',
    });
    expect(page.listItems[0]).toMatchObject({
      owner: null,
      list: { id: 'list-empty', isPublic: false, createdAt: new Date(0).toISOString() },
    });
    expect(page.placeItems[0]).toMatchObject({
      owner: null,
      listIsPublic: false,
      place: { media: [{ type: 'photo', url: 'https://cdn.example.com/a.jpg' }], likes: 0, commentCount: 0 },
    });
    expect(page.placeItems[1]?.place.media).toEqual([]);
    expect(page.userItems[0]).toMatchObject({ isPublicAccount: true, bio: undefined, profilePhoto: undefined });
    expect(page.nextCursor).toBeUndefined();
  });

  it('returns empty read-model pages and propagates explore/profile RPC failures', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    await expect(fetchExplorePage({
      cursor: { id: 'cursor', rank: 5 }, kind: 'users', limit: 2, query: 'ada', viewerId: 'viewer',
    })).resolves.toEqual({ listItems: [], placeItems: [], userItems: [], nextCursor: undefined });
    expect(rpcMock).toHaveBeenLastCalledWith('explore_page', {
      p_cursor_id: 'cursor', p_cursor_rank: 5, p_kind: 'users', p_limit: 2, p_query: 'ada',
    });

    const exploreError = new Error('explore failed');
    rpcMock.mockResolvedValueOnce({ data: null, error: exploreError });
    await expect(fetchExplorePage({ viewerId: 'viewer' })).rejects.toThrow(exploreError);

    const profileError = new Error('profile failed');
    rpcMock.mockResolvedValueOnce({ data: null, error: profileError });
    await expect(fetchProfileSummary('user')).rejects.toThrow(profileError);
    rpcMock.mockResolvedValueOnce({ data: null, error: profileError });
    await expect(fetchProfileContentPage({ tab: 'lists', userId: 'user' })).rejects.toThrow(profileError);
  });

  it('maps profile summary defaults and sparse profile list/place content', async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: [{
          id: 'user-2', name: '', username: '', can_view_content: false,
          follower_count: 'bad', following_count: null, list_count: undefined, place_count: '0',
          is_blocked_by_viewer: true, is_blocking_viewer: false, is_public_account: true,
          profile_photo_url: null, cover_photo_url: null, bio: null, interests: [],
          viewer_has_followed: false, viewer_has_pending_follow_request: true,
        }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            item_id: 'list-sparse', sort_at: isoB,
            item: JSON.stringify({
              type: 'list', id: 'list-sparse', ownerId: 'user-2', name: 'Sparse',
              description: null, emoji: null, coverImageUrl: null, createdAt: null, updatedAt: null,
              isPublic: false, likeCount: 'bad', viewerHasLiked: false,
            }),
          },
          {
            item_id: 'place-sparse', sort_at: isoA,
            item: {
              ...createPlacePayload({
                type: 'place', ownerId: 'user-2', ownerName: null, ownerUsername: null,
                ownerProfilePhotoUrl: null, media: null, categories: [], bestTimes: [], atmosphere: [],
                specialFeatures: [], listIsPublic: false, listUpdatedAt: null, listEmoji: null,
                listCoverImageUrl: null, viewerHasLiked: false, commentCount: 'bad', likeCount: null,
              }),
            },
          },
          { item_id: 'missing', sort_at: isoA, item: null },
          { item_id: 'unknown', sort_at: isoA, item: { type: 'unknown' } },
        ],
        error: null,
      });

    await expect(fetchProfileSummary('user-2')).resolves.toEqual({
      canViewContent: false,
      followerCount: 0,
      followingCount: 0,
      isBlockedByViewer: true,
      isBlockingViewer: false,
      listCount: 0,
      placeCount: 0,
      user: {
        id: 'user-2', email: '', name: '', username: '', isPublicAccount: true,
        profilePhoto: undefined, coverPhoto: undefined, bio: undefined, interests: undefined,
      },
      viewerHasFollowed: false,
      viewerHasPendingFollowRequest: true,
    });
    const content = await fetchProfileContentPage({ limit: 10, tab: 'places', userId: 'user-2' });
    expect(content.lists[0]).toMatchObject({
      id: 'list-sparse', isPublic: false, likes: 0, likedBy: undefined,
      createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
    });
    expect(content.places[0]).toMatchObject({
      listIsPublic: false,
      place: { media: [], photos: [], likes: 0, likedBy: undefined, commentCount: 0 },
      owner: { id: 'user-2', name: '', username: '' },
    });
    expect(content.nextCursor).toBeUndefined();
  });

  it('forwards AbortSignal through both profile RPC read models', async () => {
    const signal = new AbortController().signal;
    for (const invoke of [
      () => fetchProfileSummary('user-1', signal),
      () => fetchProfileContentPage({ signal, tab: 'gallery' as const, userId: 'user-1' }),
    ]) {
      const response = Promise.resolve({ data: [], error: null }) as Promise<{ data: never[]; error: null }> & {
        abortSignal: ReturnType<typeof vi.fn>;
      };
      response.abortSignal = vi.fn(() => response);
      rpcMock.mockReturnValueOnce(response);
      await invoke();
      expect(response.abortSignal).toHaveBeenCalledWith(signal);
    }
  });
});
