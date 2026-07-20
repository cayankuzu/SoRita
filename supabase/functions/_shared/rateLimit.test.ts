import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkRateLimit, enforceRateLimit, rateLimitHeaders } from './rateLimit';

describe('rateLimit', () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it('tracks fallback limits separately for each scope', async () => {
    const identifier = `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const uploadResult = await enforceRateLimit({
      identifier,
      maxRequests: 1,
      scope: 'media:upload',
      windowMs: 60_000,
    });
    const createUploadUrlResult = await enforceRateLimit({
      identifier,
      maxRequests: 1,
      scope: 'media:create-upload-url',
      windowMs: 60_000,
    });
    const repeatedUploadResult = await enforceRateLimit({
      identifier,
      maxRequests: 1,
      scope: 'media:upload',
      windowMs: 60_000,
    });

    expect(uploadResult.allowed).toBe(true);
    expect(createUploadUrlResult.allowed).toBe(true);
    expect(repeatedUploadResult.allowed).toBe(false);
  });

  it('fails closed for empty identities and normalizes persistent RPC results', async () => {
    await expect(enforceRateLimit({
      identifier: ' ', maxRequests: 2, scope: 'test', windowMs: 5_000,
    })).resolves.toEqual({ allowed: false, remaining: 0, retryAfterMs: 5_000 });

    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ allowed: true, remaining: 3, retry_after_seconds: 2 }], error: null })
      .mockResolvedValueOnce({ data: { allowed: false, remaining: 0, retry_after_seconds: 4 }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'rpc failed' } })
      .mockResolvedValueOnce({ data: [], error: null });
    const adminClient = { rpc };
    await expect(enforceRateLimit({
      adminClient, identifier: 'user', maxRequests: 4, scope: 'rpc', windowMs: 1_500,
    })).resolves.toEqual({ allowed: true, remaining: 3, retryAfterMs: 2_000 });
    await expect(enforceRateLimit({
      adminClient, identifier: 'user', maxRequests: 4, scope: 'rpc', windowMs: 1_500,
    })).resolves.toEqual({ allowed: false, remaining: 0, retryAfterMs: 4_000 });
    await expect(enforceRateLimit({
      adminClient, identifier: 'user', maxRequests: 4, scope: 'rpc', windowMs: 1_500,
    })).rejects.toThrow('rpc failed');
    await expect(enforceRateLimit({
      adminClient, identifier: 'user', maxRequests: 4, scope: 'rpc', windowMs: 1_500,
    })).rejects.toThrow('Rate limit RPC returned no data');
    expect(rpc).toHaveBeenCalledWith('enforce_edge_rate_limit', {
      input_identifier: 'user', input_max_requests: 4, input_scope: 'rpc',
      input_window_seconds: 2,
    });
  });

  it('increments local windows, prunes expired entries, and emits retry headers', () => {
    const futureNow = Date.now() + 120_000;
    vi.useFakeTimers();
    vi.setSystemTime(futureNow);
    const key = 'local-window-key';
    expect(checkRateLimit('expired-prune-candidate', 1, 1_000)).toEqual({
      allowed: true,
      remaining: 0,
    });
    expect(checkRateLimit(key, 3, 1_000)).toEqual({ allowed: true, remaining: 2 });
    expect(checkRateLimit(key, 3, 1_000)).toEqual({ allowed: true, remaining: 1 });
    expect(checkRateLimit(key, 3, 1_000)).toEqual({ allowed: true, remaining: 0 });
    const denied = checkRateLimit(key, 3, 1_000);
    expect(denied).toMatchObject({ allowed: false, remaining: 0 });
    expect(rateLimitHeaders(denied, 3)).toMatchObject({
      'X-RateLimit-Limit': '3', 'X-RateLimit-Remaining': '0', 'Retry-After': '1',
    });
    expect(rateLimitHeaders({ allowed: true, remaining: 2 }, 3)).not.toHaveProperty('Retry-After');

    vi.advanceTimersByTime(61_000);
    expect(checkRateLimit(key, 3, 1_000)).toEqual({ allowed: true, remaining: 2 });
  });
});
