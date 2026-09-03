import { useCallback, useEffect, useRef } from 'react';

import {
  flushPendingPushTokenCleanupTombstones,
  prepareRegisteredPushTokenAccountSwitchCleanup,
  registerDevicePushToken,
  registerPushNotifications,
} from '@/mobile/app/data/repositories/pushNotificationRepository';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { notificationRuntime } from '@/mobile/app/platform/notifications/runtime';

const PUSH_REGISTRATION_RETRY_MS = [5000, 15000, 60000, 300000] as const;
const PUSH_REGISTRATION_MAX_RETRY_ATTEMPTS = 8;
const PUSH_REGISTRATION_RETRY_WINDOW_MS = 30 * 60 * 1000;
const PUSH_REGISTRATION_JITTER_RATIO = 0.2;

function withRetryJitter(delayMs: number) {
  const multiplier = 1 - PUSH_REGISTRATION_JITTER_RATIO
    + Math.random() * PUSH_REGISTRATION_JITTER_RATIO * 2;
  return Math.max(1, Math.round(delayMs * multiplier));
}

async function loadNotificationsModule() {
  return import('expo-notifications');
}

export function usePushRegistration(params: { booted: boolean; userId?: string }) {
  const { booted, userId } = params;
  const currentUserIdRef = useRef<string | null>(userId ?? null);
  const registeredTokenRef = useRef<string | null>(null);
  const registeredUserIdRef = useRef<string | null>(null);
  const registrationInFlightUserIdRef = useRef<string | null>(null);
  const registrationRetryAttemptRef = useRef(0);
  const registrationRetryWindowStartedAtRef = useRef<number | null>(null);
  const registrationRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  currentUserIdRef.current = userId ?? null;

  const clearRegistrationRetry = useCallback(() => {
    if (registrationRetryTimeoutRef.current) {
      clearTimeout(registrationRetryTimeoutRef.current);
      registrationRetryTimeoutRef.current = null;
    }
  }, []);

  const resetRegistrationRetryBudget = useCallback(() => {
    clearRegistrationRetry();
    registrationRetryAttemptRef.current = 0;
    registrationRetryWindowStartedAtRef.current = null;
  }, [clearRegistrationRetry]);

  const scheduleRegistrationRetry = useCallback((retry: () => void) => {
    if (registrationRetryTimeoutRef.current) {
      return;
    }

    const attempt = registrationRetryAttemptRef.current;
    const now = Date.now();
    const windowStartedAt = registrationRetryWindowStartedAtRef.current ?? now;
    registrationRetryWindowStartedAtRef.current = windowStartedAt;

    if (
      attempt >= PUSH_REGISTRATION_MAX_RETRY_ATTEMPTS
      || now - windowStartedAt >= PUSH_REGISTRATION_RETRY_WINDOW_MS
    ) {
      return;
    }

    const baseDelay = PUSH_REGISTRATION_RETRY_MS[
      Math.min(attempt, PUSH_REGISTRATION_RETRY_MS.length - 1)
    ];
    const delay = withRetryJitter(baseDelay);

    registrationRetryAttemptRef.current = attempt + 1;
    registrationRetryTimeoutRef.current = setTimeout(() => {
      registrationRetryTimeoutRef.current = null;
      retry();
    }, delay);
  }, []);

  const syncPushRegistration = useCallback(async function syncPushRegistration() {
    if (!booted || !notificationRuntime.supportsRemotePushRegistration) {
      return;
    }

    if (!userId) {
      try {
        await prepareRegisteredPushTokenAccountSwitchCleanup(registeredTokenRef.current);
        await flushPendingPushTokenCleanupTombstones();
      } catch (error) {
        logger.debug('push', 'Signed-out push cleanup remains pending.', {
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
      resetRegistrationRetryBudget();
      registeredTokenRef.current = null;
      registeredUserIdRef.current = null;
      registrationInFlightUserIdRef.current = null;
      return;
    }

    const targetUserId = userId;

    if (registeredUserIdRef.current === targetUserId) {
      return;
    }

    if (registrationInFlightUserIdRef.current) {
      scheduleRegistrationRetry(() => {
        void syncPushRegistration();
      });
      return;
    }

    try {
      registrationInFlightUserIdRef.current = targetUserId;

      if (
        registeredUserIdRef.current
        && registeredUserIdRef.current !== targetUserId
      ) {
        await prepareRegisteredPushTokenAccountSwitchCleanup(registeredTokenRef.current);
      }

      const cleanup = await flushPendingPushTokenCleanupTombstones();

      if (cleanup.pending > 0) {
        scheduleRegistrationRetry(() => {
          void syncPushRegistration();
        });
        return;
      }

      if (currentUserIdRef.current !== targetUserId) {
        return;
      }

      const nextToken = await registerPushNotifications(targetUserId);

      if (currentUserIdRef.current !== targetUserId) {
        return;
      }

      if (nextToken) {
        resetRegistrationRetryBudget();
        registeredTokenRef.current = nextToken;
        registeredUserIdRef.current = targetUserId;
      } else {
        scheduleRegistrationRetry(() => {
          void syncPushRegistration();
        });
      }
    } catch (error) {
      logger.warn('push', 'Push registration or cleanup failed', {
        error: error instanceof Error ? error.name : 'unknown',
      });
      scheduleRegistrationRetry(() => {
        void syncPushRegistration();
      });
    } finally {
      if (registrationInFlightUserIdRef.current === targetUserId) {
        registrationInFlightUserIdRef.current = null;
      }
    }
  }, [booted, resetRegistrationRetryBudget, scheduleRegistrationRetry, userId]);

  useEffect(() => () => {
    resetRegistrationRetryBudget();
  }, [resetRegistrationRetryBudget, userId]);

  useEffect(() => {
    if (!booted || !userId || !notificationRuntime.supportsRemotePushRegistration) {
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
          const targetUserId = userId;
          resetRegistrationRetryBudget();

          if (registrationInFlightUserIdRef.current) {
            scheduleRegistrationRetry(() => {
              void syncPushRegistration();
            });
            return;
          }

          void (async () => {
            const previousToken = registeredTokenRef.current;
            registrationInFlightUserIdRef.current = targetUserId;
            registeredUserIdRef.current = null;

            try {
              if (previousToken) {
                await prepareRegisteredPushTokenAccountSwitchCleanup(previousToken);
              }

              const cleanup = await flushPendingPushTokenCleanupTombstones();

              if (cleanup.pending > 0) {
                scheduleRegistrationRetry(() => {
                  void syncPushRegistration();
                });
                return;
              }

              if (cancelled || currentUserIdRef.current !== targetUserId) {
                return;
              }

              const nextToken = await registerDevicePushToken(targetUserId, devicePushToken);

              if (cancelled || currentUserIdRef.current !== targetUserId) {
                return;
              }

              if (nextToken) {
                resetRegistrationRetryBudget();
                registeredTokenRef.current = nextToken;
                registeredUserIdRef.current = targetUserId;
                return;
              }

              scheduleRegistrationRetry(() => {
                void syncPushRegistration();
              });
            } catch (error) {
              logger.warn('push', 'Push token refresh registration or cleanup failed', {
                error: error instanceof Error ? error.name : 'unknown',
              });
              scheduleRegistrationRetry(() => {
                void syncPushRegistration();
              });
            } finally {
              if (registrationInFlightUserIdRef.current === targetUserId) {
                registrationInFlightUserIdRef.current = null;
              }
            }
          })();
        });
      })
      .catch((error) => {
        logger.warn('push', 'Failed to initialize push token listener', {
          error: error instanceof Error ? error.name : 'unknown',
        });
      });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [booted, resetRegistrationRetryBudget, scheduleRegistrationRetry, syncPushRegistration, userId]);

  useEffect(() => {
    void syncPushRegistration();
  }, [syncPushRegistration]);

  return { syncPushRegistration };
}
