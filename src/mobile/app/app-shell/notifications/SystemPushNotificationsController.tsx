import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { AppState } from 'react-native';
import { onlineManager } from '@tanstack/react-query';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { rootNavigationRef } from '@/mobile/app/app-shell/navigation/navigationRef';
import {
  scheduleNavigationWhenReady,
  type NavigationRetryHandle,
} from '@/mobile/app/app-shell/notifications/pushNavigation';
import {
  presentForegroundSystemPushNotification,
  syncSystemPushNotifications,
  unregisterSystemPushNotifications,
} from '@/mobile/app/data/repositories/systemPushNotificationRepository';
import { logger } from '@/mobile/app/platform/feedback/logger';
import {
  loadFirebaseMessagingModule,
  type FirebaseMessagingRemoteMessage,
} from '@/mobile/app/platform/notifications/firebaseMessaging';
import { notificationRuntime } from '@/mobile/app/platform/notifications/runtime';

const PUSH_REGISTRATION_RETRY_MS = [5000, 15000, 60000, 300000] as const;
const SYSTEM_PUSH_HEARTBEAT_MS = 15 * 60 * 1000;
const FOREGROUND_MESSAGE_DEDUPE_MS = 30 * 1000;

let desiredSystemPushOwner: { owner: symbol; userId: string | null } | null = null;
let systemPushSubscriptionMutationQueue: Promise<void> = Promise.resolve();
let systemPushUnsubscribeQueued = false;

function withSystemPushSubscriptionMutation<T>(operation: () => Promise<T>) {
  const result = systemPushSubscriptionMutationQueue.then(operation, operation);
  systemPushSubscriptionMutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function unregisterSystemPushWhenUnowned() {
  if (systemPushUnsubscribeQueued) {
    return;
  }

  systemPushUnsubscribeQueued = true;
  void withSystemPushSubscriptionMutation(async () => {
    // The FCM topic is device-wide rather than account-scoped. A replacement
    // controller can claim it between an old controller unmounting and this
    // queued operation running, in which case unsubscribing would drop the
    // newly signed-in account's system deliveries.
    if (desiredSystemPushOwner?.userId) {
      return;
    }

    await unregisterSystemPushNotifications();
  }).catch((error) => {
    logger.warn('push', 'FCM system push unsubscribe failed', error);
  }).finally(() => {
    systemPushUnsubscribeQueued = false;
  });
}

type FirebaseSystemPushListenerOptions = {
  booted: boolean;
  currentUserIdRef: MutableRefObject<string | null>;
  openNotificationsScreen: (messageId?: string | null) => void;
  presentForegroundMessage: (remoteMessage: FirebaseMessagingRemoteMessage) => Promise<void>;
  recoverSubscription: () => Promise<void>;
  subscribedAtRef: MutableRefObject<number>;
  subscribedUserIdRef: MutableRefObject<string | null>;
  userId: string | undefined;
};

function useFirebaseSystemPushListeners({
  booted,
  currentUserIdRef,
  openNotificationsScreen,
  presentForegroundMessage,
  recoverSubscription,
  subscribedAtRef,
  subscribedUserIdRef,
  userId,
}: FirebaseSystemPushListenerOptions) {
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
          if (cancelled || currentUserIdRef.current !== userId) {
            return;
          }

          try {
            await presentForegroundMessage(remoteMessage);
          } catch (error) {
            logger.warn('push', 'Failed to present foreground FCM system push', error);
          }
        });

        unsubscribeOnOpened = firebaseMessaging.onNotificationOpenedApp(messaging, (remoteMessage: FirebaseMessagingRemoteMessage) => {
          if (!cancelled && currentUserIdRef.current === userId) {
            openNotificationsScreen(remoteMessage.messageId);
          }
        });

        unsubscribeOnTokenRefresh = firebaseMessaging.onTokenRefresh(messaging, () => {
          if (cancelled || currentUserIdRef.current !== userId) {
            return;
          }

          subscribedUserIdRef.current = null;
          subscribedAtRef.current = 0;
          void recoverSubscription();
        });

        void firebaseMessaging.getInitialNotification(messaging)
          .then((remoteMessage: FirebaseMessagingRemoteMessage | null) => {
            if (!cancelled && remoteMessage && currentUserIdRef.current === userId) {
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
  }, [
    booted,
    currentUserIdRef,
    openNotificationsScreen,
    presentForegroundMessage,
    recoverSubscription,
    subscribedAtRef,
    subscribedUserIdRef,
    userId,
  ]);
}

