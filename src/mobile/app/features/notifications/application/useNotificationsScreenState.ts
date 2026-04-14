import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import {
  getCachedNotifications,
  markNotificationRead,
  refreshNotifications,
  respondToFollowRequestNotification,
  type MobileNotification,
} from '@/mobile/app/data/repositories/notificationRepository';
import { storage } from '@/mobile/app/data/repositories/supabaseStorage';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import { useNotificationVersion } from '@/mobile/app/shared/hooks/useNotificationVersion';

export type NotificationCategory = 'all' | 'likes' | 'follows' | 'comments' | 'places';

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
  useNotificationVersion();

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      return;
    }

    await refreshNotifications(userId).catch(() => undefined);
  }, [userId]);

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

  const items = userId ? getCachedNotifications(userId) : [];

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
        await markNotificationRead(notification.id, userId).catch(() => undefined);
      }
    },
    [userId],
  );

  const respondToFollowRequest = useCallback(
    async (notification: MobileNotification, decision: 'accept' | 'reject') => {
      if (!userId || !notification.followRequest?.id) {
        return;
      }

      await respondToFollowRequestNotification(
        notification.id,
        notification.followRequest.id,
        decision,
        userId,
      );
      await storage.refreshVisibleData(userId);
    },
    [userId],
  );

  return {
    category,
    filteredItems,
    items,
    markItemRead,
    onRefresh,
    refreshing,
    respondToFollowRequest,
    setCategory,
    unreadCount,
  };
}
