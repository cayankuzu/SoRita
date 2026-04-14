import {
  loadPersistedNotificationSnapshot,
  RUNTIME_CACHE_VERSION,
  savePersistedNotificationSnapshot,
} from '@/mobile/app/platform/storage/runtimeCache';
import { supabase } from '@/mobile/app/platform/supabase/client';

import type { MobileNotification } from './notificationQueryHelpers';

type PersistedNotificationSnapshot = {
  version: number;
  userId: string;
  items: MobileNotification[];
  cachedAt: string;
};

let notificationCacheUserId: string | null = null;
let notificationItemsCache: MobileNotification[] = [];
let notificationVersion = 0;
const notificationListeners = new Set<() => void>();
const notificationRefreshPromises = new Map<string, Promise<MobileNotification[]>>();
let notificationRealtimeUserId: string | null = null;
let notificationRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let notificationPersistTimer: ReturnType<typeof setTimeout> | null = null;
let notificationPersistPromise: Promise<void> = Promise.resolve();

function emitNotificationChange() {
  notificationVersion += 1;
  schedulePersistedNotifications();
  notificationListeners.forEach((listener) => listener());
}

function schedulePersistedNotifications() {
  const userId = notificationCacheUserId;

  if (!userId) {
    return;
  }

  if (notificationPersistTimer) {
    clearTimeout(notificationPersistTimer);
  }

  notificationPersistTimer = setTimeout(() => {
    notificationPersistTimer = null;

    const snapshotUserId = notificationCacheUserId;

    if (!snapshotUserId) {
      return;
    }

    const nextSnapshot = {
      version: RUNTIME_CACHE_VERSION,
      userId: snapshotUserId,
      items: notificationItemsCache,
      cachedAt: new Date().toISOString(),
    };

    notificationPersistPromise = notificationPersistPromise
      .catch(() => undefined)
      .then(() => savePersistedNotificationSnapshot(nextSnapshot))
      .catch(() => undefined);
  }, 180);
}

export function subscribeNotifications(listener: () => void) {
  notificationListeners.add(listener);

  return () => {
    notificationListeners.delete(listener);
  };
}

export function getNotificationVersion() {
  return notificationVersion;
}

export function getCachedNotifications(userId?: string | null): MobileNotification[] {
  if (!userId || notificationCacheUserId !== userId) {
    return [];
  }

  return notificationItemsCache;
}

export function getCachedNotificationCount(userId?: string | null): number {
  return getCachedNotifications(userId).filter((item) => !item.read).length;
}

export function setNotificationCache(userId: string, items: MobileNotification[]) {
  notificationCacheUserId = userId;
  notificationItemsCache = items;
  emitNotificationChange();
}

export function restoreNotificationCache(userId: string, items: MobileNotification[]) {
  notificationCacheUserId = userId;
  notificationItemsCache = items;
  emitNotificationChange();
}

export function updateNotificationCache(
  userId: string,
  updater: (items: MobileNotification[]) => MobileNotification[],
): MobileNotification[] {
  if (notificationCacheUserId !== userId) {
    return [];
  }

  notificationItemsCache = updater(notificationItemsCache);
  emitNotificationChange();
  return notificationItemsCache;
}

export async function hydrateNotificationCache(userId: string) {
  const snapshot = await loadPersistedNotificationSnapshot<PersistedNotificationSnapshot>(userId);

  if (!snapshot) {
    return false;
  }

  notificationCacheUserId = userId;
  notificationItemsCache = snapshot.items;
  emitNotificationChange();
  return snapshot.items.length > 0;
}

export function clearNotificationCache(userId?: string | null) {
  if (!userId || notificationCacheUserId === userId) {
    notificationCacheUserId = userId ?? null;
    notificationItemsCache = [];
    emitNotificationChange();
  }

  if (!userId || notificationRealtimeUserId === userId) {
    if (notificationRealtimeChannel) {
      void supabase.removeChannel(notificationRealtimeChannel);
      notificationRealtimeChannel = null;
    }

    notificationRealtimeUserId = null;
  }
}

export function ensureNotificationRealtime(userId: string, onRefresh: () => void) {
  if (notificationRealtimeUserId === userId && notificationRealtimeChannel) {
    return;
  }

  if (notificationRealtimeChannel) {
    void supabase.removeChannel(notificationRealtimeChannel);
    notificationRealtimeChannel = null;
  }

  notificationRealtimeUserId = userId;
  notificationRealtimeChannel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_user_id=eq.${userId}`,
      },
      onRefresh,
    )
    .subscribe();
}

export function getNotificationRefreshPromise(userId: string) {
  return notificationRefreshPromises.get(userId);
}

export function setNotificationRefreshPromise(userId: string, promise: Promise<MobileNotification[]>) {
  notificationRefreshPromises.set(userId, promise);
}

export function clearNotificationRefreshPromise(userId: string, promise: Promise<MobileNotification[]>) {
  if (notificationRefreshPromises.get(userId) === promise) {
    notificationRefreshPromises.delete(userId);
  }
}
