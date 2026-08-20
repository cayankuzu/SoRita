import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import {
  type MobileNotification,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
  useRespondToFollowRequestMutation,
} from '@/mobile/app/data/hooks/useNotificationsQuery';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import { tr } from '@/mobile/app/shared/i18n/tr';

export type NotificationCategory =
  | 'all'
  | 'likes'
  | 'follows'
  | 'comments'
  | 'quotes'
  | 'places';
export type { MobileNotification };

type UseNotificationsScreenStateParams = {
  userId?: string | null;
};

function getCategory(type: MobileNotification['type']): NotificationCategory {
  if (type === 'like' || type === 'list_liked' || type === 'comment_like') {
    return 'likes';
  }

  if (type === 'follow' || type === 'follow_request') {
    return 'follows';
  }

  if (type === 'comment' || type === 'comment_reply') {
    return 'comments';
  }

  if (type === 'place_quote') {
    return 'quotes';
  }

  return 'places';
}

export function useNotificationsScreenState({ userId }: UseNotificationsScreenStateParams) {
  const [category, setCategory] = useState<NotificationCategory>('all');
  const pendingFollowRequestIdsRef = useRef(new Set<string>());
  const [pendingFollowRequestIds, setPendingFollowRequestIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const queryClient = useQueryClient();
  const notificationsQuery = useNotificationsQuery(userId);
  const markAllNotificationsReadMutation = useMarkAllNotificationsReadMutation(userId);
  const markNotificationReadMutation = useMarkNotificationReadMutation(userId);
  const respondToFollowRequestMutation = useRespondToFollowRequestMutation(userId);
  const errorMessage = notificationsQuery.error
    ? getUserFacingErrorMessage(
        notificationsQuery.error,
        tr.notifications.errorDescription,
      )
    : null;

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      return;
    }

    await notificationsQuery.refetch().catch((err) => { logger.debug('notifications', 'Failed to refetch notifications', err); });
  }, [notificationsQuery, userId]);

  const { refreshing, onRefresh } = useFocusRefresh(loadNotifications, { skipInitialFocus: true });

  useEffect(() => {
    if (!userId) {
      return;
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void loadNotifications();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadNotifications, userId]);

  const items = useMemo(
    () => notificationsQuery.data || [],
    [notificationsQuery.data],
  );

  const filteredItems = useMemo(() => {
    if (category === 'all') {
      return items;
    }

    return items.filter((item) => getCategory(item.type) === category);
  }, [category, items]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  const markAllItemsRead = useCallback(async () => {
    if (!userId || unreadCount === 0) {
      return;
    }

    await markAllNotificationsReadMutation.mutateAsync().catch((err) => { logger.debug('notifications', 'Failed to mark all notifications as read', err); });
  }, [markAllNotificationsReadMutation, unreadCount, userId]);

  const markItemRead = useCallback(
    async (notification: MobileNotification) => {
      if (!notification.read) {
        await markNotificationReadMutation.mutateAsync(notification).catch((err) => { logger.debug('notifications', 'Failed to mark notification as read', err); });
      }
    },
    [markNotificationReadMutation],
  );

  const respondToFollowRequest = useCallback(
    async (notification: MobileNotification, decision: 'accept' | 'reject') => {
      if (!userId || !notification.followRequest?.id) {
        return;
      }

      if (pendingFollowRequestIdsRef.current.has(notification.id)) {
        return;
      }

      pendingFollowRequestIdsRef.current.add(notification.id);
      setPendingFollowRequestIds(new Set(pendingFollowRequestIdsRef.current));

      try {
        await respondToFollowRequestMutation.mutateAsync({ notification, decision });
        await queryClient.invalidateQueries({ queryKey: queryKeys.visibleData.all });
      } finally {
        pendingFollowRequestIdsRef.current.delete(notification.id);
        setPendingFollowRequestIds(new Set(pendingFollowRequestIdsRef.current));
      }
    },
    [queryClient, respondToFollowRequestMutation, userId],
  );

  return {
    category,
    errorMessage,
    fetchNextPage: notificationsQuery.fetchNextPage,
    filteredItems,
    hasNextPage: notificationsQuery.hasNextPage,
    isInitialLoading: notificationsQuery.isLoading && items.length === 0,
    isFetchingNextPage: notificationsQuery.isFetchingNextPage,
    isMarkingAllRead: markAllNotificationsReadMutation.isPending,
    items,
    markAllItemsRead,
    markItemRead,
    onRefresh,
    pendingFollowRequestIds,
    refreshing,
    respondToFollowRequest,
    retry: loadNotifications,
    setCategory,
    unreadCount,
  };
}