export function SystemPushNotificationsController() {
  const { booted, user } = useAuth();
  const userId = user?.id;
  const ownerRef = useRef(Symbol('system-push-controller'));
  const mountedRef = useRef(true);
  const currentUserIdRef = useRef<string | null>(userId ?? null);
  const subscribedUserIdRef = useRef<string | null>(null);
  const subscribedAtRef = useRef(0);
  const subscriptionInFlightUserIdRef = useRef<string | null>(null);
  const subscriptionRetryAttemptRef = useRef(0);
  const subscriptionRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHandledMessageIdRef = useRef<string | null>(null);
  const recentForegroundMessageIdsRef = useRef<Map<string, number>>(new Map());
  const navigationRetryRef = useRef<NavigationRetryHandle | null>(null);
  const navigationRequestIdRef = useRef(0);
  const owner = ownerRef.current;

  currentUserIdRef.current = userId ?? null;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      currentUserIdRef.current = null;

      if (desiredSystemPushOwner?.owner === owner) {
        desiredSystemPushOwner = null;
        unregisterSystemPushWhenUnowned();
      }
    };
  }, [owner]);

  useEffect(() => {
    desiredSystemPushOwner = { owner, userId: userId ?? null };

    return () => {
      if (desiredSystemPushOwner?.owner === owner) {
        desiredSystemPushOwner = null;
        unregisterSystemPushWhenUnowned();
      }
    };
  }, [owner, userId]);

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

    if (messageId) {
      lastHandledMessageIdRef.current = messageId;
    }

    navigationRetryRef.current?.cancel();
    const requestId = navigationRequestIdRef.current + 1;
    navigationRequestIdRef.current = requestId;
    const expectedUserId = userId ?? null;

    const retryHandle = scheduleNavigationWhenReady({
      isReady: () => rootNavigationRef.isReady(),
      onExhausted: () => {
        if (requestId === navigationRequestIdRef.current) {
          logger.debug('push', 'System push tap navigation timed out before the app navigator was ready.');
        }
      },
      onReady: () => {
        if (requestId !== navigationRequestIdRef.current) {
          return;
        }

        if (!expectedUserId) {
          rootNavigationRef.navigate('Auth');
          return;
        }

        if (currentUserIdRef.current !== expectedUserId) {
          return;
        }

        rootNavigationRef.navigate('Notifications');
      },
    });
    navigationRetryRef.current = retryHandle;
  }, [userId]);

  const syncSubscription = useCallback(async function syncSubscription(
    options: { force?: boolean } = {},
  ) {
    if (!booted || !notificationRuntime.supportsRemotePushRegistration) {
      return;
    }

    if (!userId) {
      clearSubscriptionRetry();
      subscriptionRetryAttemptRef.current = 0;
      subscribedUserIdRef.current = null;
      subscribedAtRef.current = 0;
      subscriptionInFlightUserIdRef.current = null;
      return;
    }

    if (
      (
        subscribedUserIdRef.current === userId
        && (
          !options.force
          || Date.now() - subscribedAtRef.current < SYSTEM_PUSH_HEARTBEAT_MS
        )
      ) ||
      subscriptionInFlightUserIdRef.current === userId
    ) {
      return;
    }

    try {
      subscriptionInFlightUserIdRef.current = userId;
      const token = await withSystemPushSubscriptionMutation(async () => {
        if (
          !mountedRef.current
          || currentUserIdRef.current !== userId
          || desiredSystemPushOwner?.owner !== owner
          || desiredSystemPushOwner.userId !== userId
        ) {
          return null;
        }

        return syncSystemPushNotifications();
      });

      if (!mountedRef.current || currentUserIdRef.current !== userId) {
        if (!desiredSystemPushOwner?.userId) {
          unregisterSystemPushWhenUnowned();
        }
        return;
      }

      if (token) {
        clearSubscriptionRetry();
        subscriptionRetryAttemptRef.current = 0;
        subscribedUserIdRef.current = userId;
        subscribedAtRef.current = Date.now();
      }
    } catch (error) {
      logger.warn('push', 'FCM system push sync failed', error);
      if (mountedRef.current && currentUserIdRef.current === userId) {
        scheduleSubscriptionRetry(() => {
          void syncSubscription(options);
        });
      }
    } finally {
      if (subscriptionInFlightUserIdRef.current === userId) {
        subscriptionInFlightUserIdRef.current = null;
      }
    }
  }, [booted, clearSubscriptionRetry, owner, scheduleSubscriptionRetry, userId]);

  const recoverSubscription = useCallback(() => {
    clearSubscriptionRetry();
    subscriptionRetryAttemptRef.current = 0;
    return syncSubscription({ force: true });
  }, [clearSubscriptionRetry, syncSubscription]);

  const presentForegroundMessage = useCallback(async (
    remoteMessage: FirebaseMessagingRemoteMessage,
  ) => {
    const messageId = remoteMessage.messageId;
    const now = Date.now();

    if (messageId) {
      const previousPresentationAt = recentForegroundMessageIdsRef.current.get(messageId) ?? 0;

      if (now - previousPresentationAt < FOREGROUND_MESSAGE_DEDUPE_MS) {
        return;
      }

      recentForegroundMessageIdsRef.current.set(messageId, now);
      for (const [seenMessageId, seenAt] of recentForegroundMessageIdsRef.current.entries()) {
        if (now - seenAt >= FOREGROUND_MESSAGE_DEDUPE_MS) {
          recentForegroundMessageIdsRef.current.delete(seenMessageId);
        }
      }
    }

    try {
      await presentForegroundSystemPushNotification(remoteMessage);
    } catch (error) {
      if (messageId && recentForegroundMessageIdsRef.current.get(messageId) === now) {
        recentForegroundMessageIdsRef.current.delete(messageId);
      }
      throw error;
    }
  }, []);

  useEffect(() => () => {
    clearSubscriptionRetry();
    subscriptionRetryAttemptRef.current = 0;
  }, [clearSubscriptionRetry, userId]);

  useEffect(() => {
    lastHandledMessageIdRef.current = null;
    recentForegroundMessageIdsRef.current.clear();
    navigationRequestIdRef.current += 1;
    navigationRetryRef.current?.cancel();
    navigationRetryRef.current = null;
  }, [userId]);

  useEffect(() => () => {
    navigationRequestIdRef.current += 1;
    navigationRetryRef.current?.cancel();
    navigationRetryRef.current = null;
  }, []);

  useFirebaseSystemPushListeners({
    booted,
    currentUserIdRef,
    openNotificationsScreen,
    presentForegroundMessage,
    recoverSubscription,
    subscribedAtRef,
    subscribedUserIdRef,
    userId,
  });

  useEffect(() => {
    void syncSubscription();
  }, [syncSubscription]);

  useEffect(() => {
    if (!booted) {
      return;
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void recoverSubscription();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [booted, recoverSubscription]);

  useEffect(() => {
    if (!booted || !userId || !notificationRuntime.supportsRemotePushRegistration) {
      return;
    }

    return onlineManager.subscribe((online) => {
      if (online) {
        void recoverSubscription();
      }
    });
  }, [booted, recoverSubscription, userId]);

  return null;
}

export const systemPushNotificationsControllerInternals = {
  resetForTests() {
    desiredSystemPushOwner = null;
    systemPushSubscriptionMutationQueue = Promise.resolve();
    systemPushUnsubscribeQueued = false;
  },
};
