import { useCallback, useEffect, useRef } from 'react';
import { onlineManager } from '@tanstack/react-query';

import {
  flushPendingPushTokenCleanupTombstones,
  prepareRegisteredPushTokenAccountSwitchCleanup,
  registerDevicePushToken,
  registerPushNotifications,
} from '@/mobile/app/data/repositories/pushNotificationRepository';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { notificationRuntime } from '@/mobile/app/platform/notifications/runtime';
import { withRetryJitter } from '@/mobile/app/shared/utils/retryJitter';

const PUSH_REGISTRATION_RETRY_MS = [5000, 15000, 60000, 300000] as const;
const PUSH_REGISTRATION_MAX_RETRY_ATTEMPTS = 8;
const PUSH_REGISTRATION_RETRY_WINDOW_MS = 30 * 60 * 1000;
const PUSH_REGISTRATION_HEARTBEAT_MS = 15 * 60 * 1000;

async function loadNotificationsModule() {
  return import('expo-notifications');
}

function useRegistrationRetryController() {
  const registrationRetryAttemptRef = useRef(0);
  const registrationRetryWindowStartedAtRef = useRef<number | null>(null);
  const registrationRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return { resetRegistrationRetryBudget, scheduleRegistrationRetry };
}

export function usePushRegistration(params: { booted: boolean; userId?: string }) {
  const { booted, userId } = params;
  const currentUserIdRef = useRef<string | null>(userId ?? null);
  const mountedRef = useRef(true);
  const registeredTokenRef = useRef<string | null>(null);
  const registeredUserIdRef = useRef<string | null>(null);
  const registeredAtRef = useRef(0);
  const registrationInFlightUserIdRef = useRef<string | null>(null);
  const pendingTokenRefreshUserIdRef = useRef<string | null>(null);
  const {
    resetRegistrationRetryBudget,
    scheduleRegistrationRetry,
  } = useRegistrationRetryController();

  currentUserIdRef.current = userId ?? null;

  const cleanupStaleRegistration = useCallback(async (token: string) => {
    try {
      await prepareRegisteredPushTokenAccountSwitchCleanup(token);
      await flushPendingPushTokenCleanupTombstones();
    } catch (error) {
      logger.debug('push', 'Stale push registration cleanup remains pending.', {
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
  }, []);

  const syncPushRegistration = useCallback(async function syncPushRegistration(
    options: { force?: boolean } = {},
  ) {
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
      registeredAtRef.current = 0;
      registrationInFlightUserIdRef.current = null;
      return;
    }

    const targetUserId = userId;

    if (
      registeredUserIdRef.current === targetUserId
      && (
        !options.force
        || Date.now() - registeredAtRef.current < PUSH_REGISTRATION_HEARTBEAT_MS
      )
    ) {
      return;
    }

    if (registrationInFlightUserIdRef.current) {
      scheduleRegistrationRetry(() => {
        void syncPushRegistration(options);
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

      if (!mountedRef.current || currentUserIdRef.current !== targetUserId) {
        return;
      }

      const nextToken = await registerPushNotifications(targetUserId);

      if (!mountedRef.current || currentUserIdRef.current !== targetUserId) {
        if (nextToken) {
          await cleanupStaleRegistration(nextToken);
        }
        return;
      }

      if (nextToken) {
        resetRegistrationRetryBudget();
        registeredTokenRef.current = nextToken;
        registeredUserIdRef.current = targetUserId;
        registeredAtRef.current = Date.now();
      }
    } catch (error) {
      logger.warn('push', 'Push registration or cleanup failed', {
        error: error instanceof Error ? error.name : 'unknown',
      });
      if (mountedRef.current && currentUserIdRef.current === targetUserId) {
        scheduleRegistrationRetry(() => {
          void syncPushRegistration(options);
        });
      }
    } finally {
      if (registrationInFlightUserIdRef.current === targetUserId) {
        registrationInFlightUserIdRef.current = null;
      }

      if (
        pendingTokenRefreshUserIdRef.current === targetUserId
        && mountedRef.current
        && currentUserIdRef.current === targetUserId
      ) {
        pendingTokenRefreshUserIdRef.current = null;
        registeredUserIdRef.current = null;
        registeredAtRef.current = 0;
        void syncPushRegistration({ force: true });
      }
    }
  }, [
    booted,
    cleanupStaleRegistration,
    resetRegistrationRetryBudget,
    scheduleRegistrationRetry,
    userId,
  ]);

  const recoverPushRegistration = useCallback(() => {
    resetRegistrationRetryBudget();
    return syncPushRegistration({ force: true });
  }, [resetRegistrationRetryBudget, syncPushRegistration]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      currentUserIdRef.current = null;
      pendingTokenRefreshUserIdRef.current = null;
      resetRegistrationRetryBudget();
    };
  }, [resetRegistrationRetryBudget]);

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
            pendingTokenRefreshUserIdRef.current = targetUserId;
            registeredUserIdRef.current = null;
            registeredAtRef.current = 0;
            return;
          }

          void (async () => {
            registrationInFlightUserIdRef.current = targetUserId;
            registeredUserIdRef.current = null;

            try {
              const cleanup = await flushPendingPushTokenCleanupTombstones();

              if (cleanup.pending > 0) {
                scheduleRegistrationRetry(() => {
                  void syncPushRegistration();
                });
                return;
              }

              if (cancelled || !mountedRef.current || currentUserIdRef.current !== targetUserId) {
                return;
              }

              const nextToken = await registerDevicePushToken(targetUserId, devicePushToken);

              if (cancelled || !mountedRef.current || currentUserIdRef.current !== targetUserId) {
                if (nextToken) {
                  await cleanupStaleRegistration(nextToken);
                }
                return;
              }

              if (nextToken) {
                resetRegistrationRetryBudget();
                registeredTokenRef.current = nextToken;
                registeredUserIdRef.current = targetUserId;
                registeredAtRef.current = Date.now();
                return;
              }
            } catch (error) {
              logger.warn('push', 'Push token refresh registration or cleanup failed', {
                error: error instanceof Error ? error.name : 'unknown',
              });
              if (!cancelled && mountedRef.current && currentUserIdRef.current === targetUserId) {
                scheduleRegistrationRetry(() => {
                  void syncPushRegistration({ force: true });
                });
              }
            } finally {
              if (registrationInFlightUserIdRef.current === targetUserId) {
                registrationInFlightUserIdRef.current = null;
              }

              if (
                pendingTokenRefreshUserIdRef.current === targetUserId
                && !cancelled
                && mountedRef.current
                && currentUserIdRef.current === targetUserId
              ) {
                pendingTokenRefreshUserIdRef.current = null;
                registeredUserIdRef.current = null;
                registeredAtRef.current = 0;
                void syncPushRegistration({ force: true });
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
  }, [
    booted,
    cleanupStaleRegistration,
    resetRegistrationRetryBudget,
    scheduleRegistrationRetry,
    syncPushRegistration,
    userId,
  ]);

  useEffect(() => {
    if (!booted || !userId || !notificationRuntime.supportsRemotePushRegistration) {
      return;
    }

    return onlineManager.subscribe((online) => {
      if (online) {
        void recoverPushRegistration();
      }
    });
  }, [booted, recoverPushRegistration, userId]);

  useEffect(() => {
    void syncPushRegistration();
  }, [syncPushRegistration]);

  return { recoverPushRegistration, syncPushRegistration };
}

export const pushRegistrationInternals = {
  PUSH_REGISTRATION_HEARTBEAT_MS,
};
