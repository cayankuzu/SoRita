import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook } from '@/mobile/app/test/hookTestUtils';

const useVisibleDataQueryMock = vi.fn();
const useFollowUserMutationMock = vi.fn();
const useReportUserMutationMock = vi.fn();
const useBlockUserMutationMock = vi.fn();
const useUnblockUserMutationMock = vi.fn();
const useFocusRefreshMock = vi.fn();

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
      'Baglanti gec yanit veriyor. Lutfen tekrar dene.',
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
    expect(missingHook.result.current.isOwnProfile).toBe(true);
    expect(missingHook.result.current.canViewProfileContent).toBe(true);

    await expect(missingHook.result.current.followUser()).rejects.toThrow(
      'Takip islemi icin kullanici bulunamadi.',
    );
    await expect(missingHook.result.current.reportUser('spam')).rejects.toThrow(
      'Kullanici bulunamadi.',
    );
    await expect(missingHook.result.current.blockUser()).rejects.toThrow('Kullanici bulunamadi.');
    await expect(missingHook.result.current.unblockUser()).rejects.toThrow('Kullanici bulunamadi.');
  });
});
