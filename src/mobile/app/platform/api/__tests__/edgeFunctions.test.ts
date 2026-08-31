import { z } from 'zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { envMock } = vi.hoisted(() => ({
  envMock: {
    edgeApiUrl: '',
    edgeConfigValid: true,
    edgeCutoverMode: 'direct' as 'direct' | 'gateway',
    releaseEnvironment: 'development' as 'development' | 'preview' | 'production',
    supabaseAuthGatewayFunctionName: 'auth-gateway',
    supabaseDeleteUserFunctionName: 'delete-user',
    supabaseMapsFunctionName: 'maps-geocoding',
    supabaseMediaAssetsFunctionName: 'media-assets',
    supabaseModerationReportsFunctionName: 'moderation-reports',
    supabasePublishableKey: 'publishable-key',
    supabaseUrl: 'https://project.supabase.co',
  },
}));

vi.mock('@/mobile/app/platform/config/env', () => ({ env: envMock }));
vi.mock('@/mobile/app/platform/security/requestSigning', () => ({
  createSignedEdgeHeaders: vi.fn(async () => ({
    'x-device-id': 'signed-device',
    'x-nonce': 'signed-nonce-123456',
    'x-signature': 'signed-value',
    'x-timestamp': '1234',
  })),
}));
vi.mock('@/mobile/app/platform/storage/deviceId', () => ({
  getOrCreateDeviceId: vi.fn(async () => 'device-id-1234'),
}));

import {
  callJsonEdgeFunction,
  EdgeFunctionError,
  getForceDirectFunctionUrl,
  getFunctionUrl,
} from '@/mobile/app/platform/api/edgeFunctions';

function createAbortAwareFetch() {
  return vi.fn((_url: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const rejectWithAbort = () => {
        reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      };

      if (init?.signal?.aborted) {
        rejectWithAbort();
        return;
      }

      init?.signal?.addEventListener('abort', rejectWithAbort, { once: true });
    }),
  );
}

describe('Edge Function transport', () => {
  beforeEach(() => {
    envMock.edgeApiUrl = '';
    envMock.edgeConfigValid = true;
    envMock.edgeCutoverMode = 'direct';
    envMock.releaseEnvironment = 'development';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uses direct Supabase URLs by default and exposes an explicit force-direct helper', () => {
    expect(getFunctionUrl('auth-gateway')).toBe(
      'https://project.supabase.co/functions/v1/auth-gateway',
    );
    expect(getForceDirectFunctionUrl('media-assets')).toBe(
      'https://project.supabase.co/functions/v1/media-assets',
    );
  });

  it('routes only selected existing functions through the configured gateway', () => {
    envMock.edgeApiUrl = 'https://api.example.com/edge';
    envMock.edgeCutoverMode = 'gateway';

    expect(getFunctionUrl('maps-geocoding')).toBe(
      'https://api.example.com/edge/v1/maps-geocoding',
    );
    expect(getFunctionUrl('internal-unselected')).toBe(
      'https://project.supabase.co/functions/v1/internal-unselected',
    );
    expect(getForceDirectFunctionUrl('maps-geocoding')).toBe(
      'https://project.supabase.co/functions/v1/maps-geocoding',
    );
  });

  it('does not retry or fall back to direct origin after a gateway network failure', async () => {
    envMock.edgeApiUrl = 'https://api.example.com';
    envMock.edgeCutoverMode = 'gateway';
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('network down'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callJsonEdgeFunction('auth-gateway', {})).rejects.toMatchObject({
      category: 'network',
      code: 'network_error',
      status: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.example.com/v1/auth-gateway');
  });

  it('adds request correlation and an optional idempotency key to POST requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ success: true }));
    vi.stubGlobal('fetch', fetchMock);

    await callJsonEdgeFunction<{ success: boolean }>('moderation-reports', { reportId: 'r1' }, {
      accessToken: 'access-token',
      idempotencyKey: 'report-r1-attempt-1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(init.method).toBe('POST');
    expect(headers.get('idempotency-key')).toBe('report-r1-attempt-1');
    expect(headers.get('x-request-id')).toMatch(/^[a-f0-9-]{36}$/);
  });

  it('reports 429 Retry-After and the response request ID without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(
      { code: 'rate_limited', error: 'Retry later.' },
      {
        status: 429,
        headers: {
          'Retry-After': '3',
          'X-Request-Id': 'edge-request-123',
        },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const error = await callJsonEdgeFunction('auth-gateway', {}).catch((caught) => caught);

    expect(error).toBeInstanceOf(EdgeFunctionError);
    expect(error).toMatchObject({
      category: 'http',
      code: 'rate_limited',
      requestId: 'edge-request-123',
      retryAfterMs: 3_000,
      status: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed successful JSON as an invalid response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{broken', {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })));

    await expect(callJsonEdgeFunction('maps-geocoding', {})).rejects.toMatchObject({
      category: 'invalid_response',
      code: 'invalid_response',
      status: 200,
    });
  });

  it('validates successful payloads with the provided Zod schema', async () => {
    const responseSchema = z.object({ success: z.literal(true) });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: true })));

    await expect(callJsonEdgeFunction('delete-user', {}, { responseSchema })).resolves.toEqual({
      success: true,
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: 'yes' })));
    await expect(callJsonEdgeFunction('delete-user', {}, { responseSchema })).rejects.toMatchObject({
      category: 'invalid_response',
      code: 'invalid_response',
    });
  });

  it('classifies timeout aborts and clears the request timer', async () => {
    vi.useFakeTimers();
    const fetchMock = createAbortAwareFetch();
    vi.stubGlobal('fetch', fetchMock);

    const request = callJsonEdgeFunction('auth-gateway', {}, { timeoutMs: 25 })
      .catch((error) => error);
    await vi.advanceTimersByTimeAsync(25);

    await expect(request).resolves.toMatchObject({
      category: 'timeout',
      code: 'request_timeout',
      status: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('merges and cleans up an external abort signal', async () => {
    const controller = new AbortController();
    const addSpy = vi.spyOn(controller.signal, 'addEventListener');
    const removeSpy = vi.spyOn(controller.signal, 'removeEventListener');
    const fetchMock = createAbortAwareFetch();
    vi.stubGlobal('fetch', fetchMock);

    const request = callJsonEdgeFunction('auth-gateway', {}, { signal: controller.signal });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(request).rejects.toMatchObject({
      category: 'aborted',
      code: 'request_aborted',
      status: 0,
    });
    expect(addSpy).toHaveBeenCalledWith('abort', expect.any(Function), { once: true });
    expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('bounds oversized error parsing and returns a safe generic message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x'.repeat(20_000), {
      headers: {
        'Content-Length': '20000',
        'Content-Type': 'application/json',
      },
      status: 502,
      statusText: 'Bad Gateway',
    })));

    const error = await callJsonEdgeFunction('auth-gateway', {}).catch((caught) => caught);

    expect(error).toMatchObject({
      category: 'http',
      message: 'Bad Gateway',
      status: 502,
    });
    if (!(error instanceof EdgeFunctionError)) throw error;
    expect(error.message.length).toBeLessThan(100);
  });
});
