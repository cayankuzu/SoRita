import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { InfiniteData } from '@tanstack/react-query';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { rootNavigationRef } from '@/mobile/app/app-shell/navigation/navigationRef';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import { isInfiniteData } from '@/mobile/app/data/query/queryDataHelpers';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import {
  ensureAndroidPushChannel,
  registerDevicePushToken,
  registerPushNotifications,
} from '@/mobile/app/data/repositories/pushNotificationRepository';
import {
  getNotificationsPage,
  markNotificationRead,
  type MobileNotification,
} from '@/mobile/app/data/repositories/notificationRepository';
import { notificationRuntime } from '@/mobile/app/platform/notifications/runtime';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { supabase } from '@/mobile/app/platform/supabase/client';

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

type PushPayload = {
  notificationId?: string;
  type?: string;
  userId?: string;
  listId?: string;
  placeId?: string;
};

function normalizePushPayload(data: Record<string, unknown> | undefined): PushPayload {
  return {
    notificationId: typeof data?.notificationId === 'string' ? data.notificationId : undefined,
    type: typeof data?.type === 'string' ? data.type : undefined,
    userId: typeof data?.userId === 'string' ? data.userId : undefined,
    listId: typeof data?.listId === 'string' ? data.listId : undefined,
    placeId: typeof data?.placeId === 'string' ? data.placeId : undefined,
  };
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

export function PushNotificationsController() {
  const { booted, user } = useAuth();
  const registeredTokenRef = useRef<string | null>(null);
  const registeredUserIdRef = useRef<string | null>(null);
  const registrationInFlightUserIdRef = useRef<string | null>(null);
  const lastHandledNotificationIdRef = useRef<string | null>(null);
  const lastHydrateAtRef = useRef(0);
  const recentNotificationEventsRef = useRef<Map<string, number>>(new Map());
  const realtimeBackoffAttemptRef = useRef(0);
  const realtimeBackoffTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const syncPushRegistration = useCallback(async () => {
    if (!booted || !notificationRuntime.supportsRemotePushRegistration) {
      return;
    }

    if (!user) {
      registeredTokenRef.current = null;
      registeredUserIdRef.current = null;
      registrationInFlightUserIdRef.current = null;
      return;
    }

    if (
      registeredUserIdRef.current === user.id ||
      registrationInFlightUserIdRef.current === user.id
    ) {
      return;
    }

    try {
      registrationInFlightUserIdRef.current = user.id;
      const nextToken = await registerPushNotifications(user.id);

      if (nextToken) {
        registeredTokenRef.current = nextToken;
        registeredUserIdRef.current = user.id;
      }
    } catch (error) {
      logger.warn('push', 'Push registration failed', error);
    } finally {
      if (registrationInFlightUserIdRef.current === user.id) {
        registrationInFlightUserIdRef.current = null;
      }
    }
  }, [booted, user]);

  const openPushTarget = useCallback(
    (payload: PushPayload) => {
      if (payload.notificationId && payload.notificationId === lastHandledNotificationIdRef.current) {
        return;
      }

      if (user?.id && payload.notificationId) {
        void markNotificationRead(payload.notificationId).catch((error) => {
          logger.warn('push', 'Failed to mark notification as read from push tap', error);
        }).finally(() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list(user.id) });
        });
      }

      if (!rootNavigationRef.isReady()) {
        setTimeout(() => {
          if (rootNavigationRef.isReady()) {
            openPushTarget(payload);
          }
        }, 350);
        return;
      }

      if (!user) {
        rootNavigationRef.navigate('Auth');
        return;
      }

      lastHandledNotificationIdRef.current = payload.notificationId ?? null;

      if (payload.listId) {
        rootNavigationRef.navigate('ListDetail', {
          listId: payload.listId,
          placeId: payload.placeId,
        });
        return;
      }

      if (payload.userId) {
        rootNavigationRef.navigate('UserProfile', { userId: payload.userId });
        return;
      }

      rootNavigationRef.navigate('Notifications');
    },
    [user],
  );

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
          if (!user?.id) {
            return;
          }

          const payload = normalizePushPayload(
            notification.request.content.data as Record<string, unknown> | undefined,
          );

          void hydrateLatestNotifications(user.id, {
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
  }, [hydrateLatestNotifications, openPushTarget, user?.id]);

  useEffect(() => {
    lastHandledNotificationIdRef.current = null;
  }, [user?.id]);

  useEffect(() => {
    if (!booted || !user?.id) {
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
        void hydrateLatestNotifications(user.id, {
          force: true,
          reason: 'realtime-backoff',
        });
      }, baseDelay + jitter);
    };

    const channel = supabase
      .channel(`notifications:recipient:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${user.id}`,
        },
        (payload) => {
          const nextNotificationId =
            typeof payload.new === 'object' &&
            payload.new &&
            'id' in payload.new &&
            typeof payload.new.id === 'string'
              ? payload.new.id
              : undefined;

          void hydrateLatestNotifications(user.id, {
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
          logger.warn('push', `Notifications realtime channel failed for ${user.id}`);
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
  }, [booted, hydrateLatestNotifications, user?.id]);

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

        if (payload.notificationId && payload.notificationId === lastHandledNotificationIdRef.current) {
          return;
        }

        openPushTarget(payload);
      })
      .catch((error) => {
        logger.warn('push', 'Failed to inspect last notification response', error);
      });
  }, [booted, openPushTarget]);

  useEffect(() => {
    void syncPushRegistration();
  }, [syncPushRegistration]);

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

      if (user?.id) {
        void hydrateLatestNotifications(user.id, { force: true, reason: 'foreground' });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [booted, hydrateLatestNotifications, syncPushRegistration, user?.id]);

  useEffect(() => {
    if (!booted || !user || !notificationRuntime.supportsRemotePushRegistration) {
      return;
    }

    let subscription: { remove: () => void } | null = null;
    let cancelled = false;

    void loadNotificationsModule()
      .then((Notifications) => {
        if (cancelled || typeof Notifications.addPushTokenListener !== 'function') {
          return;
        }

        subscription = Notifications.addPushTokenListener((devicePushToken) => {
          void registerDevicePushToken(user.id, devicePushToken)
            .then((nextToken) => {
              if (!cancelled && nextToken) {
                registeredTokenRef.current = nextToken;
                registeredUserIdRef.current = user.id;
              }
            })
            .catch((error) => {
              logger.warn('push', 'Push token refresh registration failed', error);
            });
        });
      })
      .catch((error) => {
        logger.warn('push', 'Failed to initialize push token listener', error);
      });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [booted, user]);

  return null;
}
