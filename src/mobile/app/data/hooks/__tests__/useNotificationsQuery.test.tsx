import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onlineManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';

import { createQueryClientWrapper, createTestQueryClient } from '@/mobile/app/test/queryTestUtils';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';

const markNotificationReadMock = vi.fn();
const getNotificationsCursorPageMock = vi.fn();
const respondToFollowRequestNotificationMock = vi.fn();
const getNotificationCountMock = vi.fn();
const markAllNotificationsReadMock = vi.fn();
const enqueueDurableOutboxEntryMock = vi.fn();
const trackEventMock = vi.fn();

vi.mock('@/mobile/app/data/repositories/notificationRepository', () => ({
  getNotificationCount: getNotificationCountMock,
  getNotificationsCursorPage: getNotificationsCursorPageMock,
  markAllNotificationsRead: markAllNotificationsReadMock,
  markNotificationRead: markNotificationReadMock,
  respondToFollowRequestNotification: respondToFollowRequestNotificationMock,
}));

vi.mock('@/mobile/app/data/outbox/enqueueDurableOutboxEntry', () => ({
  enqueueDurableOutboxEntry: enqueueDurableOutboxEntryMock,
}));

vi.mock('@/mobile/app/platform/analytics/analyticsEvents', () => ({
  trackEvent: trackEventMock,
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
    onlineManager.setOnline(true);
    markNotificationReadMock.mockReset();
    getNotificationsCursorPageMock.mockReset();
    respondToFollowRequestNotificationMock.mockReset();
    getNotificationCountMock.mockReset();
    markAllNotificationsReadMock.mockReset();
    enqueueDurableOutboxEntryMock.mockReset();
    trackEventMock.mockReset();
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

    getNotificationsCursorPageMock.mockResolvedValue(items);
    const hooks = await import('@/mobile/app/data/hooks/useNotificationsQuery');

    renderHook(() => hooks.useNotificationsQuery('user-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(getNotificationsCursorPageMock).toHaveBeenCalledTimes(1);
    });

    queryClient.setQueryData(queryKeys.notifications.list('user-1'), {
      pageParams: [null],
      pages: [items],
    });

    const secondHook = renderHook(() => hooks.useNotificationsQuery('user-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(secondHook.result.current.data).toEqual(items);
    });

    expect(getNotificationsCursorPageMock).toHaveBeenCalledTimes(1);
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
    expect(getNotificationsCursorPageMock).not.toHaveBeenCalled();
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
    expect(getNotificationsCursorPageMock).not.toHaveBeenCalled();
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

    const firstCursor = { createdAt: '2026-01-01T00:00:00.000Z', id: 'notification-19' };
    getNotificationsCursorPageMock
      .mockResolvedValueOnce(Object.assign(firstPage, { nextCursor: firstCursor }))
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
    expect(getNotificationsCursorPageMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ cursor: null, pageSize: 20, userId: 'user-1' }),
    );
    expect(getNotificationsCursorPageMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: firstCursor, pageSize: 20, userId: 'user-1' }),
    );
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

  it('loads unread counts with user/default/disabled query branches', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    getNotificationCountMock.mockResolvedValue(4);
    const hooks = await import('@/mobile/app/data/hooks/useNotificationsQuery');
    const count = renderHook(() => hooks.useNotificationUnreadCountQuery('user-1'), { wrapper });
    await waitFor(() => expect(count.result.current.data).toBe(4));
    expect(getNotificationCountMock).toHaveBeenCalledWith('user-1');

    const anonymous = renderHook(() => hooks.useNotificationUnreadCountQuery(null), { wrapper });
    expect(anonymous.result.current.data).toBeUndefined();
    const disabled = renderHook(
      () => hooks.useNotificationUnreadCountQuery('user-2', { enabled: false }),
      { wrapper },
    );
    expect(disabled.result.current.fetchStatus).toBe('idle');
    expect(getNotificationCountMock).toHaveBeenCalledTimes(1);
  });

  it('queues notification reads offline and handles already-read/empty-count optimistic state', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const notification = {
      id: 'notification-1', message: 'hello', read: true, timestamp: 'now',
      type: 'follow' as const, userId: 'user-2', userName: 'Ada',
    };
    queryClient.setQueryData(queryKeys.notifications.list('user-1'), {
      pageParams: [null], pages: [[notification]],
    });
    enqueueDurableOutboxEntryMock.mockResolvedValue(undefined);
    onlineManager.setOnline(false);
    const hooks = await import('@/mobile/app/data/hooks/useNotificationsQuery');
    const mutation = renderHook(() => hooks.useMarkNotificationReadMutation('user-1'), { wrapper });
    await act(async () => {
      await mutation.result.current.mutateAsync(notification);
    });
    expect(enqueueDurableOutboxEntryMock).toHaveBeenCalledWith({
      idempotencyKey: 'notification-read:notification-1',
      kind: 'notification-read',
      payloadRef: { notificationId: 'notification-1' },
      userId: 'user-1',
    });
    expect(trackEventMock).toHaveBeenCalled();
    expect(queryClient.getQueryData(queryKeys.notifications.unreadCount('user-1'))).toBe(1);
    expect(markNotificationReadMock).not.toHaveBeenCalled();
  });

  it('optimistically marks every notification read and rolls back failed bulk updates', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const notifications = [
      { id: 'n1', message: 'one', read: false, timestamp: 'now', type: 'follow' as const, userId: 'u2', userName: 'A' },
      { id: 'n2', message: 'two', read: true, timestamp: 'now', type: 'follow' as const, userId: 'u3', userName: 'B' },
    ];
    const original = { pageParams: [null], pages: [notifications] };
    queryClient.setQueryData(queryKeys.notifications.list('user-1'), original);
    markAllNotificationsReadMock.mockRejectedValue(new Error('bulk failed'));
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const hooks = await import('@/mobile/app/data/hooks/useNotificationsQuery');
    const mutation = renderHook(() => hooks.useMarkAllNotificationsReadMutation('user-1'), { wrapper });

    await act(async () => {
      await expect(mutation.result.current.mutateAsync()).rejects.toThrow('bulk failed');
    });
    expect(queryClient.getQueryData(queryKeys.notifications.list('user-1'))).toEqual(original);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.notifications.unreadCount('user-1') });

    markAllNotificationsReadMock.mockResolvedValue(undefined);
    await act(async () => mutation.result.current.mutateAsync());
    expect(queryClient.getQueryData(queryKeys.notifications.unreadCount('user-1'))).toBe(0);

    const anonymous = renderHook(() => hooks.useMarkAllNotificationsReadMutation(undefined), { wrapper });
    await act(async () => anonymous.result.current.mutateAsync());
    expect(markAllNotificationsReadMock).toHaveBeenCalledTimes(2);
  });

  it('optimistically rejects follow requests, preserves absent details, and decrements only unread counts', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryClientWrapper(queryClient);
    const notification = {
      id: 'notification-1', message: 'hello', read: true, timestamp: 'now',
      type: 'follow_request' as const, userId: 'user-2', userName: 'Ada',
      followRequest: { id: 'request-1', status: 'pending' as const },
    };
    const other = { ...notification, id: 'notification-2', followRequest: undefined };
    queryClient.setQueryData(queryKeys.notifications.list('user-1'), {
      pageParams: [null], pages: [[notification, other]],
    });
    queryClient.setQueryData(queryKeys.notifications.unreadCount('user-1'), 0);
    respondToFollowRequestNotificationMock.mockResolvedValue(undefined);
    const hooks = await import('@/mobile/app/data/hooks/useNotificationsQuery');
    const mutation = renderHook(() => hooks.useRespondToFollowRequestMutation('user-1'), { wrapper });
    await act(async () => mutation.result.current.mutateAsync({ notification, decision: 'reject' }));
    expect(respondToFollowRequestNotificationMock).toHaveBeenCalledWith(
      'notification-1', 'request-1', 'reject',
    );
    expect(queryClient.getQueryData(queryKeys.notifications.list('user-1'))).toEqual({
      pageParams: [null],
      pages: [[
        { ...notification, followRequest: { id: 'request-1', status: 'rejected' } },
        other,
      ]],
    });
    expect(queryClient.getQueryData(queryKeys.notifications.unreadCount('user-1'))).toBe(0);
  });
});
