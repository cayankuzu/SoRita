import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook } from '@/mobile/app/test/hookTestUtils';
import { createQueryClientWrapper, createTestQueryClient } from '@/mobile/app/test/queryTestUtils';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';

const useNotificationsQueryMock = vi.fn();
const useMarkNotificationReadMutationMock = vi.fn();
const useRespondToFollowRequestMutationMock = vi.fn();
const useFocusRefreshMock = vi.fn();

vi.mock('@/mobile/app/data/hooks/useNotificationsQuery', () => ({
  useMarkNotificationReadMutation: useMarkNotificationReadMutationMock,
  useNotificationsQuery: useNotificationsQueryMock,
  useRespondToFollowRequestMutation: useRespondToFollowRequestMutationMock,
}));

vi.mock('@/mobile/app/shared/hooks/useFocusRefresh', () => ({
  useFocusRefresh: useFocusRefreshMock,
}));

describe('useNotificationsScreenState', () => {
  beforeEach(() => {
    useNotificationsQueryMock.mockReset();
    useMarkNotificationReadMutationMock.mockReset();
    useRespondToFollowRequestMutationMock.mockReset();
    useFocusRefreshMock.mockReset();
  });

  it('filters notifications, marks unread items as read, and invalidates visible data after follow decisions', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const refetchMock = vi.fn().mockResolvedValue(undefined);
    const markReadAsync = vi.fn().mockResolvedValue(undefined);
    const respondAsync = vi.fn().mockResolvedValue(undefined);

    const followRequestNotification = {
      id: 'n1',
      type: 'follow_request' as const,
      read: false,
      message: 'requested',
      timestamp: '1 dk once',
      userId: 'user-2',
      userName: 'Ada',
      followRequest: {
        id: 'fr-1',
        status: 'pending' as const,
      },
    };

    useNotificationsQueryMock.mockReturnValue({
      data: [
        followRequestNotification,
        { id: 'n2', type: 'like', read: true },
      ],
      error: new Error('Network request failed'),
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isLoading: false,
      isFetchingNextPage: false,
      refetch: refetchMock,
    });
    useMarkNotificationReadMutationMock.mockReturnValue({ mutateAsync: markReadAsync });
    useRespondToFollowRequestMutationMock.mockReturnValue({ mutateAsync: respondAsync });
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/notifications/application/useNotificationsScreenState');
    const hook = renderHook(() => hooks.useNotificationsScreenState({ userId: 'viewer-1' }), { wrapper });

    expect(hook.result.current.unreadCount).toBe(1);
    expect(hook.result.current.errorMessage).toBe(
      'Internet baglantisi su an kullanilamiyor. Baglantini kontrol edip tekrar dene.',
    );

    act(() => {
      hook.result.current.setCategory('likes');
    });
    expect(hook.result.current.filteredItems.map((item) => item.id)).toEqual(['n2']);

    await hook.result.current.markItemRead(followRequestNotification);
    await hook.result.current.respondToFollowRequest(
      followRequestNotification,
      'accept',
    );
    await hook.result.current.retry();

    expect(markReadAsync).toHaveBeenCalled();
    expect(respondAsync).toHaveBeenCalledWith({
      notification: followRequestNotification,
      decision: 'accept',
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.visibleData.all,
    });
  });

  it('handles category filters and guard clauses without a user id', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const refetchMock = vi.fn().mockRejectedValue(new Error('network failed'));
    const markReadAsync = vi.fn().mockResolvedValue(undefined);
    const respondAsync = vi.fn().mockResolvedValue(undefined);

    useNotificationsQueryMock.mockReturnValue({
      data: [
        { id: 'n1', type: 'comment', read: false },
        { id: 'n2', type: 'comment_reply', read: true },
        { id: 'n3', type: 'follow', read: true },
        { id: 'n4', type: 'place_recommended', read: true },
      ],
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isLoading: false,
      isFetchingNextPage: true,
      refetch: refetchMock,
    });
    useMarkNotificationReadMutationMock.mockReturnValue({ mutateAsync: markReadAsync });
    useRespondToFollowRequestMutationMock.mockReturnValue({ mutateAsync: respondAsync });
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: true,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/notifications/application/useNotificationsScreenState');
    const hook = renderHook(() => hooks.useNotificationsScreenState({ userId: null }), { wrapper });

    act(() => {
      hook.result.current.setCategory('comments');
    });
    expect(hook.result.current.filteredItems.map((item) => item.id)).toEqual(['n1', 'n2']);

    act(() => {
      hook.result.current.setCategory('follows');
    });
    expect(hook.result.current.filteredItems.map((item) => item.id)).toEqual(['n3']);

    act(() => {
      hook.result.current.setCategory('places');
    });
    expect(hook.result.current.filteredItems.map((item) => item.id)).toEqual(['n4']);

    await hook.result.current.markItemRead({ id: 'n2', type: 'follow', read: true } as never);
    await hook.result.current.respondToFollowRequest({ id: 'n5', type: 'follow_request', read: false } as never, 'reject');
    await hook.result.current.onRefresh();

    expect(markReadAsync).not.toHaveBeenCalled();
    expect(respondAsync).not.toHaveBeenCalled();
    expect(refetchMock).not.toHaveBeenCalled();
    expect(hook.result.current.hasNextPage).toBe(false);
    expect(hook.result.current.isInitialLoading).toBe(false);
    expect(hook.result.current.isFetchingNextPage).toBe(true);
    expect(hook.result.current.refreshing).toBe(true);
  });
});
