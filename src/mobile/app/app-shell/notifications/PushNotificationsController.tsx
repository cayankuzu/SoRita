import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { InfiniteData } from '@tanstack/react-query';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import { isInfiniteData } from '@/mobile/app/data/query/queryDataHelpers';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import { ensureAndroidPushChannel } from '@/mobile/app/data/repositories/pushNotificationRepository';
import {
  getNotificationsPage,
  type MobileNotification,
} from '@/mobile/app/data/repositories/notificationRepository';
import { notificationRuntime } from '@/mobile/app/platform/notifications/runtime';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { normalizePushPayload } from '@/mobile/app/app-shell/notifications/pushNavigation';
import { usePushRegistration } from '@/mobile/app/app-shell/notifications/usePushRegistration';
import { useVerifiedPushTapNavigation } from '@/mobile/app/app-shell/notifications/useVerifiedPushTapNavigation';

async function loadNotificationsModule() {
  return import('expo-notifications');
}

let notificationPresentationPromise: Promise<void> | null = null;
const NOTIFICATIONS_SYNC_PAGE_SIZE = 20;
const NOTIFICATION_EVENT_DEDUPE_MS = 8000;
const NOTIFICATION_SYNC_DEDUPE_MS = 1200;
const REALTIME_BACKOFF_MS = [5000, 15000, 30000, 60000, 300000] as const;

export async function ensureForegroundNotificationPresentation() {
  if (!notificationRuntime.supportsNotificationObservers) {
    return;
  }

  if (!notificationPresentationPromise) {
    notificationPresentationPromise = (async () => {
      await ensureAndroidPushChannel().catch((err) => { logger.debug('push', 'Failed to ensure Android push channel', err); });
      const Notifications = await loadNotificationsModule();

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        }),
      });
    })();
  }

  await notificationPresentationPromise;
}

function buildNotificationQueryKey(userId: string) {
  return queryKeys.notifications.list(userId);
}

function setLatestNotificationsCache(
  userId: string,
  notifications: MobileNotification[],
) {
  const queryKey = buildNotificationQueryKey(userId);
  const unreadCount = notifications.filter((item) => !item.read).length;

  queryClient.setQueryData<
    InfiniteData<MobileNotification[], number> | MobileNotification[] | undefined
  >(queryKey, (current) => {
    if (!isInfiniteData<MobileNotification>(current)) {
      return {
        pageParams: [0],
        pages: [notifications],
      };
    }

    return {
      ...current,
      pageParams:
        current.pageParams.length > 0 ? current.pageParams : [0],
      pages:
        current.pages.length > 0
          ? [notifications, ...current.pages.slice(1)]
          : [notifications],
    };
  });
  queryClient.setQueryData(queryKeys.notifications.unreadCount(userId), unreadCount);
}

type HydrateLatestNotifications = (
  userId: string,
  options?: { force?: boolean; notificationId?: string; reason?: string },
) => Promise<void>;

