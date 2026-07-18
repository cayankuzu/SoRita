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

vi.mock('@/mobile/app/data/query/readModelErrors', () => ({
  isMissingReadModelError: (error: unknown) =>
    Boolean(error && typeof error === 'object' && 'missingReadModel' in error),
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
      data: undefined,
      error: { missingReadModel: true },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: vi.fn().mockResolvedValue(undefined),
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
});
