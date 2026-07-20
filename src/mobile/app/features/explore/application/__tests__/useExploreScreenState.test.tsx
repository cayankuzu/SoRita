import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook } from '@/mobile/app/test/hookTestUtils';

const useVisibleDataQueryMock = vi.fn();
const useExploreQueryMock = vi.fn();
const useFollowUserMutationMock = vi.fn();
const useFocusRefreshMock = vi.fn();

vi.mock('@/mobile/app/data/hooks/useExploreQuery', () => ({
  useExploreQuery: useExploreQueryMock,
}));

vi.mock('@/mobile/app/data/hooks/useVisibleDataQuery', () => ({
  useVisibleDataQuery: useVisibleDataQueryMock,
}));

vi.mock('@/mobile/app/data/hooks/useUserMutations', () => ({
  useFollowUserMutation: useFollowUserMutationMock,
}));

vi.mock('@/mobile/app/shared/hooks/useFocusRefresh', () => ({
  useFocusRefresh: useFocusRefreshMock,
}));

describe('useExploreScreenState', () => {
  beforeEach(() => {
    useVisibleDataQueryMock.mockReset();
    useExploreQueryMock.mockReset();
    useFollowUserMutationMock.mockReset();
    useFocusRefreshMock.mockReset();
  });

  it('filters discoverable content and follows users through the mutation layer', async () => {
    const followUserAsync = vi.fn().mockResolvedValue('following');
    const refetchMock = vi.fn().mockResolvedValue(undefined);
    const viewer = {
      id: 'viewer',
      email: 'viewer@example.com',
      name: 'Viewer',
      username: 'viewer',
      following: ['followed'],
      pendingFollowRequestsSent: ['pending'],
    };

    useExploreQueryMock.mockReturnValue({
      data: {
        pages: [{
          listItems: [{
            list: {
              id: 'public-list', userId: 'public-user', name: 'Coffee Run',
              description: 'Best coffee', isPublic: true,
              createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-03T00:00:00.000Z',
              places: [],
            },
            owner: { id: 'public-user', email: 'public@example.com', name: 'Public User', username: 'publicuser' },
          }],
          placeItems: [{
            key: 'place-1:public-list', ownerId: 'public-user', listId: 'public-list',
            listName: 'Coffee Run', memberships: [], sortTime: 2,
            place: { id: 'place-1', name: 'Coffee Spot', lat: 1, lng: 1, address: 'Ankara', photos: ['photo'], addedAt: '2025-01-02T00:00:00.000Z' },
          }],
          userItems: [{ id: 'public-user', email: 'public@example.com', name: 'Public User', username: 'publicuser', bio: 'great coffee', isPublicAccount: true }],
        }],
      },
      error: new Error('Network request failed'),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: refetchMock,
    });
    useVisibleDataQueryMock.mockReturnValue({
      data: {
        users: [
          viewer,
          { id: 'followed', email: 'followed@example.com', name: 'Followed', username: 'followed', bio: 'coffee friend' },
          { id: 'public-user', email: 'public@example.com', name: 'Public User', username: 'publicuser', bio: 'great coffee', isPublicAccount: true },
          { id: 'private-user', email: 'private@example.com', name: 'Private User', username: 'privateuser', isPublicAccount: false },
        ],
        lists: [
          {
            id: 'public-list',
            userId: 'public-user',
            name: 'Coffee Run',
            description: 'Best coffee',
            isPublic: true,
            likes: 10,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-03T00:00:00.000Z',
            places: [{ id: 'place-1', name: 'Coffee Spot', lat: 1, lng: 1, address: 'Ankara', photos: ['photo'], addedAt: '2025-01-02T00:00:00.000Z' }],
          },
          {
            id: 'followed-list',
            userId: 'followed',
            name: 'Followed Coffee',
            description: 'Saved coffee',
            isPublic: true,
            likes: 12,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-04T00:00:00.000Z',
            places: [{ id: 'place-2', name: 'Coffee House', lat: 2, lng: 2, address: 'Istanbul', photos: ['photo'], addedAt: '2025-01-04T00:00:00.000Z' }],
          },
          {
            id: 'private-list',
            userId: 'private-user',
            name: 'Secret',
            isPublic: true,
            likes: 5,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-02T00:00:00.000Z',
            places: [],
          },
        ],
      },
      error: new Error('Network request failed'),
      hasPartialDataError: true,
      refetch: refetchMock,
    });
    useFollowUserMutationMock.mockReturnValue({ mutateAsync: followUserAsync });
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/explore/application/useExploreScreenState');
    const hook = renderHook(() =>
      hooks.useExploreScreenState({
        activeTab: 'lists',
        user: viewer,
        searchQuery: 'coffee',
      }),
    );

    expect(hook.result.current.filteredUsers.map((item) => item.id)).toEqual(['public-user']);
    expect(hook.result.current.filteredListItems.map((item) => item.list.id)).toEqual(['public-list']);
    expect(hook.result.current.filteredPlaces.map((item) => item.place.id)).toEqual(['place-1']);
    expect(hook.result.current.filteredPhotos.map((item) => item.place.id)).toEqual(['place-1']);
    expect(hook.result.current.following).toEqual(['followed']);
      expect(hook.result.current.pendingFollowRequests).toEqual(['pending']);
      expect(hook.result.current.errorMessage).toBe(
        'İnternet bağlantısı şu an kullanılamıyor. Bağlantını kontrol edip tekrar dene.',
      );
      expect(hook.result.current.hasPartialDataError).toBe(true);

    await expect(hook.result.current.followUser('public-user')).resolves.toBe('following');
    expect(followUserAsync).toHaveBeenCalledWith({
      currentUserId: 'viewer',
      targetUserId: 'public-user',
    });

    await hook.result.current.onRefresh();
    await hook.result.current.retry();
    expect(refetchMock).toHaveBeenCalled();
  });

  it('handles empty sessions and blocks follow actions without an active user', async () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);

    useExploreQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    useVisibleDataQueryMock.mockReturnValue({
      data: {
        users: [
          { id: 'public-user', email: 'public@example.com', name: 'Public User', username: 'publicuser', bio: 'great coffee', isPublicAccount: true },
        ],
        lists: [
          {
            id: 'public-list',
            userId: 'public-user',
            name: 'Coffee Run',
            description: 'Best coffee',
            isPublic: true,
            likes: 10,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-03T00:00:00.000Z',
            places: [{ id: 'place-1', name: 'Coffee Spot', lat: 1, lng: 1, address: 'Ankara', photos: ['photo'], addedAt: '2025-01-02T00:00:00.000Z' }],
          },
        ],
      },
      error: null,
      hasPartialDataError: false,
      refetch: refetchMock,
    });
    useFollowUserMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/explore/application/useExploreScreenState');
    const hook = renderHook(() =>
      hooks.useExploreScreenState({
        activeTab: 'lists',
        user: null,
        searchQuery: '',
      }),
    );

    expect(hook.result.current.currentUser).toBeNull();
    expect(hook.result.current.filteredUsers).toEqual([]);
    expect(hook.result.current.filteredListItems).toEqual([]);
    expect(hook.result.current.filteredPlaces).toEqual([]);
    expect(hook.result.current.filteredPhotos).toEqual([]);
    expect(hook.result.current.following).toEqual([]);
    expect(hook.result.current.pendingFollowRequests).toEqual([]);
    expect(hook.result.current.errorMessage).toBeNull();

    await hook.result.current.onRefresh();
    expect(refetchMock).not.toHaveBeenCalled();
    await expect(hook.result.current.followUser('public-user')).rejects.toThrow(
      'Takip işlemi için aktif kullanıcı gerekli.',
    );
  });

  it('hydrates every read-model tab, filters duplicates, and exposes per-tab pagination', async () => {
    const viewer = {
      id: 'viewer', email: 'viewer@example.com', name: 'Viewer', username: 'viewer',
    };
    const owner = {
      id: 'owner', email: 'owner@example.com', name: 'Needle Owner', username: 'owner',
      bio: 'Guide', isPublicAccount: true,
    };
    const otherOwner = {
      id: 'other-owner', email: 'other@example.com', name: 'Other', username: 'other',
      bio: 'Needle bio', isPublicAccount: true,
    };
    const createPlaceItem = (overrides: Record<string, unknown> = {}) => ({
      key: 'place-key', owner, ownerId: owner.id, listId: 'list-1',
      listName: 'Ordinary list', listIsPublic: true,
      memberships: [{
        listId: 'membership-list', listName: 'Needle membership', listIsPublic: true,
        updatedAt: '2025-01-01T00:00:00.000Z',
      }],
      place: {
        id: 'place-1', name: 'Ordinary place', address: 'Ordinary address',
        notes: 'Ordinary notes', lat: 1, lng: 2, photos: [],
        addedAt: '2025-01-01T00:00:00.000Z',
      },
      sortTime: 1,
      ...overrides,
    });
    const fetchers = {
      lists: vi.fn().mockResolvedValue(undefined),
      photos: vi.fn().mockResolvedValue(undefined),
      places: vi.fn().mockResolvedValue(undefined),
      users: vi.fn().mockResolvedValue(undefined),
    };
    const emptyPage = { listItems: [], placeItems: [], userItems: [] };
    const queryByKind = {
      lists: {
        data: { pages: [{
          ...emptyPage,
          listItems: [
            {
              list: {
                id: 'list-1', userId: owner.id, name: 'Ordinary',
                description: 'Needle description', isPublic: true, places: [],
                createdAt: '2025-01-01T00:00:00.000Z', updatedAt: null,
              },
              owner,
            },
            {
              list: {
                id: 'viewer-list', userId: viewer.id, name: 'Needle own list',
                isPublic: true, places: [], createdAt: '2025-01-01T00:00:00.000Z',
                updatedAt: '2025-01-03T00:00:00.000Z',
              },
              owner: viewer,
            },
          ],
        }] },
        error: null, fetchNextPage: fetchers.lists, hasNextPage: true,
        isFetchingNextPage: false, isLoading: false,
        refetch: vi.fn().mockResolvedValue(undefined),
      },
      places: {
        data: { pages: [{
          ...emptyPage,
          placeItems: [
            createPlaceItem(),
            createPlaceItem({ key: 'place-key', sortTime: 5 }),
            createPlaceItem({ key: 'own-place', owner: viewer, ownerId: viewer.id }),
          ],
        }] },
        error: null, fetchNextPage: fetchers.places, hasNextPage: false,
        isFetchingNextPage: true, isLoading: false,
        refetch: vi.fn().mockResolvedValue(undefined),
      },
      photos: {
        data: { pages: [{
          ...emptyPage,
          placeItems: [
            createPlaceItem({
              key: 'photo-key',
              place: {
                id: 'photo-place', name: 'Needle photo place', lat: 1, lng: 2,
                media: [{ type: 'photo', url: 'https://cdn.example.com/photo.jpg' }],
                addedAt: '2025-01-01T00:00:00.000Z',
              },
              sortTime: 4,
            }),
            createPlaceItem({ key: 'no-media', sortTime: 3 }),
          ],
        }] },
        error: null, fetchNextPage: fetchers.photos, hasNextPage: true,
        isFetchingNextPage: true, isLoading: false,
        refetch: vi.fn().mockResolvedValue(undefined),
      },
      users: {
        data: { pages: [{ ...emptyPage, userItems: [otherOwner, owner, viewer, otherOwner] }] },
        error: null, fetchNextPage: fetchers.users, hasNextPage: false,
        isFetchingNextPage: false, isLoading: true,
        refetch: vi.fn().mockResolvedValue(undefined),
      },
    };

    useExploreQueryMock.mockImplementation(
      (_userId: string | undefined, _search: string, options: { kind: keyof typeof queryByKind }) =>
        queryByKind[options.kind],
    );
    useVisibleDataQueryMock.mockReturnValue({
      data: undefined, error: null, fetchNextPage: undefined, hasNextPage: false,
      hasPartialDataError: false, isFetchingNextPage: false, isLoading: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    useFollowUserMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: true,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/explore/application/useExploreScreenState');
    const renderTab = (activeTab: 'lists' | 'places' | 'photos' | 'people') =>
      renderHook(() => hooks.useExploreScreenState({ activeTab, user: viewer, searchQuery: 'needle' }));
    const listHook = renderTab('lists');
    const placeHook = renderTab('places');
    const photoHook = renderTab('photos');
    const peopleHook = renderTab('people');
    const invalidTabHook = renderHook(() =>
      hooks.useExploreScreenState({
        activeTab: 'invalid' as 'lists', user: viewer, searchQuery: 'needle',
      }),
    );

    expect(listHook.result.current.filteredListItems.map((item) => item.list.id)).toEqual(['list-1']);
    expect(listHook.result.current.fetchNextPage).toBe(fetchers.lists);
    expect(listHook.result.current.hasNextPage).toBe(true);
    expect(placeHook.result.current.filteredPlaces).toHaveLength(1);
    expect(placeHook.result.current.filteredPlaces[0]?.sortTime).toBe(5);
    expect(placeHook.result.current.isFetchingNextPage).toBe(true);
    expect(photoHook.result.current.filteredPhotos.map((item) => item.key)).toEqual(['photo-key']);
    expect(photoHook.result.current.hasNextPage).toBe(true);
    expect(peopleHook.result.current.filteredUsers.map((item) => item.id)).toEqual([
      otherOwner.id, owner.id,
    ]);
    expect(peopleHook.result.current.isInitialLoading).toBe(false);
    expect(invalidTabHook.result.current.filteredListItems).toHaveLength(1);
    expect(listHook.result.current.refreshing).toBe(true);
    expect(listHook.result.current.hasPartialDataError).toBe(false);
  });
});
