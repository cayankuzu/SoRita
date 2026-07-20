import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook } from '@/mobile/app/test/hookTestUtils';

const useVisibleDataQueryMock = vi.fn();
const useProfileReadModelQueryMock = vi.fn();
const useFollowUserMutationMock = vi.fn();
const useReportUserMutationMock = vi.fn();
const useBlockUserMutationMock = vi.fn();
const useUnblockUserMutationMock = vi.fn();
const useFocusRefreshMock = vi.fn();

vi.mock('@/mobile/app/data/hooks/useProfileReadModelQuery', () => ({
  useProfileReadModelQuery: useProfileReadModelQueryMock,
}));

vi.mock('@/mobile/app/data/hooks/useVisibleDataQuery', () => ({
  useVisibleDataQuery: useVisibleDataQueryMock,
}));

vi.mock('@/mobile/app/data/hooks/useUserMutations', () => ({
  useFollowUserMutation: useFollowUserMutationMock,
  useReportUserMutation: useReportUserMutationMock,
  useBlockUserMutation: useBlockUserMutationMock,
  useUnblockUserMutation: useUnblockUserMutationMock,
}));

vi.mock('@/mobile/app/shared/hooks/useFocusRefresh', () => ({
  useFocusRefresh: useFocusRefreshMock,
}));