function useNotificationsRealtimeSubscription(params: {
  booted: boolean;
  hydrateLatestNotifications: HydrateLatestNotifications;
  userId?: string;
}) {
  const { booted, hydrateLatestNotifications, userId } = params;
  const realtimeBackoffAttemptRef = useRef(0);
  const realtimeBackoffTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!booted || !userId) {
      return;
    }

    const clearRealtimeBackoff = () => {
      if (realtimeBackoffTimeoutRef.current) {
        clearTimeout(realtimeBackoffTimeoutRef.current);
        realtimeBackoffTimeoutRef.current = null;
      }
    };
    const scheduleRealtimeBackoff = () => {
      clearRealtimeBackoff();
      const attempt = realtimeBackoffAttemptRef.current;
      const baseDelay = REALTIME_BACKOFF_MS[Math.min(attempt, REALTIME_BACKOFF_MS.length - 1)];
      const jitter = Math.round(baseDelay * 0.2 * Math.random());

      realtimeBackoffAttemptRef.current = Math.min(attempt + 1, REALTIME_BACKOFF_MS.length - 1);
      realtimeBackoffTimeoutRef.current = setTimeout(() => {
        realtimeBackoffTimeoutRef.current = null;
        void hydrateLatestNotifications(userId, {
          force: true,
          reason: 'realtime-backoff',
        });
      }, baseDelay + jitter);
    };

    const channel = supabase
      .channel(`notifications:recipient:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          const nextNotificationId =
            typeof payload.new === 'object'
            && payload.new
            && 'id' in payload.new
            && typeof payload.new.id === 'string'
              ? payload.new.id
              : undefined;

          void hydrateLatestNotifications(userId, {
            notificationId: nextNotificationId,
            reason: 'realtime-insert',
          });
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          realtimeBackoffAttemptRef.current = 0;
          clearRealtimeBackoff();
          return;
        }

        if (status === 'CHANNEL_ERROR') {
          logger.warn('push', `Notifications realtime channel failed for ${userId}`);
          scheduleRealtimeBackoff();
          return;
        }

        if (status === 'TIMED_OUT' || status === 'CLOSED') {
          scheduleRealtimeBackoff();
        }
      });

    return () => {
      clearRealtimeBackoff();
      void supabase.removeChannel(channel);
    };
  }, [booted, hydrateLatestNotifications, userId]);
}

export function PushNotificationsController() {
  const { booted, user } = useAuth();
  const userId = user?.id;
  const lastHydrateAtRef = useRef(0);
  const recentNotificationEventsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    void ensureForegroundNotificationPresentation();
  }, []);

  const hydrateLatestNotifications = useCallback(async (
    userId: string,
    options: { force?: boolean; notificationId?: string; reason?: string } = {},
  ) => {
    const now = Date.now();

    if (options.notificationId) {
      const previousEventAt = recentNotificationEventsRef.current.get(options.notificationId) || 0;

      if (now - previousEventAt < NOTIFICATION_EVENT_DEDUPE_MS) {
        return;
      }

      recentNotificationEventsRef.current.set(options.notificationId, now);
      for (const [notificationId, seenAt] of recentNotificationEventsRef.current.entries()) {
        if (now - seenAt > NOTIFICATION_EVENT_DEDUPE_MS) {
          recentNotificationEventsRef.current.delete(notificationId);
        }
      }
    }

    if (!options.force && now - lastHydrateAtRef.current < NOTIFICATION_SYNC_DEDUPE_MS) {
      return;
    }

    lastHydrateAtRef.current = now;

    try {
      const notifications = await getNotificationsPage(
        userId,
        0,
        NOTIFICATIONS_SYNC_PAGE_SIZE,
      );

      setLatestNotificationsCache(userId, notifications);
    } catch (error) {
      logger.warn('push', `Failed to hydrate latest notifications cache (${options.reason || 'unknown'})`, error);
    }
  }, []);

  useNotificationsRealtimeSubscription({
    booted,
    hydrateLatestNotifications,
    userId,
  });

  const { syncPushRegistration } = usePushRegistration({ booted, userId });
  const { openPushTarget } = useVerifiedPushTapNavigation(userId);

  useEffect(() => {
    if (!notificationRuntime.supportsNotificationObservers) {
      return;
    }

    let receivedSubscription: { remove: () => void } | null = null;
    let responseSubscription: { remove: () => void } | null = null;
    let cancelled = false;

    void loadNotificationsModule()
      .then((Notifications) => {
        if (cancelled) {
          return;
        }

        receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
          if (!userId) {
            return;
          }

          const payload = normalizePushPayload(
            notification.request.content.data as Record<string, unknown> | undefined,
          );

          void hydrateLatestNotifications(userId, {
            notificationId: payload.notificationId,
            reason: 'push-received',
          });
        });

        responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
          const payload = normalizePushPayload(
            response.notification.request.content.data as Record<string, unknown> | undefined,
          );

          openPushTarget(payload);
        });
      })
      .catch((error) => {
        logger.warn('push', 'Failed to initialize notifications module', error);
      });

    return () => {
      cancelled = true;
      receivedSubscription?.remove();
      responseSubscription?.remove();
    };
  }, [hydrateLatestNotifications, openPushTarget, userId]);

  useEffect(() => {
    if (!booted || !notificationRuntime.supportsNotificationObservers) {
      return;
    }

    void loadNotificationsModule()
      .then((Notifications) => Notifications.getLastNotificationResponseAsync())
      .then((response) => {
        if (!response) {
          return;
        }

        const payload = normalizePushPayload(
          response.notification.request.content.data as Record<string, unknown> | undefined,
        );

        openPushTarget(payload);
      })
      .catch((error) => {
        logger.warn('push', 'Failed to inspect last notification response', error);
      });
  }, [booted, openPushTarget]);

  useEffect(() => {
    if (!booted) {
      return;
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        return;
      }

      if (notificationRuntime.featureEnabled) {
        void ensureForegroundNotificationPresentation().catch((error) => {
          logger.warn('push', 'Failed to refresh foreground notification presentation', error);
        });
        void syncPushRegistration();
      }

      if (userId) {
        void hydrateLatestNotifications(userId, { force: true, reason: 'foreground' });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [booted, hydrateLatestNotifications, syncPushRegistration, userId]);

  return null;
}
