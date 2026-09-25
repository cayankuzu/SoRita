import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { InfiniteData } from '@tanstack/react-query';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import { isInfiniteData } from '@/mobile/app/data/query/queryDataHelpers';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import {
  getNotificationCount,
  getNotificationsPage,
  type MobileNotification,
} from '@/mobile/app/data/repositories/notificationRepository';
import { notificationRuntime } from '@/mobile/app/platform/notifications/runtime';
import {
  claimForegroundPushes,
  showInAppPushBanner,
} from '@/mobile/app/platform/notifications/inAppPushBanner';
import { ensureForegroundNotificationPresentation } from '@/mobile/app/platform/notifications/foregroundNotificationPresentation';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { normalizePushPayload } from '@/mobile/app/app-shell/notifications/pushNavigation';
import { usePushRegistration } from '@/mobile/app/app-shell/notifications/usePushRegistration';
import { useVerifiedPushTapNavigation } from '@/mobile/app/app-shell/notifications/useVerifiedPushTapNavigation';
import { withRetryJitter } from '@/mobile/app/shared/utils/retryJitter';

let notificationsModulePromise: Promise<typeof import('expo-notifications')> | null = null;

function loadNotificationsModule() {
  notificationsModulePromise ??= import('expo-notifications').catch((error) => {
    notificationsModulePromise = null;
    throw error;
  });
  return notificationsModulePromise;
}

const NOTIFICATIONS_SYNC_PAGE_SIZE = 20;
const NOTIFICATION_EVENT_DEDUPE_MS = 8000;
const NOTIFICATION_SYNC_DEDUPE_MS = 1200;
const REALTIME_BACKOFF_MS = [5000, 15000, 30000, 60000, 300000] as const;

export { ensureForegroundNotificationPresentation };

function buildNotificationQueryKey(userId: string) {
  return queryKeys.notifications.list(userId);
}

