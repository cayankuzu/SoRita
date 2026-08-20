import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { rootNavigationRef } from '@/mobile/app/app-shell/navigation/navigationRef';
import {
  presentForegroundSystemPushNotification,
  syncSystemPushNotifications,
} from '@/mobile/app/data/repositories/systemPushNotificationRepository';
import { logger } from '@/mobile/app/platform/feedback/logger';
import {
  loadFirebaseMessagingModule,
  type FirebaseMessagingRemoteMessage,
} from '@/mobile/app/platform/notifications/firebaseMessaging';
import { notificationRuntime } from '@/mobile/app/platform/notifications/runtime';

const PUSH_REGISTRATION_RETRY_MS = [5000, 15000, 60000, 300000] as const;

export function SystemPushNotificationsController() {
  const { booted, user } = useAuth();
  const userId = user?.id;
  const subscribedUserIdRef = useRef<string | null>(null);
  const subscriptionInFlightUserIdRef = useRef<string | null>(null);
  const subscriptionRetryAttemptRef = useRef(0);
  const subscriptionRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHandledMessageIdRef = useRef<string | null>(null);
  const appStateRef = useRef(AppState.currentState);

  const clearSubscriptionRetry = useCallback(() => {
    if (subscriptionRetryTimeoutRef.current) {
      clearTimeout(subscriptionRetryTimeoutRef.current);
      subscriptionRetryTimeoutRef.current = null;
    }
  }, []);

  const scheduleSubscriptionRetry = useCallback((retry: () => void) => {
    if (subscriptionRetryTimeoutRef.current) {
      return;
    }

    const attempt = subscriptionRetryAttemptRef.current;
    const delay = PUSH_REGISTRATION_RETRY_MS[
      Math.min(attempt, PUSH_REGISTRATION_RETRY_MS.length - 1)
    ];

    subscriptionRetryAttemptRef.current = Math.min(
      attempt + 1,
      PUSH_REGISTRATION_RETRY_MS.length - 1,
    );
    subscriptionRetryTimeoutRef.current = setTimeout(() => {
      subscriptionRetryTimeoutRef.current = null;
      retry();
    }, delay);
  }, []);

  const openNotificationsScreen = useCallback((messageId?: string | null) => {
    if (messageId && messageId === lastHandledMessageIdRef.current) {
      return;
    }

    if (!rootNavigationRef.isReady()) {
      setTimeout(() => {
        openNotificationsScreen(messageId);
      }, 350);
      return;
    }

    if (!userId) {
      rootNavigationRef.navigate('Auth');
      return;
    }

    lastHandledMessageIdRef.current = messageId ?? null;
    rootNavigationRef.navigate('Notifications');
  }, [userId]);

  const syncSubscription = useCallback(async function syncSubscription() {
    if (!booted || !notificationRuntime.supportsRemotePushRegistration) {
      return;
    }

    if (!userId) {
      clearSubscriptionRetry();
      subscriptionRetryAttemptRef.current = 0;
      subscribedUserIdRef.current = null;
      subscriptionInFlightUserIdRef.current = null;
      return;
    }

    if (
      subscribedUserIdRef.current === userId ||
      subscriptionInFlightUserIdRef.current === userId
    ) {
      return;
    }

    try {
      subscriptionInFlightUserIdRef.current = userId;
      const token = await syncSystemPushNotifications();

      if (token) {
        clearSubscriptionRetry();
        subscriptionRetryAttemptRef.current = 0;
        subscribedUserIdRef.current = userId;
      } else {
        scheduleSubscriptionRetry(() => {
          void syncSubscription();
        });
      }
    } catch (error) {
      logger.warn('push', 'FCM system push sync failed', error);
      scheduleSubscriptionRetry(() => {
        void syncSubscription();
      });
    } finally {
      if (subscriptionInFlightUserIdRef.current === userId) {
        subscriptionInFlightUserIdRef.current = null;
      }
    }
  }, [booted, clearSubscriptionRetry, scheduleSubscriptionRetry, userId]);

  useEffect(() => () => {
    clearSubscriptionRetry();
    subscriptionRetryAttemptRef.current = 0;
  }, [clearSubscriptionRetry, userId]);

  useEffect(() => {
    if (!booted || !userId || !notificationRuntime.supportsRemotePushRegistration) {
      return;
    }

    let cancelled = false;
    let unsubscribeOnMessage: (() => void) | null = null;
    let unsubscribeOnOpened: (() => void) | null = null;
    let unsubscribeOnTokenRefresh: (() => void) | null = null;

    void loadFirebaseMessagingModule()
      .then((firebaseMessaging) => {
        if (cancelled) {
          return;
        }

        const messaging = firebaseMessaging.getMessaging();

        unsubscribeOnMessage = firebaseMessaging.onMessage(messaging, async (remoteMessage: FirebaseMessagingRemoteMessage) => {
          try {
            await presentForegroundSystemPushNotification(remoteMessage);
          } catch (error) {
            logger.warn('push', 'Failed to present foreground FCM system push', error);
          }
        });

        unsubscribeOnOpened = firebaseMessaging.onNotificationOpenedApp(messaging, (remoteMessage: FirebaseMessagingRemoteMessage) => {
          openNotificationsScreen(remoteMessage.messageId);
        });

        unsubscribeOnTokenRefresh = firebaseMessaging.onTokenRefresh(messaging, () => {
          subscribedUserIdRef.current = null;
          void syncSubscription();
        });

        void firebaseMessaging.getInitialNotification(messaging)
          .then((remoteMessage: FirebaseMessagingRemoteMessage | null) => {
            if (remoteMessage) {
              openNotificationsScreen(remoteMessage.messageId);
            }
          })
          .catch((error: unknown) => {
            logger.warn('push', 'Failed to inspect initial FCM notification', error);
          });
      })
      .catch((error) => {
        logger.warn('push', 'Failed to initialize Firebase messaging module', error);
      });

    return () => {
      cancelled = true;
      unsubscribeOnMessage?.();
      unsubscribeOnOpened?.();
      unsubscribeOnTokenRefresh?.();
    };
  }, [booted, openNotificationsScreen, syncSubscription, userId]);

  useEffect(() => {
    void syncSubscription();
  }, [syncSubscription]);

  useEffect(() => {
    if (!booted) {
      return;
    }

    const subscription = AppState.addEventListener('change', (state) => {
      appStateRef.current = state;

      if (state === 'active') {
        void syncSubscription();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [booted, syncSubscription]);

  useEffect(() => {
    if (appStateRef.current === 'active') {
      void syncSubscription();
    }
  }, [userId, syncSubscription]);

  return null;
}
