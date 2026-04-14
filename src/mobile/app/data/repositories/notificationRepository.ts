import { supabase } from '@/mobile/app/platform/supabase/client';

import {
  clearNotificationCache,
  clearNotificationRefreshPromise,
  ensureNotificationRealtime,
  getCachedNotificationCount,
  getCachedNotifications,
  getNotificationRefreshPromise,
  getNotificationVersion,
  hydrateNotificationCache,
  restoreNotificationCache,
  setNotificationCache,
  setNotificationRefreshPromise,
  subscribeNotifications,
  updateNotificationCache,
} from '@/mobile/app/data/repositories/notifications/notificationStore';
import {
  fetchNotifications,
  type MobileNotification,
} from '@/mobile/app/data/repositories/notifications/notificationQueryHelpers';

export type { MobileNotification } from '@/mobile/app/data/repositories/notifications/notificationQueryHelpers';
export {
  clearNotificationCache,
  getCachedNotificationCount,
  getCachedNotifications,
  getNotificationVersion,
  hydrateNotificationCache,
  subscribeNotifications,
};

export async function refreshNotifications(userId: string): Promise<MobileNotification[]> {
  ensureNotificationRealtime(userId, () => {
    void refreshNotifications(userId);
  });

  const existingPromise = getNotificationRefreshPromise(userId);
  if (existingPromise) {
    return existingPromise;
  }

  const task = (async () => {
    const items = await fetchNotifications(userId);
    setNotificationCache(userId, items);
    return items;
  })();

  setNotificationRefreshPromise(userId, task);

  try {
    return await task;
  } finally {
    clearNotificationRefreshPromise(userId, task);
  }
}

export async function getNotifications(userId: string): Promise<MobileNotification[]> {
  const cachedItems = getCachedNotifications(userId);

  if (cachedItems.length > 0) {
    return cachedItems;
  }

  return refreshNotifications(userId);
}

export async function getNotificationCount(userId: string): Promise<number> {
  const cachedItems = getCachedNotifications(userId);

  if (cachedItems.length > 0) {
    return cachedItems.filter((item) => !item.read).length;
  }

  const items = await refreshNotifications(userId);
  return items.filter((item) => !item.read).length;
}

export async function markNotificationRead(notificationId: string, userId?: string) {
  let previousItems: MobileNotification[] | null = null;

  if (userId) {
    const cachedItems = getCachedNotifications(userId);

    if (cachedItems.length > 0) {
      previousItems = cachedItems;
      updateNotificationCache(userId, (items) =>
        items.map((item) => (item.id === notificationId ? { ...item, read: true } : item)),
      );
    }
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) {
    if (userId && previousItems) {
      restoreNotificationCache(userId, previousItems);
    }

    throw error;
  }
}

export async function respondToFollowRequestNotification(
  notificationId: string,
  requestId: string,
  decision: 'accept' | 'reject',
  userId?: string,
) {
  let previousItems: MobileNotification[] | null = null;

  if (userId) {
    const cachedItems = getCachedNotifications(userId);

    if (cachedItems.length > 0) {
      previousItems = cachedItems;
      updateNotificationCache(userId, (items) =>
        items.map((item) =>
          item.id === notificationId
            ? {
                ...item,
                read: true,
                followRequest: item.followRequest
                  ? { ...item.followRequest, status: decision === 'accept' ? 'accepted' : 'rejected' }
                  : item.followRequest,
              }
            : item,
        ),
      );
    }
  }

  const { error: requestError } = await supabase.rpc('respond_to_follow_request', {
    input_request_id: requestId,
    input_decision: decision,
  });

  if (requestError) {
    if (userId && previousItems) {
      restoreNotificationCache(userId, previousItems);
    }

    throw requestError;
  }

  await markNotificationRead(notificationId, userId);
  if (userId) {
    void refreshNotifications(userId);
  }
}
