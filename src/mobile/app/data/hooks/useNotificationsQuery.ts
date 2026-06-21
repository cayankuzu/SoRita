import {
  InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import {
  getNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
  respondToFollowRequestNotification,
  type MobileNotification,
} from '@/mobile/app/data/repositories/notificationRepository';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';

const NOTIFICATION_STALE_TIME_MS = 1000 * 20;
const NOTIFICATIONS_PAGE_SIZE = 20;

export type { MobileNotification };

type UseNotificationsQueryOptions = {
  enabled?: boolean;
};

function isInfiniteNotificationData(
  data: unknown,
): data is InfiniteData<MobileNotification[], number> {
  return Boolean(
    data &&
      typeof data === 'object' &&
      Array.isArray((data as { pages?: unknown }).pages) &&
      Array.isArray((data as { pageParams?: unknown }).pageParams),
  );
}

function flattenNotificationPages(
  data?: InfiniteData<MobileNotification[], number> | MobileNotification[] | unknown,
): MobileNotification[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (!isInfiniteNotificationData(data)) {
    return [];
  }

  const seenIds = new Set<string>();

  return data.pages.flatMap((page) =>
    page.filter((item) => {
      if (seenIds.has(item.id)) {
        return false;
      }

      seenIds.add(item.id);
      return true;
    }),
  );
}

function mapNotificationPages(
  data: InfiniteData<MobileNotification[], number> | undefined,
  mapper: (item: MobileNotification) => MobileNotification,
) {
  if (!data) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page) => page.map(mapper)),
  };
}

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
    data: flattenNotificationPages(query.data),
  };
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
        mapNotificationPages(
          items,
          (item) => (item.id === notification.id ? { ...item, read: true } : item),
        ),
      );

      return { previousItems };
    },
    onError: (_error, _notification, context) => {
      if (!userId || !context?.previousItems) {
        return;
      }

      queryClient.setQueryData(queryKeys.notifications.list(userId), context.previousItems);
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
        mapNotificationPages(items, (item) => (item.read ? item : { ...item, read: true })),
      );

      return { previousItems };
    },
    onError: (_error, _variables, context) => {
      if (!userId || !context?.previousItems) {
        return;
      }

      queryClient.setQueryData(queryKeys.notifications.list(userId), context.previousItems);
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
        mapNotificationPages(items, (item) =>
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

      return { previousItems };
    },
    onError: (_error, _input, context) => {
      if (!userId || !context?.previousItems) {
        return;
      }

      queryClient.setQueryData(queryKeys.notifications.list(userId), context.previousItems);
    },
    onSettled: () => {
      if (!userId) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list(userId) });
    },
  });
}
