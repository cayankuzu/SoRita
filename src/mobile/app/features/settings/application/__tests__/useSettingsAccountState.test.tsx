import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook } from '@/mobile/app/test/hookTestUtils';

const useVisibleDataQueryMock = vi.fn();
const useUpdateUserMutationMock = vi.fn();
const useDeleteCurrentUserMutationMock = vi.fn();
const usePullToRefreshMock = vi.fn();

vi.mock('@/mobile/app/data/hooks/useVisibleDataQuery', () => ({
  useVisibleDataQuery: useVisibleDataQueryMock,
}));

vi.mock('@/mobile/app/data/hooks/useUserMutations', () => ({
  useDeleteCurrentUserMutation: useDeleteCurrentUserMutationMock,
  useUpdateUserMutation: useUpdateUserMutationMock,
}));

vi.mock('@/mobile/app/shared/hooks/usePullToRefresh', () => ({
  usePullToRefresh: usePullToRefreshMock,
}));

describe('useSettingsAccountState', () => {
  beforeEach(() => {
    useVisibleDataQueryMock.mockReset();
    useUpdateUserMutationMock.mockReset();
    useDeleteCurrentUserMutationMock.mockReset();
    usePullToRefreshMock.mockReset();
  });

  it('derives account state and delegates update/delete behavior', async () => {
    const refetchMock = vi.fn().mockResolvedValue({
      data: {
        users: [{ id: 'viewer', email: 'viewer@example.com', name: 'Viewer', username: 'viewer', blockedUsers: ['blocked'] }],
      },
    });
    const refreshUserMock = vi.fn().mockResolvedValue(undefined);
    const updateUserAsync = vi.fn().mockResolvedValue({ id: 'viewer', username: 'viewer' });
    const deleteCurrentUserAsync = vi.fn().mockResolvedValue(undefined);
    const user = {
      id: 'viewer',
      email: 'viewer@example.com',
      name: 'Viewer',
      username: 'viewer',
      blockedUsers: ['blocked'],
      isPublicAccount: true,
    };

    useVisibleDataQueryMock.mockReturnValue({
      data: {
        users: [user],
        allUsers: [user, { id: 'blocked', email: 'blocked@example.com', name: 'Blocked', username: 'blocked' }],
      },
      refetch: refetchMock,
    });
    useUpdateUserMutationMock.mockReturnValue({ mutateAsync: updateUserAsync });
    useDeleteCurrentUserMutationMock.mockReturnValue({ mutateAsync: deleteCurrentUserAsync });
    usePullToRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/settings/application/useSettingsAccountState');
    const hook = renderHook(() =>
      hooks.useSettingsAccountState({
        refreshUser: refreshUserMock,
        user,
      }),
    );

    expect(hook.result.current.blockedUsers.map((item) => item.id)).toEqual(['blocked']);

    await hook.result.current.refreshCurrentUserState();
    await hook.result.current.saveUserProfile(user);
    await hook.result.current.saveAccountPrivacy(false);
    await hook.result.current.deleteCurrentUser();

    expect(refetchMock).toHaveBeenCalled();
    expect(refreshUserMock).toHaveBeenCalled();
    expect(updateUserAsync).toHaveBeenCalledWith(user);
    expect(updateUserAsync).toHaveBeenCalledWith({ ...user, isPublicAccount: false });
    expect(deleteCurrentUserAsync).toHaveBeenCalled();
  });

  it('supports null-user early returns and privacy guard rails', async () => {
    const refreshUserMock = vi.fn().mockResolvedValue(undefined);
    const updateUserAsync = vi.fn().mockResolvedValue({ id: 'viewer', username: 'viewer' });
    const deleteCurrentUserAsync = vi.fn().mockResolvedValue(undefined);

    useVisibleDataQueryMock.mockReturnValue({
      data: {
        users: [],
        allUsers: [],
      },
      refetch: vi.fn().mockResolvedValue({ data: { users: [] } }),
    });
    useUpdateUserMutationMock.mockReturnValue({ mutateAsync: updateUserAsync });
    useDeleteCurrentUserMutationMock.mockReturnValue({ mutateAsync: deleteCurrentUserAsync });
    usePullToRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/settings/application/useSettingsAccountState');
    const hook = renderHook(() =>
      hooks.useSettingsAccountState({
        refreshUser: refreshUserMock,
        user: null,
      }),
    );

    expect(hook.result.current.freshUser).toBeNull();
    expect(hook.result.current.blockedUsers).toEqual([]);

    await expect(hook.result.current.refreshCurrentUserState()).resolves.toBeNull();
    await expect(hook.result.current.saveAccountPrivacy(false)).rejects.toThrow('Kullanıcı bulunamadı.');
    await hook.result.current.onRefresh();
    await hook.result.current.deleteCurrentUser();

    expect(refreshUserMock).not.toHaveBeenCalled();
    expect(deleteCurrentUserAsync).toHaveBeenCalled();
  });

  it('falls back to the session snapshot when visible data is sparse or refresh fails', async () => {
    const user = {
      id: 'viewer',
      email: 'viewer@example.com',
      name: 'Viewer',
      username: 'viewer',
      blockedUsers: ['missing-user'],
    };
    const refetchMock = vi.fn().mockResolvedValue({ data: undefined });
    const refreshUserMock = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('background refresh failed'));
    const updateUserAsync = vi.fn().mockResolvedValue(user);

    useVisibleDataQueryMock.mockReturnValue({ data: undefined, refetch: refetchMock });
    useUpdateUserMutationMock.mockReturnValue({ mutateAsync: updateUserAsync });
    useDeleteCurrentUserMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    usePullToRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/settings/application/useSettingsAccountState');
    const hook = renderHook(() =>
      hooks.useSettingsAccountState({
        refreshUser: refreshUserMock,
        user,
      }),
    );

    expect(hook.result.current.freshUser).toEqual(user);
    expect(hook.result.current.blockedUsers).toEqual([]);
    const noBlocksHook = renderHook(() =>
      hooks.useSettingsAccountState({
        refreshUser: refreshUserMock,
        user: { ...user, blockedUsers: undefined },
      }),
    );
    expect(noBlocksHook.result.current.blockedUsers).toEqual([]);
    await expect(hook.result.current.refreshCurrentUserState()).resolves.toEqual(user);
    await expect(hook.result.current.saveUserProfile(user)).resolves.toEqual(user);
    await Promise.resolve();

    expect(refreshUserMock).toHaveBeenCalledTimes(2);
  });
});
