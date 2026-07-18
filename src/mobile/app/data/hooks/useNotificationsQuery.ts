import {
  InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  getNotificationCount,
  getNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
  respondToFollowRequestNotification,
  type MobileNotification,
} from '@/mobile/app/data/repositories/notificationRepository';
import { flattenPages, mapInfinitePages } from '@/mobile/app/data/query/queryDataHelpers';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';

const NOTIFICATION_STALE_TIME_MS = 1000 * 20;
const NOTIFICATIONS_PAGE_SIZE = 20;

export type { MobileNotification };

type UseNotificationsQueryOptions = {
  enabled?: boolean;
};

export function useNotificationsQuery(
  userId?: string | null,
  options: UseNotificationsQueryOptions = {},
) {
  const enabled = options.enabled ?? true;

  const query = useInfiniteQuery<
    MobileNotification[],
    Error,
    InfiniteData<MobileNotification[], number>,
    ReturnType<typeof queryKeys.notifications.list> | typeof queryKeys.notifications.all,
    number
  >({
    queryKey: userId ? queryKeys.notifications.list(userId) : queryKeys.notifications.all,
    queryFn: ({ pageParam = 0 }) =>
      (userId
        ? getNotificationsPage(userId, pageParam, NOTIFICATIONS_PAGE_SIZE)
        : Promise.resolve([])),
    enabled: Boolean(userId) && enabled,
    getNextPageParam: (lastPage, allPages) =>
      !Array.isArray(lastPage) || lastPage.length < NOTIFICATIONS_PAGE_SIZE
        ? undefined
        : allPages.reduce((count, page) => count + (Array.isArray(page) ? page.length : 0), 0),
    initialPageParam: 0,
    staleTime: NOTIFICATION_STALE_TIME_MS,
  });

  return {
    ...query,
    data: flattenPages<MobileNotification>(query.data),
  };
}

export function useNotificationUnreadCountQuery(
  userId?: string | null,
  options: UseNotificationsQueryOptions = {},
) {
  const enabled = options.enabled ?? true;

  return useQuery({
    enabled: Boolean(userId) && enabled,
    queryKey: userId
      ? queryKeys.notifications.unreadCount(userId)
      : queryKeys.notifications.all,
    queryFn: () => (userId ? getNotificationCount(userId) : Promise.resolve(0)),
    staleTime: NOTIFICATION_STALE_TIME_MS,
  });
}

export function useMarkNotificationReadMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notification: MobileNotification) => markNotificationRead(notification.id),
    onMutate: async (notification) => {
      if (!userId) {
        return { previousItems: undefined };
      }

      const queryKey = queryKeys.notifications.list(userId);
      await queryClient.cancelQueries({ queryKey });
      const previousItems = queryClient.getQueryData<InfiniteData<MobileNotification[], number>>(queryKey);

      queryClient.setQueryData<InfiniteData<MobileNotification[], number>>(queryKey, (items) =>
        mapInfinitePages(
          items,
          (item) => (item.id === notification.id ? { ...item, read: true } : item),
        ),
      );
      queryClient.setQueryData<number>(
        queryKeys.notifications.unreadCount(userId),
        (count) => Math.max((count ?? 1) - (notification.read ? 0 : 1), 0),
      );

      return { previousItems };
    },
    onError: (_error, _notification, context) => {
      if (!userId || !context?.previousItems) {
        return;
      }

      queryClient.setQueryData(queryKeys.notifications.list(userId), context.previousItems);
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount(userId) });
    },
    onSettled: () => {
      if (!userId) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list(userId) });
    },
  });
}

export function useMarkAllNotificationsReadMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!userId) {
        return Promise.resolve();
      }

      return markAllNotificationsRead(userId);
    },
    onMutate: async () => {
      if (!userId) {
        return { previousItems: undefined };
      }

      const queryKey = queryKeys.notifications.list(userId);
      await queryClient.cancelQueries({ queryKey });
      const previousItems = queryClient.getQueryData<InfiniteData<MobileNotification[], number>>(queryKey);

      queryClient.setQueryData<InfiniteData<MobileNotification[], number>>(queryKey, (items) =>
        mapInfinitePages(items, (item) => (item.read ? item : { ...item, read: true })),
      );
      queryClient.setQueryData(queryKeys.notifications.unreadCount(userId), 0);

      return { previousItems };
    },
    onError: (_error, _variables, context) => {
      if (!userId || !context?.previousItems) {
        return;
      }

      queryClient.setQueryData(queryKeys.notifications.list(userId), context.previousItems);
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount(userId) });
    },
    onSettled: () => {
      if (!userId) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list(userId) });
    },
  });
}

type FollowRequestDecisionInput = {
  notification: MobileNotification;
  decision: 'accept' | 'reject';
};

export function useRespondToFollowRequestMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ notification, decision }: FollowRequestDecisionInput) => {
      if (!notification.followRequest?.id) {
        return Promise.resolve();
      }

      return respondToFollowRequestNotification(
        notification.id,
        notification.followRequest.id,
        decision,
      );
    },
    onMutate: async ({ notification, decision }) => {
      if (!userId) {
        return { previousItems: undefined };
      }

      const queryKey = queryKeys.notifications.list(userId);
      await queryClient.cancelQueries({ queryKey });
      const previousItems = queryClient.getQueryData<InfiniteData<MobileNotification[], number>>(queryKey);

      queryClient.setQueryData<InfiniteData<MobileNotification[], number>>(queryKey, (items) =>
        mapInfinitePages(items, (item) =>
          item.id === notification.id
            ? {
                ...item,
                read: true,
                followRequest: item.followRequest
                  ? {
                      ...item.followRequest,
                      status: decision === 'accept' ? 'accepted' : 'rejected',
                    }
                  : item.followRequest,
              }
            : item,
        ),
      );
      queryClient.setQueryData<number>(
        queryKeys.notifications.unreadCount(userId),
        (count) => Math.max((count ?? 1) - (notification.read ? 0 : 1), 0),
      );

      return { previousItems };
    },
    onError: (_error, _input, context) => {
      if (!userId || !context?.previousItems) {
        return;
      }

      queryClient.setQueryData(queryKeys.notifications.list(userId), context.previousItems);
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount(userId) });
    },
    onSettled: () => {
      if (!userId) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list(userId) });
    },
  });
}
