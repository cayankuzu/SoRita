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

export function SystemPushNotificationsController() {
  const { booted, user } = useAuth();
  const subscribedUserIdRef = useRef<string | null>(null);
  const subscriptionInFlightUserIdRef = useRef<string | null>(null);
  const lastHandledMessageIdRef = useRef<string | null>(null);
  const appStateRef = useRef(AppState.currentState);

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

    if (!user) {
      rootNavigationRef.navigate('Auth');
      return;
    }

    lastHandledMessageIdRef.current = messageId ?? null;
    rootNavigationRef.navigate('Notifications');
  }, [user]);

  const syncSubscription = useCallback(async () => {
    if (!booted || !notificationRuntime.supportsRemotePushRegistration) {
      return;
    }

    if (!user) {
      subscribedUserIdRef.current = null;
      subscriptionInFlightUserIdRef.current = null;
      return;
    }

    if (
      subscribedUserIdRef.current === user.id ||
      subscriptionInFlightUserIdRef.current === user.id
    ) {
      return;
    }

    try {
      subscriptionInFlightUserIdRef.current = user.id;
      const token = await syncSystemPushNotifications();

      if (token) {
        subscribedUserIdRef.current = user.id;
      }
    } catch (error) {
      logger.warn('push', 'FCM system push sync failed', error);
    } finally {
      if (subscriptionInFlightUserIdRef.current === user.id) {
        subscriptionInFlightUserIdRef.current = null;
      }
    }
  }, [booted, user]);

  useEffect(() => {
    if (!booted || !user || !notificationRuntime.supportsRemotePushRegistration) {
      return;
    }

    let cancelled = false;
    let unsubscribeOnMessage: (() => void) | null = null;
    let unsubscribeOnOpened: (() => void) | null = null;
    let unsubscribeOnTokenRefresh: (() => void) | null = null;

    void loadFirebaseMessagingModule()
      .then((messaging) => {
        if (cancelled) {
          return;
        }

        const firebaseMessaging = messaging();

        unsubscribeOnMessage = firebaseMessaging.onMessage(async (remoteMessage: FirebaseMessagingRemoteMessage) => {
          try {
            await presentForegroundSystemPushNotification(remoteMessage);
          } catch (error) {
            logger.warn('push', 'Failed to present foreground FCM system push', error);
          }
        });

        unsubscribeOnOpened = firebaseMessaging.onNotificationOpenedApp((remoteMessage: FirebaseMessagingRemoteMessage) => {
          openNotificationsScreen(remoteMessage.messageId);
        });

        unsubscribeOnTokenRefresh = firebaseMessaging.onTokenRefresh(() => {
          subscribedUserIdRef.current = null;
          void syncSubscription();
        });

        void firebaseMessaging.getInitialNotification()
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
  }, [booted, openNotificationsScreen, syncSubscription, user]);

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
  }, [user?.id, syncSubscription]);

  return null;
}
