import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook } from '@/mobile/app/test/hookTestUtils';

const useVisibleDataQueryMock = vi.fn();
const useProfileReadModelQueryMock = vi.fn();
const useCreateListMutationMock = vi.fn();
const useDeleteListMutationMock = vi.fn();
const useUpdateListMutationMock = vi.fn();
const useUpdateListsMutationMock = vi.fn();
const useDeletePlaceMutationMock = vi.fn();
const useFocusRefreshMock = vi.fn();

vi.mock('@/mobile/app/data/hooks/useProfileReadModelQuery', () => ({
  useProfileReadModelQuery: useProfileReadModelQueryMock,
}));

vi.mock('@/mobile/app/data/hooks/useVisibleDataQuery', () => ({
  useVisibleDataQuery: useVisibleDataQueryMock,
}));

vi.mock('@/mobile/app/data/hooks/useListMutations', () => ({
  useCreateListMutation: useCreateListMutationMock,
  useDeleteListMutation: useDeleteListMutationMock,
  useUpdateListMutation: useUpdateListMutationMock,
  useUpdateListsMutation: useUpdateListsMutationMock,
}));

vi.mock('@/mobile/app/data/hooks/usePlaceMutations', () => ({
  useDeletePlaceMutation: useDeletePlaceMutationMock,
}));

vi.mock('@/mobile/app/shared/hooks/useFocusRefresh', () => ({
  useFocusRefresh: useFocusRefreshMock,
}));

