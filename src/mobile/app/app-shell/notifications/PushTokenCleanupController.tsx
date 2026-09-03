import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { flushPendingPushTokenCleanupTombstones } from '@/mobile/app/data/repositories/pushNotificationRepository';
import { logger } from '@/mobile/app/platform/feedback/logger';

const RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 300_000] as const;
const MAX_RETRY_ATTEMPTS = 8;
const RETRY_WINDOW_MS = 30 * 60 * 1000;
const RETRY_JITTER_RATIO = 0.2;

function withRetryJitter(delayMs: number) {
  const multiplier = 1 - RETRY_JITTER_RATIO + Math.random() * RETRY_JITTER_RATIO * 2;
  return Math.max(1, Math.round(delayMs * multiplier));
}

/**
 * Runs even while signed out. The revocation capability is intentionally
 * independent of an auth session, so an interrupted logout can be completed
 * before another account is allowed to register the same physical device.
 */
export function PushTokenCleanupController() {
  const { booted } = useAuth();
  const retryAttemptRef = useRef(0);
  const retryWindowStartedAtRef = useRef<number | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  const clearRetry = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const resetRetryBudget = useCallback(() => {
    clearRetry();
    retryAttemptRef.current = 0;
    retryWindowStartedAtRef.current = null;
  }, [clearRetry]);

  const scheduleRetry = useCallback((retry: () => void) => {
    if (retryTimeoutRef.current) {
      return;
    }

    const attempt = retryAttemptRef.current;
    const now = Date.now();
    const windowStartedAt = retryWindowStartedAtRef.current ?? now;
    retryWindowStartedAtRef.current = windowStartedAt;

    if (attempt >= MAX_RETRY_ATTEMPTS || now - windowStartedAt >= RETRY_WINDOW_MS) {
      return;
    }

    const baseDelay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
    const delay = withRetryJitter(baseDelay);
    retryAttemptRef.current = attempt + 1;
    retryTimeoutRef.current = setTimeout(() => {
      retryTimeoutRef.current = null;
      retry();
    }, delay);
  }, []);

  const flush = useCallback(async () => {
    if (!booted || inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    try {
      const result = await flushPendingPushTokenCleanupTombstones();

      if (result.pending === 0) {
        resetRetryBudget();
        return;
      }

      scheduleRetry(() => {
        void flush();
      });
    } catch (error) {
      // No token/capability is included in the log. The durable tombstone stays
      // in secure storage and is retried on the next active/network window.
      logger.debug('push', 'Pending push-token cleanup could not be flushed.', {
        error: error instanceof Error ? error.name : 'unknown',
      });
      scheduleRetry(() => {
        void flush();
      });
    } finally {
      inFlightRef.current = false;
    }
  }, [booted, resetRetryBudget, scheduleRetry]);

  useEffect(() => {
    if (!booted) {
      return;
    }

    void flush();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        resetRetryBudget();
        void flush();
      }
    });

    return () => {
      clearRetry();
      subscription.remove();
    };
  }, [booted, clearRetry, flush, resetRetryBudget]);

  return null;
}
