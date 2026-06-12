import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook } from '@/mobile/app/test/hookTestUtils';

const useVisibleDataQueryMock = vi.fn();
const useCreateListMutationMock = vi.fn();
const useDeleteListMutationMock = vi.fn();
const useUpdateListMutationMock = vi.fn();
const useUpdateListsMutationMock = vi.fn();
const useDeletePlaceMutationMock = vi.fn();
const useFocusRefreshMock = vi.fn();

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
      'Internet baglantisi su an kullanilamiyor. Baglantini kontrol edip tekrar dene.',
    );
    expect(hook.result.current.hasPartialDataError).toBe(true);

    await hook.result.current.createList(list);
    await hook.result.current.deleteList('list-1');
    await hook.result.current.updateList(list);
    await hook.result.current.updateLists([list]);
    await hook.result.current.deletePlace('place-1');

    expect(createListAsync).toHaveBeenCalledWith({ ...list, userId: 'viewer' });
    expect(deleteListAsync).toHaveBeenCalledWith('list-1');
    expect(updateListAsync).toHaveBeenCalledWith(list);
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
});