describe('useUserProfileScreenState', () => {
  beforeEach(() => {
    useVisibleDataQueryMock.mockReset();
    useProfileReadModelQueryMock.mockReset();
    useFollowUserMutationMock.mockReset();
    useReportUserMutationMock.mockReset();
    useBlockUserMutationMock.mockReset();
    useUnblockUserMutationMock.mockReset();
    useFocusRefreshMock.mockReset();
  });

  it('derives profile visibility and delegates social mutations', async () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);
    const followUserAsync = vi.fn().mockResolvedValue('following');
    const reportUserAsync = vi.fn().mockResolvedValue(undefined);
    const blockUserAsync = vi.fn().mockResolvedValue(undefined);
    const unblockUserAsync = vi.fn().mockResolvedValue(undefined);
    const currentUser = {
      id: 'viewer',
      email: 'viewer@example.com',
      name: 'Viewer',
      username: 'viewer',
      following: ['target'],
    };
    const targetUser = {
      id: 'target',
      email: 'target@example.com',
      name: 'Target',
      username: 'target',
      isPublicAccount: true,
      followers: ['viewer'],
      following: [],
    };
    const publicList = {
      id: 'list-1',
      userId: 'target',
      name: 'Public list',
      isPublic: true,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
      places: [{ id: 'place-1', name: 'Cafe', lat: 1, lng: 1, photos: ['photo-1'], addedAt: '2025-01-01T00:00:00.000Z' }],
    };

    useProfileReadModelQueryMock.mockReturnValue({
      error: new Error('Request timed out after 8000ms'),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      hasPartialDataError: true,
      isFetchingNextPage: false,
      isLoading: false,
      lists: [publicList],
      places: [{
        key: 'place-1:list-1', listId: 'list-1', listIsPublic: true,
        ownerId: 'target', memberships: [], place: publicList.places[0], sortTime: 1,
      }],
      refetch: vi.fn().mockResolvedValue(undefined),
      summary: {
        canViewContent: true, followerCount: 1, followingCount: 0,
        isBlockedByViewer: false, isBlockingViewer: false,
        user: targetUser, viewerHasFollowed: true,
        viewerHasPendingFollowRequest: false,
      },
    });
    useVisibleDataQueryMock.mockReturnValue({
      data: {
        users: [currentUser, targetUser],
        allUsers: [currentUser, targetUser],
        blockRows: [],
        lists: [publicList],
      },
      error: new Error('Request timed out after 8000ms'),
      hasPartialDataError: true,
      refetch: refetchMock,
    });
    useFollowUserMutationMock.mockReturnValue({ mutateAsync: followUserAsync });
    useReportUserMutationMock.mockReturnValue({ mutateAsync: reportUserAsync });
    useBlockUserMutationMock.mockReturnValue({ mutateAsync: blockUserAsync });
    useUnblockUserMutationMock.mockReturnValue({ mutateAsync: unblockUserAsync });
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/profile/application/useUserProfileScreenState');
    const hook = renderHook(() =>
      hooks.useUserProfileScreenState({
        allowBlockedView: false,
        user: currentUser,
        userId: 'target',
      }),
    );

    expect(hook.result.current.profileUser?.id).toBe('target');
    expect(hook.result.current.isOwnProfile).toBe(false);
    expect(hook.result.current.isFollowing).toBe(true);
    expect(hook.result.current.canViewProfileContent).toBe(true);
    expect(hook.result.current.publicLists).toHaveLength(1);
    expect(hook.result.current.allPlaces).toHaveLength(1);
      expect(hook.result.current.allPhotos).toHaveLength(1);
      expect(hook.result.current.errorMessage).toBe(
        'Bağlantı geç yanıt veriyor. Lütfen tekrar dene.',
      );
      expect(hook.result.current.hasPartialDataError).toBe(true);

    await expect(hook.result.current.followUser()).resolves.toBe('following');
    await hook.result.current.reportUser('spam');
    await hook.result.current.blockUser();
    await hook.result.current.unblockUser();

    expect(followUserAsync).toHaveBeenCalledWith({
      currentUserId: 'viewer',
      targetUserId: 'target',
    });
    expect(reportUserAsync).toHaveBeenCalledWith({
      details: undefined,
      reporterUserId: 'viewer',
      targetUserId: 'target',
      reason: 'spam',
    });
    expect(blockUserAsync).toHaveBeenCalledWith({
      currentUserId: 'viewer',
      targetUserId: 'target',
    });
    expect(unblockUserAsync).toHaveBeenCalledWith({
      currentUserId: 'viewer',
      targetUserId: 'target',
    });
  });

  it('handles blocked/private visibility and missing user guards', async () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);
    const followUserAsync = vi.fn().mockResolvedValue('requested');
    const reportUserAsync = vi.fn().mockResolvedValue(undefined);
    const blockUserAsync = vi.fn().mockResolvedValue(undefined);
    const unblockUserAsync = vi.fn().mockResolvedValue(undefined);
    const currentUser = {
      id: 'viewer',
      email: 'viewer@example.com',
      name: 'Viewer',
      username: 'viewer',
      pendingFollowRequestsSent: ['target'],
    };
    const targetUser = {
      id: 'target',
      email: 'target@example.com',
      name: 'Target',
      username: 'target',
      isPublicAccount: false,
      followers: ['viewer'],
      following: ['viewer'],
    };

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
      summary: {
        canViewContent: false, followerCount: 1, followingCount: 1,
        isBlockedByViewer: true, isBlockingViewer: false,
        user: targetUser, viewerHasFollowed: false,
        viewerHasPendingFollowRequest: true,
      },
    });
    useVisibleDataQueryMock.mockReturnValue({
      data: {
        users: [currentUser],
        allUsers: [currentUser, targetUser],
        blockRows: [
          {
            blocker_user_id: 'viewer',
            blocked_user_id: 'target',
            created_at: '2025-01-01T00:00:00.000Z',
          },
        ],
        lists: [
          {
            id: 'list-1',
            userId: 'target',
            name: 'Private list',
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
    useFollowUserMutationMock.mockReturnValue({ mutateAsync: followUserAsync });
    useReportUserMutationMock.mockReturnValue({ mutateAsync: reportUserAsync });
    useBlockUserMutationMock.mockReturnValue({ mutateAsync: blockUserAsync });
    useUnblockUserMutationMock.mockReturnValue({ mutateAsync: unblockUserAsync });
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/profile/application/useUserProfileScreenState');
    const blockedHook = renderHook(() =>
      hooks.useUserProfileScreenState({
        allowBlockedView: true,
        user: currentUser,
        userId: 'target',
      }),
    );

    expect(blockedHook.result.current.profileUser?.id).toBe('target');
    expect(blockedHook.result.current.isBlockedByCurrent).toBe(true);
    expect(blockedHook.result.current.hasPendingFollowRequest).toBe(true);
    expect(blockedHook.result.current.canViewProfileContent).toBe(false);
    expect(blockedHook.result.current.publicLists).toEqual([]);
    expect(blockedHook.result.current.followerUsers.map((item) => item.id)).toEqual(['viewer']);
    expect(blockedHook.result.current.followingUsers.map((item) => item.id)).toEqual(['viewer']);

    await blockedHook.result.current.onRefresh();
    expect(refetchMock).toHaveBeenCalled();
    await expect(blockedHook.result.current.followUser()).resolves.toBe('requested');

    const missingHook = renderHook(() =>
      hooks.useUserProfileScreenState({
        allowBlockedView: false,
        user: null,
        userId: 'missing',
      }),
    );

    expect(missingHook.result.current.profileUser).toBeUndefined();
    expect(missingHook.result.current.currentUser).toBeNull();
    expect(missingHook.result.current.isFollowing).toBe(false);
    expect(missingHook.result.current.isOwnProfile).toBe(false);
    expect(missingHook.result.current.canViewProfileContent).toBe(false);

    await expect(missingHook.result.current.followUser()).rejects.toThrow(
      'Takip işlemi için kullanıcı bulunamadı.',
    );
    await expect(missingHook.result.current.reportUser('spam')).rejects.toThrow(
      'Kullanıcı bulunamadı.',
    );
    await expect(missingHook.result.current.blockUser()).rejects.toThrow('Kullanıcı bulunamadı.');
    await expect(missingHook.result.current.unblockUser()).rejects.toThrow('Kullanıcı bulunamadı.');
  });

  it('uses the profile read model for pagination, privacy, counts, and refresh recovery', async () => {
    const profileRefetch = vi.fn().mockRejectedValue(new Error('profile unavailable'));
    const contextRefetch = vi.fn().mockResolvedValue(undefined);
    const currentUser = {
      id: 'viewer', email: 'viewer@example.com', name: 'Viewer', username: 'viewer',
    };
    const targetUser = {
      id: 'target', email: 'target@example.com', name: 'Target', username: 'target',
      isPublicAccount: false,
    };
    const follower = {
      id: 'follower', email: 'follower@example.com', name: 'Follower', username: 'follower',
    };
    const following = {
      id: 'following', email: 'following@example.com', name: 'Following', username: 'following',
    };
    const publicList = {
      id: 'public-list', userId: 'target', name: 'Public', isPublic: true, places: [],
      createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-02T00:00:00.000Z',
    };
    const privateList = { ...publicList, id: 'private-list', name: 'Private', isPublic: false };
    const publicPlace = {
      key: 'public-place', ownerId: 'target', owner: targetUser, listId: 'public-list',
      listName: 'Public', listIsPublic: true, memberships: [], sortTime: 2,
      place: {
        id: 'place-1', name: 'Cafe', lat: 1, lng: 2,
        photos: ['https://cdn.example.com/place.jpg'], addedAt: '2025-01-01T00:00:00.000Z',
      },
    };
    const privatePlace = {
      ...publicPlace, key: 'private-place', listId: 'private-list', listIsPublic: false,
      place: { ...publicPlace.place, id: 'place-2', photos: [] },
    };
    const fetchNextPage = vi.fn().mockResolvedValue(undefined);
    const summary = {
      user: targetUser,
      canViewContent: true,
      followerCount: 8,
      followingCount: 6,
      isBlockedByViewer: false,
      isBlockingViewer: false,
      viewerHasFollowed: false,
      viewerHasPendingFollowRequest: true,
    };

    useProfileReadModelQueryMock.mockReturnValue({
      error: null, fetchNextPage, hasNextPage: true, hasPartialDataError: true,
      isFetchingNextPage: true, isLoading: false,
      lists: [privateList, publicList], places: [privatePlace, publicPlace],
      refetch: profileRefetch, summary,
    });
    useVisibleDataQueryMock.mockReturnValue({
      data: {
        users: [currentUser, follower, following],
        allUsers: [
          { ...targetUser, followers: ['follower', 'missing'], following: ['following', 'missing'] },
        ],
        blockRows: [], lists: [], currentUser,
      },
      error: null, hasPartialDataError: false, isLoading: false, refetch: contextRefetch,
    });
    useFollowUserMutationMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue('requested') });
    useReportUserMutationMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) });
    useBlockUserMutationMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) });
    useUnblockUserMutationMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) });
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: true,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/profile/application/useUserProfileScreenState');
    const hook = renderHook(() =>
      hooks.useUserProfileScreenState({
        activeTab: 'gallery', allowBlockedView: false, user: currentUser, userId: 'target',
      }),
    );

    expect(hook.result.current.profileUser).toMatchObject({
      id: 'target', followers: ['follower', 'missing'], following: ['following', 'missing'],
    });
    expect(hook.result.current.isFollowing).toBe(false);
    expect(hook.result.current.hasPendingFollowRequest).toBe(true);
    expect(hook.result.current.canViewProfileContent).toBe(true);
    expect(hook.result.current.publicLists.map((item) => item.id)).toEqual(['public-list']);
    expect(hook.result.current.allPlaces.map((item) => item.key)).toEqual(['public-place']);
    expect(hook.result.current.allPhotos.map((item) => item.key)).toEqual(['public-place']);
    expect(hook.result.current.followerUsers.map((item) => item.id)).toEqual(['follower']);
    expect(hook.result.current.followingUsers.map((item) => item.id)).toEqual(['following']);
    expect(hook.result.current.followerCount).toBe(8);
    expect(hook.result.current.followingCount).toBe(6);
    expect(hook.result.current.fetchNextPage).toBe(fetchNextPage);
    expect(hook.result.current.hasNextPage).toBe(true);
    expect(hook.result.current.isFetchingNextPage).toBe(true);
    expect(hook.result.current.hasPartialDataError).toBe(true);
    expect(hook.result.current.isInitialLoading).toBe(false);
    expect(hook.result.current.refreshing).toBe(true);

    await hook.result.current.retry();
    expect(profileRefetch).toHaveBeenCalledOnce();
    expect(contextRefetch).toHaveBeenCalledOnce();

    useProfileReadModelQueryMock.mockReturnValue({
      error: new Error('read model failed'), fetchNextPage: undefined, hasNextPage: false,
      hasPartialDataError: false, isFetchingNextPage: false, isLoading: true,
      lists: [publicList], places: [publicPlace], refetch: vi.fn().mockResolvedValue(undefined),
      summary: {
        ...summary, canViewContent: false, isBlockingViewer: true,
        viewerHasFollowed: true, viewerHasPendingFollowRequest: false,
      },
    });
    const blockedHook = renderHook(() =>
      hooks.useUserProfileScreenState({
        allowBlockedView: false, user: currentUser, userId: 'target',
      }),
    );

    expect(blockedHook.result.current.isBlockedByTarget).toBe(true);
    expect(blockedHook.result.current.isFollowing).toBe(true);
    expect(blockedHook.result.current.hasPendingFollowRequest).toBe(false);
    expect(blockedHook.result.current.canViewProfileContent).toBe(false);
    expect(blockedHook.result.current.publicLists).toEqual([]);
    expect(blockedHook.result.current.isInitialLoading).toBe(false);
    expect(blockedHook.result.current.errorMessage).not.toBeNull();
  });
});
