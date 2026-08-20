import { describe, expect, it, vi } from 'vitest';

const { loggerErrorMock, loggerWarnMock, trackEventMock } = vi.hoisted(() => ({
  loggerErrorMock: vi.fn(),
  loggerWarnMock: vi.fn(),
  trackEventMock: vi.fn(),
}));

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: { error: loggerErrorMock, warn: loggerWarnMock },
}));

vi.mock('@/mobile/app/platform/analytics/analyticsEvents', () => ({
  trackEvent: trackEventMock,
}));

vi.mock('@/mobile/app/platform/network/connectivityStatus', () => ({
  getCurrentConnectionStatus: () => 'wifi',
}));

vi.mock('@/mobile/app/shared/performance/performanceContext', () => ({
  getPerformanceContext: () => ({
    deviceClass: 'mid',
    osVersion: 'test',
    platform: 'android',
  }),
}));

import { queryClient, queryClientInternals } from '@/mobile/app/data/query/queryClient';

describe('queryClient', () => {
  it('configures sane default query timings and retry behaviour', () => {
    const defaults = queryClient.getDefaultOptions();
    const retry = defaults.queries?.retry as ((failureCount: number, error: unknown) => boolean) | undefined;

    expect(defaults.queries?.gcTime).toBe(1000 * 60 * 60 * 2);
    expect(defaults.queries?.staleTime).toBe(1000 * 60 * 5);
    expect(defaults.queries?.refetchOnMount).toBe(false);
    expect(defaults.queries?.refetchOnReconnect).toBe(true);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
    expect(defaults.mutations?.retry).toBe(false);
    expect(retry?.(0, { status: 500 })).toBe(true);
    expect(retry?.(0, { status: 404 })).toBe(false);
    expect(retry?.(2, new Error('timeout'))).toBe(false);
  });

  it('normalizes transport status shapes and caps retry backoff', () => {
    expect(queryClientInternals.readErrorStatus(null)).toBeUndefined();
    expect(queryClientInternals.readErrorStatus('failure')).toBeUndefined();
    expect(queryClientInternals.readErrorStatus({ status: 401 })).toBe(401);
    expect(queryClientInternals.readErrorStatus({ status: 'bad', statusCode: 409 })).toBe(409);
    expect(queryClientInternals.readErrorStatus({ statusCode: 'bad', code: '422' })).toBe(422);
    expect(queryClientInternals.readErrorStatus({ code: 'not-a-number' })).toBeUndefined();
    expect(queryClientInternals.readErrorStatus({ code: 500 })).toBeUndefined();
    expect(queryClientInternals.readErrorStatus({})).toBeUndefined();
    expect(queryClientInternals.shouldRetryQuery(0, { status: 0 })).toBe(true);
    expect(queryClientInternals.getRetryDelay(0, undefined, () => 0)).toBe(250);
    expect(queryClientInternals.getRetryDelay(8, undefined, () => 1)).toBe(2000);
    expect(queryClientInternals.getRetryDelay(0, {
      response: { headers: { get: () => '3' } },
    })).toBe(3000);
    expect(queryClientInternals.shouldRetryQuery(1, { status: 500 })).toBe(true);
    expect(queryClientInternals.shouldRetryQuery(2, { status: 500 })).toBe(false);
    expect(queryClientInternals.shouldRetryQuery(0, { status: 429 })).toBe(true);
    expect(queryClientInternals.shouldRetryQuery(1, new Error('temporary'))).toBe(false);
  });

  it('supports Retry-After header objects, dates, invalid values, and caps', () => {
    const now = Date.parse('2026-07-20T10:00:00.000Z');

    expect(queryClientInternals.readRetryAfterMs(null, now)).toBeUndefined();
    expect(queryClientInternals.readRetryAfterMs({}, now)).toBeUndefined();
    expect(queryClientInternals.readRetryAfterMs({ response: null }, now)).toBeUndefined();
    expect(queryClientInternals.readRetryAfterMs({ response: {} }, now)).toBeUndefined();
    expect(queryClientInternals.readRetryAfterMs({
      response: { headers: { 'retry-after': '2' } },
    }, now)).toBe(2000);
    expect(queryClientInternals.readRetryAfterMs({
      response: { headers: { 'retry-after': 2 } },
    }, now)).toBeUndefined();
    expect(queryClientInternals.readRetryAfterMs({
      response: { headers: { get: () => 'invalid' } },
    }, now)).toBeUndefined();
    expect(queryClientInternals.readRetryAfterMs({
      response: { headers: { get: () => '2026-07-20T10:00:04.000Z' } },
    }, now)).toBe(4000);
    expect(queryClientInternals.readRetryAfterMs({
      response: { headers: { get: () => '120' } },
    }, now)).toBe(30_000);
    expect(queryClientInternals.readRetryAfterMs({
      response: { headers: { get: () => '2026-07-20T09:00:00.000Z' } },
    }, now)).toBe(0);
  });

  it('suppresses expected mutation logs and avoids duplicate background query warnings', () => {
    const mutationOnError = queryClient.getMutationCache().config.onError!;
    mutationOnError(new Error('suppressed'), undefined, undefined, {
      options: { meta: { suppressGlobalErrorLog: true } },
    } as never, undefined as never);
    expect(loggerErrorMock).not.toHaveBeenCalled();

    mutationOnError(new Error('visible'), undefined, undefined, {
      options: { mutationKey: ['save-place'] },
    } as never, undefined as never);
    mutationOnError(new Error('unknown'), undefined, undefined, {
      options: {},
    } as never, undefined as never);
    expect(loggerErrorMock).toHaveBeenCalledTimes(2);

    const queryOnError = queryClient.getQueryCache().config.onError!;
    queryOnError(new Error('background'), {
      queryHash: 'cached-query', state: { data: { id: 'cached' } },
    } as never);
    expect(loggerWarnMock).not.toHaveBeenCalled();
    queryOnError(new Error('initial'), {
      queryHash: 'empty-query', state: { data: undefined },
    } as never);
    expect(loggerWarnMock).toHaveBeenCalledOnce();
  });

  it('records successful and failed query durations with low-cardinality operations', async () => {
    trackEventMock.mockClear();

    await queryClient.fetchQuery({
      queryKey: ['places', 7, { page: 2 }],
      queryFn: async () => ({ id: 'place-1' }),
      staleTime: 0,
    });

    await expect(queryClient.fetchQuery({
      queryKey: [{ private: 'value' }],
      queryFn: async () => {
        throw new Error('expected');
      },
      retry: false,
    })).rejects.toThrow('expected');

    queryClient.setQueryData(['local-only'], { ready: true });
    await queryClient.invalidateQueries({
      queryKey: ['local-only'],
      refetchType: 'none',
    });

    expect(trackEventMock).toHaveBeenCalledWith({
      name: 'query_complete',
      params: expect.objectContaining({
        deviceClass: 'mid',
        networkClass: 'wifi',
        operation: 'places.7',
        status: 'success',
      }),
    });
    expect(trackEventMock).toHaveBeenCalledWith({
      name: 'query_complete',
      params: expect.objectContaining({
        operation: 'unknown',
        status: 'error',
      }),
    });
  });
});
