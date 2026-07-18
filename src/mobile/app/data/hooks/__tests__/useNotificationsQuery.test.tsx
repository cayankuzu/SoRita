import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';

import { createQueryClientWrapper, createTestQueryClient } from '@/mobile/app/test/queryTestUtils';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';

const markNotificationReadMock = vi.fn();
const getNotificationsPageMock = vi.fn();
const respondToFollowRequestNotificationMock = vi.fn();

vi.mock('@/mobile/app/data/repositories/notificationRepository', () => ({
  getNotificationsPage: getNotificationsPageMock,
  markNotificationRead: markNotificationReadMock,
  respondToFollowRequestNotification: respondToFollowRequestNotificationMock,
}));

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return {
    promise,
    reject,
    resolve,
  };
}

describe('useNotificationsQuery', () => {
  beforeEach(() => {
    markNotificationReadMock.mockReset();
    getNotificationsPageMock.mockReset();
    respondToFollowRequestNotificationMock.mockReset();
  });

  it('reuses cached notifications for the same query key', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const items = [
      {
        id: 'notification-1',
        message: 'hello',
        read: false,
        timestamp: '1 dk once',
        type: 'follow' as const,
        userId: 'user-2',
        userName: 'Ada',
      },
    ];

    getNotificationsPageMock.mockResolvedValue(items);
    const hooks = await import('@/mobile/app/data/hooks/useNotificationsQuery');

    const firstHook = renderHook(() => hooks.useNotificationsQuery('user-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(getNotificationsPageMock).toHaveBeenCalledTimes(1);
    });

    queryClient.setQueryData(queryKeys.notifications.list('user-1'), {
      pageParams: [0],
      pages: [items],
    });

    const secondHook = renderHook(() => hooks.useNotificationsQuery('user-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(secondHook.result.current.data).toEqual(items);
    });

    expect(getNotificationsPageMock).toHaveBeenCalledTimes(1);
  });

  it('applies an optimistic read update and invalidates afterwards', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const notification = {
      id: 'notification-1',
      message: 'hello',
      read: false,
      timestamp: '1 dk once',
      type: 'follow' as const,
      userId: 'user-2',
      userName: 'Ada',
    };
    const pendingRead = createDeferredPromise<void>();

    markNotificationReadMock.mockReturnValue(pendingRead.promise);
    queryClient.setQueryData(queryKeys.notifications.list('user-1'), {
      pageParams: [0],
      pages: [[notification]],
    });
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const hooks = await import('@/mobile/app/data/hooks/useNotificationsQuery');
    const mutationHook = renderHook(
      () => hooks.useMarkNotificationReadMutation('user-1'),
      { wrapper },
    );

    await act(async () => {
      mutationHook.result.current.mutate(notification);
    });

    await waitFor(() => {
      expect(
        queryClient.getQueryData(queryKeys.notifications.list('user-1')),
      ).toEqual({
        pageParams: [0],
        pages: [[
          {
            ...notification,
            read: true,
          },
        ]],
      });
    });

    pendingRead.resolve();

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.notifications.list('user-1'),
      });
    });
  });

  it('optimistically responds to follow requests and rolls back on failure', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const notification = {
      id: 'notification-1',
      message: 'hello',
      read: false,
      timestamp: '1 dk once',
      type: 'follow_request' as const,
      userId: 'user-2',
      userName: 'Ada',
      followRequest: {
        id: 'request-1',
        status: 'pending' as const,
      },
    };

    respondToFollowRequestNotificationMock.mockRejectedValue(new Error('boom'));
    queryClient.setQueryData(queryKeys.notifications.list('user-1'), {
      pageParams: [0],
      pages: [[notification]],
    });

    const hooks = await import('@/mobile/app/data/hooks/useNotificationsQuery');
    const mutationHook = renderHook(
      () => hooks.useRespondToFollowRequestMutation('user-1'),
      { wrapper },
    );

    await act(async () => {
      await expect(
        mutationHook.result.current.mutateAsync({
          notification,
          decision: 'accept',
        }),
      ).rejects.toThrow('boom');
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.notifications.list('user-1'))).toEqual({
        pageParams: [0],
        pages: [[notification]],
      });
    });
  });

  it('returns an empty query when no user id is present', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const hooks = await import('@/mobile/app/data/hooks/useNotificationsQuery');

    const hook = renderHook(() => hooks.useNotificationsQuery(undefined), {
      wrapper,
    });

    expect(hook.result.current.data).toEqual([]);
    expect(getNotificationsPageMock).not.toHaveBeenCalled();
  });

  it('does not fetch notifications when explicitly disabled', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const hooks = await import('@/mobile/app/data/hooks/useNotificationsQuery');

    const hook = renderHook(
      () => hooks.useNotificationsQuery('user-1', { enabled: false }),
      { wrapper },
    );

    expect(hook.result.current.data).toEqual([]);
    expect(getNotificationsPageMock).not.toHaveBeenCalled();
  });

  it('deduplicates pages and computes next offsets', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const firstPage = Array.from({ length: 20 }, (_, index) => ({
      id: `notification-${index}`,
      message: `hello-${index}`,
      read: false,
      timestamp: '1 dk once',
      type: 'follow' as const,
      userId: 'user-2',
      userName: 'Ada',
    }));
    const secondPage = [
      firstPage[0],
      {
        id: 'notification-20',
        message: 'hello-20',
        read: false,
        timestamp: '1 dk once',
        type: 'follow' as const,
        userId: 'user-2',
        userName: 'Ada',
      },
    ];

    getNotificationsPageMock
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);
    const hooks = await import('@/mobile/app/data/hooks/useNotificationsQuery');
    const hook = renderHook(() => hooks.useNotificationsQuery('user-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(hook.result.current.data).toHaveLength(20);
    });

    await act(async () => {
      await hook.result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(hook.result.current.data).toHaveLength(21);
    });
    expect(getNotificationsPageMock).toHaveBeenNthCalledWith(1, 'user-1', 0, 20);
    expect(getNotificationsPageMock).toHaveBeenNthCalledWith(2, 'user-1', 20, 20);
  });

  it('skips optimistic cache work without a user id and ignores missing follow-request ids', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const cancelQueriesSpy = vi.spyOn(queryClient, 'cancelQueries');
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    markNotificationReadMock.mockResolvedValue(undefined);
    respondToFollowRequestNotificationMock.mockResolvedValue(undefined);

    const hooks = await import('@/mobile/app/data/hooks/useNotificationsQuery');
    const markHook = renderHook(
      () => hooks.useMarkNotificationReadMutation(undefined),
      { wrapper },
    );
    const respondHook = renderHook(
      () => hooks.useRespondToFollowRequestMutation(undefined),
      { wrapper },
    );

    const notification = {
      id: 'notification-1',
      message: 'hello',
      read: false,
      timestamp: '1 dk once',
      type: 'follow_request' as const,
      userId: 'user-2',
      userName: 'Ada',
    };

    await act(async () => {
      await markHook.result.current.mutateAsync(notification);
      await respondHook.result.current.mutateAsync({
        notification,
        decision: 'reject',
      });
    });

    expect(markNotificationReadMock).toHaveBeenCalledWith('notification-1');
    expect(respondToFollowRequestNotificationMock).not.toHaveBeenCalled();
    expect(cancelQueriesSpy).not.toHaveBeenCalled();
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });
});
