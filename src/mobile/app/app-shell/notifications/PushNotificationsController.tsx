import React, { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { rootNavigationRef } from '@/mobile/app/app-shell/navigation/RootNavigator';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import {
  ensureAndroidPushChannel,
  registerDevicePushToken,
  registerPushNotifications,
} from '@/mobile/app/data/repositories/pushNotificationRepository';
import { markNotificationRead } from '@/mobile/app/data/repositories/notificationRepository';
import { notificationRuntime } from '@/mobile/app/platform/notifications/runtime';
import { logger } from '@/mobile/app/platform/feedback/logger';

async function loadNotificationsModule() {
  return import('expo-notifications');
}

let notificationPresentationPromise: Promise<void> | null = null;

export async function ensureForegroundNotificationPresentation() {
  if (!notificationRuntime.supportsNotificationObservers) {
    return;
  }

  if (!notificationPresentationPromise) {
    notificationPresentationPromise = (async () => {
      await ensureAndroidPushChannel().catch(() => undefined);
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

export function PushNotificationsController() {
  const { booted, user } = useAuth();
  const registeredTokenRef = useRef<string | null>(null);
  const registeredUserIdRef = useRef<string | null>(null);
  const registrationInFlightUserIdRef = useRef<string | null>(null);
  const lastHandledNotificationIdRef = useRef<string | null>(null);

  useEffect(() => {
    void ensureForegroundNotificationPresentation();
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

          void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list(user.id) })
            .catch((error) => {
              logger.warn('push', 'Failed to invalidate notifications after foreground push', error);
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
    void syncPushRegistration();
  }, [syncPushRegistration]);

  useEffect(() => {
    if (!booted || !notificationRuntime.featureEnabled) {
      return;
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        return;
      }

      void ensureForegroundNotificationPresentation().catch((error) => {
        logger.warn('push', 'Failed to refresh foreground notification presentation', error);
      });
      void syncPushRegistration();
    });

    return () => {
      subscription.remove();
    };
  }, [booted, syncPushRegistration]);

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
  }, [booted, user?.id]);

  return null;
}