function setLatestNotificationsCache(
  userId: string,
  notifications: MobileNotification[],
) {
  const queryKey = buildNotificationQueryKey(userId);

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

      realtimeBackoffAttemptRef.current = Math.min(attempt + 1, REALTIME_BACKOFF_MS.length - 1);
      realtimeBackoffTimeoutRef.current = setTimeout(() => {
        realtimeBackoffTimeoutRef.current = null;
        void hydrateLatestNotifications(userId, {
          force: true,
          reason: 'realtime-backoff',
        });
      }, withRetryJitter(baseDelay));
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
  const hydrationScopeRef = useRef({ generation: 0, userId });
  const latestHydrationSequenceByUserRef = useRef<Map<string, number>>(new Map());
  const mountedRef = useRef(false);
  const lastHydrateRef = useRef<{ at: number; userId?: string }>({ at: 0 });
  const recentNotificationEventsRef = useRef<Map<string, number>>(new Map());

  if (hydrationScopeRef.current.userId !== userId) {
    hydrationScopeRef.current = {
      generation: hydrationScopeRef.current.generation + 1,
      userId,
    };
    lastHydrateRef.current = { at: 0, userId };
    recentNotificationEventsRef.current.clear();
  }

  useEffect(() => {
    const latestHydrationSequenceByUser = latestHydrationSequenceByUserRef.current;
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      const activeUserId = hydrationScopeRef.current.userId;

      hydrationScopeRef.current = {
        ...hydrationScopeRef.current,
        generation: hydrationScopeRef.current.generation + 1,
      };

      if (activeUserId) {
        const invalidationSequence =
          (latestHydrationSequenceByUser.get(activeUserId) ?? 0) + 1;
        latestHydrationSequenceByUser.set(activeUserId, invalidationSequence);
      }
    };
  }, []);

  useEffect(() => {
    void ensureForegroundNotificationPresentation();
  }, []);

  const hydrateLatestNotifications = useCallback(async (
    userId: string,
    options: { force?: boolean; notificationId?: string; reason?: string } = {},
  ) => {
    const hydrationGeneration = hydrationScopeRef.current.generation;
    const isCurrentAuthScope = () => (
      mountedRef.current
      && hydrationScopeRef.current.generation === hydrationGeneration
      && hydrationScopeRef.current.userId === userId
    );

    if (!isCurrentAuthScope()) {
      return;
    }

    const now = Date.now();

    if (options.notificationId) {
      const eventKey = `${userId}:${options.notificationId}`;
      const previousEventAt = recentNotificationEventsRef.current.get(eventKey) || 0;

      if (now - previousEventAt < NOTIFICATION_EVENT_DEDUPE_MS) {
        return;
      }

      recentNotificationEventsRef.current.set(eventKey, now);
      for (const [notificationId, seenAt] of recentNotificationEventsRef.current.entries()) {
        if (now - seenAt > NOTIFICATION_EVENT_DEDUPE_MS) {
          recentNotificationEventsRef.current.delete(notificationId);
        }
      }
    }

    if (
      !options.force
      && lastHydrateRef.current.userId === userId
      && now - lastHydrateRef.current.at < NOTIFICATION_SYNC_DEDUPE_MS
    ) {
      return;
    }

    lastHydrateRef.current = { at: now, userId };

    const hydrationSequence =
      (latestHydrationSequenceByUserRef.current.get(userId) ?? 0) + 1;
    latestHydrationSequenceByUserRef.current.set(userId, hydrationSequence);

    const canCommitHydration = () => (
      isCurrentAuthScope()
      && latestHydrationSequenceByUserRef.current.get(userId) === hydrationSequence
    );

    const reason = options.reason || 'unknown';
    const notificationsPromise = getNotificationsPage(
      userId,
      0,
      NOTIFICATIONS_SYNC_PAGE_SIZE,
    )
      .then((notifications) => {
        if (canCommitHydration()) {
          setLatestNotificationsCache(userId, notifications);
        }
      })
      .catch((error) => {
        if (canCommitHydration()) {
          logger.warn('push', `Failed to hydrate latest notifications cache (${reason})`, error);
        }
      });
    const unreadCountPromise = getNotificationCount(userId)
      .then((unreadCount) => {
        if (canCommitHydration()) {
          queryClient.setQueryData(queryKeys.notifications.unreadCount(userId), unreadCount);
        }
      })
      .catch((error) => {
        if (canCommitHydration()) {
          logger.warn('push', `Failed to hydrate notification unread count (${reason})`, error);
        }
      });

    await Promise.all([
      notificationsPromise,
      unreadCountPromise,
    ]);
  }, []);

  useNotificationsRealtimeSubscription({
    booted,
    hydrateLatestNotifications,
    userId,
  });

  const { recoverPushRegistration } = usePushRegistration({ booted, userId });
  const { openPushTarget } = useVerifiedPushTapNavigation(userId);

  useEffect(() => {
    if (!notificationRuntime.supportsNotificationObservers) {
      return;
    }

    let receivedSubscription: { remove: () => void } | null = null;
    let responseSubscription: { remove: () => void } | null = null;
    let releaseForegroundPushes: (() => void) | null = null;
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

          const { content, identifier } = notification.request;
          const payload = normalizePushPayload(
            content.data as Record<string, unknown> | undefined,
          );

          void hydrateLatestNotifications(userId, {
            notificationId: payload.notificationId,
            reason: 'push-received',
          });

          if (content.body) {
            showInAppPushBanner({
              body: content.body,
              id: identifier,
              onPress: () => openPushTarget(payload, identifier),
              title: content.title?.trim() || 'SoRita',
            });
          }
        });
        if (userId) {
          releaseForegroundPushes = claimForegroundPushes();
        }

        responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
          const payload = normalizePushPayload(
            response.notification.request.content.data as Record<string, unknown> | undefined,
          );

          openPushTarget(payload, response.notification.request.identifier);
        });
      })
      .catch((error) => {
        logger.warn('push', 'Failed to initialize notifications module', error);
      });

    return () => {
      cancelled = true;
      releaseForegroundPushes?.();
      receivedSubscription?.remove();
      responseSubscription?.remove();
    };
  }, [hydrateLatestNotifications, openPushTarget, userId]);

  useEffect(() => {
    if (!booted || !notificationRuntime.supportsNotificationObservers) {
      return;
    }

    let cancelled = false;

    void loadNotificationsModule()
      .then(async (Notifications) => {
        const response = await Notifications.getLastNotificationResponseAsync();

        if (!response || cancelled) {
          return;
        }

        const payload = normalizePushPayload(
          response.notification.request.content.data as Record<string, unknown> | undefined,
        );
        const responseId = response.notification.request.identifier;

        try {
          await Notifications.clearLastNotificationResponseAsync();
        } catch (error) {
          logger.debug('push', 'Failed to clear the consumed notification response', {
            error: error instanceof Error ? error.name : 'unknown',
          });
        }

        if (!cancelled) {
          openPushTarget(payload, responseId);
        }
      })
      .catch((error) => {
        logger.warn('push', 'Failed to inspect last notification response', error);
      });

    return () => {
      cancelled = true;
    };
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
        void recoverPushRegistration();
      }

      if (userId) {
        void hydrateLatestNotifications(userId, { force: true, reason: 'foreground' });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [booted, hydrateLatestNotifications, recoverPushRegistration, userId]);

  return null;
}
