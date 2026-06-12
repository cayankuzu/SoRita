import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import {
  type MobileNotification,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
  useRespondToFollowRequestMutation,
} from '@/mobile/app/data/hooks/useNotificationsQuery';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';

export type NotificationCategory = 'all' | 'likes' | 'follows' | 'comments' | 'places';
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

  return 'places';
}

export function useNotificationsScreenState({ userId }: UseNotificationsScreenStateParams) {
  const [category, setCategory] = useState<NotificationCategory>('all');
  const queryClient = useQueryClient();
  const notificationsQuery = useNotificationsQuery(userId);
  const markNotificationReadMutation = useMarkNotificationReadMutation(userId);
  const respondToFollowRequestMutation = useRespondToFollowRequestMutation(userId);
  const errorMessage = notificationsQuery.error
    ? getUserFacingErrorMessage(
        notificationsQuery.error,
        'Bildirimler su an yuklenemiyor. Lutfen tekrar dene.',
      )
    : null;

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      return;
    }

    await notificationsQuery.refetch().catch(() => undefined);
  }, [notificationsQuery, userId]);

  const { refreshing, onRefresh } = useFocusRefresh(loadNotifications);

  useEffect(() => {
    if (!userId) {
      return;
    }

    void loadNotifications();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void loadNotifications();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadNotifications, userId]);

  const items = notificationsQuery.data || [];

  const filteredItems = useMemo(() => {
    if (category === 'all') {
      return items;
    }

    return items.filter((item) => getCategory(item.type) === category);
  }, [category, items]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  const markItemRead = useCallback(
    async (notification: MobileNotification) => {
      if (!notification.read) {
        await markNotificationReadMutation.mutateAsync(notification).catch(() => undefined);
      }
    },
    [markNotificationReadMutation],
  );

  const respondToFollowRequest = useCallback(
    async (notification: MobileNotification, decision: 'accept' | 'reject') => {
      if (!userId || !notification.followRequest?.id) {
        return;
      }

      await respondToFollowRequestMutation.mutateAsync({ notification, decision });
      await queryClient.invalidateQueries({ queryKey: queryKeys.visibleData.all });
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
    items,
    markItemRead,
    onRefresh,
    refreshing,
    respondToFollowRequest,
    retry: loadNotifications,
    setCategory,
    unreadCount,
  };
}
