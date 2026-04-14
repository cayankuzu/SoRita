import React, { useCallback, useEffect, useRef } from 'react';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { rootNavigationRef } from '@/mobile/app/app-shell/navigation/RootNavigator';
import { registerPushNotifications } from '@/mobile/app/data/repositories/pushNotificationRepository';
import {
  markNotificationRead,
  refreshNotifications,
} from '@/mobile/app/data/repositories/notificationRepository';
import { notificationRuntime } from '@/mobile/app/platform/notifications/runtime';
import { logger } from '@/mobile/app/platform/feedback/logger';

let notificationHandlerConfigured = false;

async function loadNotificationsModule() {
  return import('expo-notifications');
}

async function ensureNotificationHandler() {
  if (!notificationRuntime.supportsNotificationObservers || notificationHandlerConfigured) {
    return;
  }

  const Notifications = await loadNotificationsModule();

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  notificationHandlerConfigured = true;
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

export function PushNotificationsController() {
  const { booted, user } = useAuth();
  const registeredTokenRef = useRef<string | null>(null);
  const lastHandledNotificationIdRef = useRef<string | null>(null);

  useEffect(() => {
    void ensureNotificationHandler();
  }, []);

  const openPushTarget = useCallback(
    (payload: PushPayload) => {
      if (payload.notificationId && payload.notificationId === lastHandledNotificationIdRef.current) {
        return;
      }

      if (user?.id && payload.notificationId) {
        void markNotificationRead(payload.notificationId, user.id).catch((error) => {
          logger.warn('push', 'Failed to mark notification as read from push tap', error);
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
    [user?.id],
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

        receivedSubscription = Notifications.addNotificationReceivedListener(() => {
          if (!user?.id) {
            return;
          }

          void refreshNotifications(user.id).catch((error) => {
            logger.warn('push', 'Failed to refresh notifications after foreground push', error);
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
  }, [openPushTarget, user?.id]);

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
    let cancelled = false;

    const syncPushState = async () => {
      if (!booted || !notificationRuntime.supportsRemotePushRegistration) {
        return;
      }

      if (!user) {
        registeredTokenRef.current = null;
        return;
      }

      try {
        const nextToken = await registerPushNotifications(user.id);

        if (!cancelled && nextToken) {
          registeredTokenRef.current = nextToken;
        }
      } catch (error) {
        logger.warn('push', 'Push registration failed', error);
      }
    };

    void syncPushState();

    return () => {
      cancelled = true;
    };
  }, [booted, user]);

  return null;
}
