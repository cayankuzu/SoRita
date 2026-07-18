import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { logger } from '@/mobile/app/platform/feedback/logger';

const QUERY_GC_TIME_MS = 1000 * 60 * 60 * 2;
const QUERY_STALE_TIME_MS = 1000 * 60 * 5;
const MAX_QUERY_RETRIES = 1;
const RETRY_DELAY_BASE_MS = 500;
const RETRY_DELAY_CAP_MS = 2000;
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

  return failureCount < MAX_QUERY_RETRIES;
}

function getRetryDelay(attemptIndex: number) {
  return Math.min(RETRY_DELAY_BASE_MS * 2 ** attemptIndex, RETRY_DELAY_CAP_MS);
}

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
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.state.data !== undefined) {
        return;
      }

      logger.warn('query-client', `Query failed for ${query.queryHash}`, error);
    },
  }),
});
