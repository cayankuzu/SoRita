import type { Session } from '@supabase/supabase-js';

import { logger } from '@/mobile/app/platform/feedback/logger';
import { AUTH_BOOTSTRAP_SHELL_FALLBACK_MS } from '@/mobile/app/shared/performance/budgets';

const AUTH_SESSION_EXPIRY_SAFETY_WINDOW_MS = 5 * 60_000;
const AUTH_SESSION_REVALIDATION_MIN_DELAY_MS = 30_000;

export const AUTH_SESSION_REVALIDATION_RETRY_DELAY_MS = 60_000;

export type SessionRevalidationOptions = { refreshIfExpiring?: boolean };

export type AuthScopeOperation = {
  generation: number;
  userId: string | null | undefined;
};

function getSessionRevalidationDelay(session: Session | null) {
  if (typeof session?.expires_at !== 'number') {
    return null;
  }

  return Math.max(
    AUTH_SESSION_REVALIDATION_MIN_DELAY_MS,
    session.expires_at * 1000 - Date.now() - AUTH_SESSION_EXPIRY_SAFETY_WINDOW_MS,
  );
}

export function isSessionInsideExpirySafetyWindow(session: Session | null) {
  return (
    typeof session?.expires_at === 'number'
    && session.expires_at * 1000 - Date.now() <= AUTH_SESSION_EXPIRY_SAFETY_WINDOW_MS
  );
}

export function createSessionRevalidationScheduler(
  revalidate: (options: SessionRevalidationOptions) => void,
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;
  const stop = () => {
    generation += 1;

    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  const schedule = (session: Session | null, overrideDelay?: number) => {
    stop();
    const delay = overrideDelay ?? getSessionRevalidationDelay(session);

    if (delay == null) {
      return;
    }

    const scheduledGeneration = generation;
    timeout = setTimeout(() => {
      if (scheduledGeneration !== generation) {
        return;
      }

      timeout = null;
      revalidate({ refreshIfExpiring: true });
    }, delay);
  };

  return { schedule, stop };
}

export function createAuthBootstrapFallback(isPending: () => boolean, showFallback: () => void) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const stop = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  const start = () => {
    stop();
    timeout = setTimeout(() => {
      timeout = null;

      if (!isPending()) {
        return;
      }

      logger.debug('auth', 'Auth bootstrap is taking longer than expected; showing app shell fallback.');
      showFallback();
    }, AUTH_BOOTSTRAP_SHELL_FALLBACK_MS);
  };

  return { start, stop };
}

export function createAuthScopeOperationCoordinator(isMounted: () => boolean) {
  let generation = 0;
  let requestedUserId: string | null | undefined;
  let operationQueue = Promise.resolve();

  const isCurrent = (operation: AuthScopeOperation, expectedUserId = operation.userId) => (
    isMounted()
    && operation.generation === generation
    && operation.userId === expectedUserId
    && requestedUserId === expectedUserId
  );
  const begin = (userId: string | null | undefined): AuthScopeOperation => {
    requestedUserId = userId;
    generation += 1;
    return { generation, userId };
  };
  const assignUser = (operation: AuthScopeOperation, userId: string | null) => {
    if (!isCurrent(operation)) {
      return false;
    }

    operation.userId = userId;
    requestedUserId = userId;
    return true;
  };
  const enqueue = (operation: AuthScopeOperation, task: () => Promise<void>) => {
    const result = operationQueue.then(async () => {
      if (isCurrent(operation)) {
        await task();
      }
    });

    operationQueue = result.catch(() => undefined);
    return result;
  };
  const start = (operation: AuthScopeOperation, task: () => Promise<void>) => {
    const result = isCurrent(operation) ? task() : Promise.resolve();

    operationQueue = result.catch(() => undefined);
    return result;
  };
  const invalidate = () => {
    generation += 1;
    requestedUserId = undefined;
  };

  return {
    assignUser,
    begin,
    enqueue,
    getRequestedUserId: () => requestedUserId,
    invalidate,
    isCurrent,
    start,
  };
}