describe('useOwnProfileScreenState', () => {
  beforeEach(() => {
    useVisibleDataQueryMock.mockReset();
    useProfileReadModelQueryMock.mockReset();
    useCreateListMutationMock.mockReset();
    useDeleteListMutationMock.mockReset();
    useUpdateListMutationMock.mockReset();
    useUpdateListsMutationMock.mockReset();
    useDeletePlaceMutationMock.mockReset();
    useFocusRefreshMock.mockReset();
  });

  it('derives own profile state and delegates list/place mutations', async () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);
    const createListAsync = vi.fn().mockResolvedValue(undefined);
    const deleteListAsync = vi.fn().mockResolvedValue(undefined);
    const updateListAsync = vi.fn().mockResolvedValue(undefined);
    const updateListsAsync = vi.fn().mockResolvedValue(undefined);
    const deletePlaceAsync = vi.fn().mockResolvedValue(undefined);
    const user = {
      id: 'viewer',
      email: 'viewer@example.com',
      name: 'Viewer',
      username: 'viewer',
      followers: ['follower'],
      following: ['following'],
    };
    const list = {
      id: 'list-1',
      userId: 'viewer',
      name: 'Favorites',
      isPublic: true,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
      places: [
        {
          id: 'place-1',
          name: 'Cafe',
          lat: 1,
          lng: 1,
          photos: ['photo-1'],
          addedAt: '2025-01-01T00:00:00.000Z',
        },
      ],
    };

    useProfileReadModelQueryMock.mockReturnValue({
      error: new Error('Network request failed'),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      hasPartialDataError: true,
      isFetchingNextPage: false,
      isLoading: false,
      lists: [{ ...list, places: [] }],
      places: [{
        key: 'place-1:list-1', listId: 'list-1', listIsPublic: true,
        ownerId: 'viewer', memberships: [], place: list.places[0], sortTime: 1,
      }],
      refetch: vi.fn().mockResolvedValue(undefined),
      summary: undefined,
    });
    useVisibleDataQueryMock.mockReturnValue({
      data: {
        users: [
          user,
          { id: 'follower', email: 'follower@example.com', name: 'Follower', username: 'follower' },
          { id: 'following', email: 'following@example.com', name: 'Following', username: 'following' },
        ],
        lists: [list],
      },
      error: new Error('Network request failed'),
      hasPartialDataError: true,
      refetch: refetchMock,
    });
    useCreateListMutationMock.mockReturnValue({ mutateAsync: createListAsync });
    useDeleteListMutationMock.mockReturnValue({ mutateAsync: deleteListAsync });
    useUpdateListMutationMock.mockReturnValue({ mutateAsync: updateListAsync });
    useUpdateListsMutationMock.mockReturnValue({ mutateAsync: updateListsAsync });
    useDeletePlaceMutationMock.mockReturnValue({ mutateAsync: deletePlaceAsync });
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/profile/application/useOwnProfileScreenState');
    const hook = renderHook(() => hooks.useOwnProfileScreenState({ user }));

    expect(hook.result.current.lists).toHaveLength(1);
    expect(hook.result.current.allPlaces).toHaveLength(1);
    expect(hook.result.current.allPhotos).toHaveLength(1);
    expect(hook.result.current.followerUsers.map((item) => item.id)).toEqual(['follower']);
      expect(hook.result.current.followingUsers.map((item) => item.id)).toEqual(['following']);
      expect(hook.result.current.errorMessage).toBe(
        'İnternet bağlantısı şu an kullanılamıyor. Bağlantını kontrol edip tekrar dene.',
      );
      expect(hook.result.current.hasPartialDataError).toBe(true);

    await hook.result.current.createList(list);
    await hook.result.current.deleteList('list-1');
    await hook.result.current.updateList(list);
    await hook.result.current.updateLists([list]);
    await hook.result.current.deletePlace('place-1');

    expect(createListAsync).toHaveBeenCalledWith({ ...list, userId: 'viewer' });
    expect(deleteListAsync).toHaveBeenCalledWith('list-1');
    expect(updateListAsync).toHaveBeenCalledWith({
      list,
      previousList: { ...list, places: [] },
    });
    expect(updateListsAsync).toHaveBeenCalledWith([list]);
    expect(deletePlaceAsync).toHaveBeenCalledWith('place-1');
  });

  it('handles missing current users without invoking mutations', async () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);
    const createListAsync = vi.fn().mockResolvedValue(undefined);
    const deleteListAsync = vi.fn().mockResolvedValue(undefined);
    const updateListAsync = vi.fn().mockResolvedValue(undefined);
    const updateListsAsync = vi.fn().mockResolvedValue(undefined);
    const deletePlaceAsync = vi.fn().mockResolvedValue(undefined);

    useProfileReadModelQueryMock.mockReturnValue({
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      hasPartialDataError: false,
      isFetchingNextPage: false,
      isLoading: false,
      lists: [],
      places: [],
      refetch: vi.fn().mockResolvedValue(undefined),
      summary: undefined,
    });
    useVisibleDataQueryMock.mockReturnValue({
      data: {
        users: [{ id: 'other', email: 'other@example.com', name: 'Other', username: 'other' }],
        lists: [
          {
            id: 'list-1',
            userId: 'other',
            name: 'Other list',
            isPublic: true,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-02T00:00:00.000Z',
            places: [],
          },
        ],
      },
      error: null,
      hasPartialDataError: false,
      refetch: refetchMock,
    });
    useCreateListMutationMock.mockReturnValue({ mutateAsync: createListAsync });
    useDeleteListMutationMock.mockReturnValue({ mutateAsync: deleteListAsync });
    useUpdateListMutationMock.mockReturnValue({ mutateAsync: updateListAsync });
    useUpdateListsMutationMock.mockReturnValue({ mutateAsync: updateListsAsync });
    useDeletePlaceMutationMock.mockReturnValue({ mutateAsync: deletePlaceAsync });
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/profile/application/useOwnProfileScreenState');
    const hook = renderHook(() => hooks.useOwnProfileScreenState({ user: null }));

    expect(hook.result.current.freshUser).toBeNull();
    expect(hook.result.current.lists).toEqual([]);
    expect(hook.result.current.allPlaces).toEqual([]);
    expect(hook.result.current.allPhotos).toEqual([]);
    expect(hook.result.current.followerUsers).toEqual([]);
    expect(hook.result.current.followingUsers).toEqual([]);

    await hook.result.current.onRefresh();
    await hook.result.current.createList({
      id: 'list-2',
      userId: '',
      name: 'Weekend',
      places: [],
      isPublic: true,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
    });

    expect(refetchMock).not.toHaveBeenCalled();
    expect(createListAsync).not.toHaveBeenCalled();

    await hook.result.current.deleteList('list-1');
    await hook.result.current.updateList({
      id: 'list-1',
      userId: 'other',
      name: 'Other list',
      places: [],
      isPublic: true,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
    });
    await hook.result.current.updateLists([]);
    await hook.result.current.deletePlace('place-1');

    expect(deleteListAsync).toHaveBeenCalledWith('list-1');
    expect(updateListAsync).toHaveBeenCalled();
    expect(updateListsAsync).toHaveBeenCalledWith([]);
    expect(deletePlaceAsync).toHaveBeenCalledWith('place-1');
  });

  it('falls back to the provided user when cached profile data is stale', async () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);
    const createListAsync = vi.fn().mockResolvedValue(undefined);
    const user = {
      id: 'viewer',
      email: 'viewer@example.com',
      name: 'Viewer',
      username: 'viewer',
      followers: ['missing-follower'],
      following: ['missing-following'],
    };

    useProfileReadModelQueryMock.mockReturnValue({
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      hasPartialDataError: false,
      isFetchingNextPage: false,
      isLoading: false,
      lists: [{
        id: 'list-1', userId: 'viewer', name: 'Favorites', isPublic: true,
        createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-02T00:00:00.000Z', places: [],
      }],
      places: [{
        key: 'place-1:list-1', listId: 'list-1', listIsPublic: true,
        ownerId: 'viewer', memberships: [], sortTime: 1,
        place: { id: 'place-1', name: 'Cafe', lat: 1, lng: 1, addedAt: '2025-01-01T00:00:00.000Z' },
      }],
      refetch: vi.fn().mockResolvedValue(undefined),
      summary: undefined,
    });
    useVisibleDataQueryMock.mockReturnValue({
      data: {
        users: [],
        lists: [
          {
            id: 'list-1',
            userId: 'viewer',
            name: 'Favorites',
            isPublic: true,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-02T00:00:00.000Z',
            places: [{ id: 'place-1', name: 'Cafe', lat: 1, lng: 1, addedAt: '2025-01-01T00:00:00.000Z' }],
          },
        ],
      },
      error: null,
      hasPartialDataError: false,
      refetch: refetchMock,
    });
    useCreateListMutationMock.mockReturnValue({ mutateAsync: createListAsync });
    useDeleteListMutationMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) });
    useUpdateListMutationMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) });
    useUpdateListsMutationMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) });
    useDeletePlaceMutationMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) });
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/profile/application/useOwnProfileScreenState');
    const hook = renderHook(() => hooks.useOwnProfileScreenState({ user }));

    expect(hook.result.current.freshUser).toEqual(user);
    expect(hook.result.current.lists).toHaveLength(1);
    expect(hook.result.current.allPlaces).toHaveLength(1);
    expect(hook.result.current.allPhotos).toEqual([]);
    expect(hook.result.current.followerUsers).toEqual([]);
    expect(hook.result.current.followingUsers).toEqual([]);

    await hook.result.current.onRefresh();
    expect(refetchMock).toHaveBeenCalled();
  });

  it('composes paginated read-model lists with context relationships and partial errors', async () => {
    const user = {
      id: 'viewer', email: 'viewer@example.com', name: 'Viewer', username: 'viewer',
    };
    const follower = { id: 'follower', email: '', name: 'Follower', username: 'follower' };
    const following = { id: 'following', email: '', name: 'Following', username: 'following' };
    const profileRefetch = vi.fn().mockRejectedValue(new Error('profile failed'));
    const contextRefetch = vi.fn().mockResolvedValue(undefined);
    const fetchNextPage = vi.fn();
    const placeItem = (id: string, listId: string, photos: string[] = []) => ({
      key: `${listId}:${id}`, ownerId: user.id, owner: user, listId, listName: 'List',
      listIsPublic: true, memberships: [], sortTime: 1,
      place: {
        id, name: id, lat: 1, lng: 2, photos,
        addedAt: '2025-01-01T00:00:00.000Z',
      },
    });
    useProfileReadModelQueryMock.mockReturnValue({
      error: new Error('read model partial'), fetchNextPage, hasNextPage: true,
      hasPartialDataError: true, isFetchingNextPage: true, isLoading: false,
      lists: [
        { id: 'list-1', userId: user.id, name: 'One', isPublic: true,
          createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-02T00:00:00.000Z' },
        { id: 'list-empty', userId: user.id, name: 'Empty', isPublic: true,
          createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-02T00:00:00.000Z' },
      ],
      places: [placeItem('place-1', 'list-1', ['photo']), placeItem('place-2', 'list-1')],
      refetch: profileRefetch,
      summary: {
        user: { ...user, name: 'Fresh viewer' }, followerCount: 9, followingCount: 8,
      },
    });
    useVisibleDataQueryMock.mockReturnValue({
      data: {
        users: [
          { ...user, followers: ['follower'], following: ['following'] }, follower, following,
        ],
        lists: [],
      },
      error: null, hasPartialDataError: false, isLoading: false, refetch: contextRefetch,
    });
    useCreateListMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    useDeleteListMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    useUpdateListMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    useUpdateListsMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    useDeletePlaceMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: true, onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/profile/application/useOwnProfileScreenState');
    const hook = renderHook(() => hooks.useOwnProfileScreenState({ activeTab: 'gallery', user }));

    expect(hook.result.current.freshUser).toMatchObject({
      name: 'Fresh viewer', followers: ['follower'], following: ['following'],
    });
    expect(hook.result.current.lists[0]?.places).toHaveLength(2);
    expect(hook.result.current.lists[1]?.places).toEqual([]);
    expect(hook.result.current.allPlaces).toHaveLength(2);
    expect(hook.result.current.allPhotos).toHaveLength(1);
    expect(hook.result.current.followerUsers).toEqual([follower]);
    expect(hook.result.current.followingUsers).toEqual([following]);
    expect(hook.result.current.followerCount).toBe(9);
    expect(hook.result.current.followingCount).toBe(8);
    expect(hook.result.current.fetchNextPage).toBe(fetchNextPage);
    expect(hook.result.current.hasNextPage).toBe(true);
    expect(hook.result.current.isFetchingNextPage).toBe(true);
    expect(hook.result.current.hasPartialDataError).toBe(true);
    expect(hook.result.current.errorMessage).not.toBeNull();
    await hook.result.current.retry();
    expect(profileRefetch).toHaveBeenCalledOnce();
    expect(contextRefetch).toHaveBeenCalledOnce();
  });
});
