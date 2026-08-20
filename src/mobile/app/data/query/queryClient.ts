import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { logger } from '@/mobile/app/platform/feedback/logger';
import { trackEvent } from '@/mobile/app/platform/analytics/analyticsEvents';
import { getCurrentConnectionStatus } from '@/mobile/app/platform/network/connectivityStatus';
import { getPerformanceContext } from '@/mobile/app/shared/performance/performanceContext';

const QUERY_GC_TIME_MS = 1000 * 60 * 60 * 2;
const QUERY_STALE_TIME_MS = 1000 * 60 * 5;
const MAX_QUERY_RETRIES = 1;
const MAX_SERVER_QUERY_RETRIES = 2;
const RETRY_DELAY_BASE_MS = 500;
const RETRY_DELAY_CAP_MS = 2000;
const RETRY_AFTER_CAP_MS = 30_000;
const NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 403, 404, 409, 422]);
type MutationMeta = {
  suppressGlobalErrorLog?: boolean;
};

function readErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  if ('status' in error && typeof error.status === 'number') {
    return error.status;
  }

  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode;
  }

  if ('code' in error && typeof error.code === 'string') {
    const parsedCode = Number.parseInt(error.code, 10);
    return Number.isFinite(parsedCode) ? parsedCode : undefined;
  }

  return undefined;
}

function shouldRetryQuery(failureCount: number, error: unknown) {
  const status = readErrorStatus(error);

  if (status && NON_RETRYABLE_STATUS_CODES.has(status)) {
    return false;
  }

  const retryLimit = status === 429 || (status != null && status >= 500)
    ? MAX_SERVER_QUERY_RETRIES
    : MAX_QUERY_RETRIES;
  return failureCount < retryLimit;
}

function readRetryAfterMs(error: unknown, now = Date.now()) {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return undefined;
  }

  const response = error.response;
  if (!response || typeof response !== 'object' || !('headers' in response)) {
    return undefined;
  }

  const headers = response.headers;
  const rawValue =
    headers && typeof headers === 'object' && 'get' in headers && typeof headers.get === 'function'
      ? headers.get('retry-after')
      : headers && typeof headers === 'object' && 'retry-after' in headers
        ? headers['retry-after']
        : undefined;

  if (typeof rawValue !== 'string') {
    return undefined;
  }

  const seconds = Number(rawValue);
  const parsedMs = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(rawValue) - now;

  return Number.isFinite(parsedMs)
    ? Math.max(0, Math.min(parsedMs, RETRY_AFTER_CAP_MS))
    : undefined;
}

function getRetryDelay(
  attemptIndex: number,
  error?: unknown,
  random = Math.random,
) {
  const retryAfterMs = readRetryAfterMs(error);

  if (retryAfterMs != null) {
    return retryAfterMs;
  }

  const ceiling = Math.min(
    RETRY_DELAY_BASE_MS * 2 ** attemptIndex,
    RETRY_DELAY_CAP_MS,
  );
  return Math.round(ceiling * (0.5 + random() * 0.5));
}

export const queryClientInternals = {
  getRetryDelay,
  readRetryAfterMs,
  readErrorStatus,
  shouldRetryQuery,
};

const queryStartedAt = new Map<string, number>();
const queryCache = new QueryCache({
  onError: (error, query) => {
    if (query.state.data !== undefined) {
      return;
    }

    logger.warn('query-client', `Query failed for ${query.queryHash}`, error);
  },
});

function getQueryOperation(queryKey: readonly unknown[]) {
  return queryKey
    .slice(0, 2)
    .filter((part): part is string | number => ['number', 'string'].includes(typeof part))
    .join('.') || 'unknown';
}

queryCache.subscribe((event) => {
  if (event.type !== 'updated') {
    return;
  }

  const actionType = event.action.type;

  if (actionType === 'fetch') {
    queryStartedAt.set(event.query.queryHash, Date.now());
    return;
  }

  if (actionType !== 'success' && actionType !== 'error') {
    return;
  }

  const startedAt = queryStartedAt.get(event.query.queryHash);

  if (startedAt == null) {
    return;
  }

  queryStartedAt.delete(event.query.queryHash);
  trackEvent({
    name: 'query_complete',
    params: {
      ...getPerformanceContext(),
      durationMs: Math.max(0, Date.now() - startedAt),
      networkClass: getCurrentConnectionStatus(),
      operation: getQueryOperation(event.query.queryKey),
      status: actionType,
    },
  });
});

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const mutationMeta = mutation.options.meta as MutationMeta | undefined;

      if (mutationMeta?.suppressGlobalErrorLog) {
        return;
      }

      logger.error(
        'query-client',
        `Mutation failed for ${JSON.stringify(mutation.options.mutationKey ?? 'unknown-mutation')}`,
        error,
      );
    },
  }),
  defaultOptions: {
    mutations: {
      retry: false,
    },
    queries: {
      gcTime: QUERY_GC_TIME_MS,
      refetchOnMount: false,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
      retry: shouldRetryQuery,
      retryDelay: getRetryDelay,
      staleTime: QUERY_STALE_TIME_MS,
    },
  },
  queryCache,
});
