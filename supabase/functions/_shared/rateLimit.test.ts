import { describe, expect, it, vi } from 'vitest';

import { enforceRateLimit, rateLimitHeaders } from './rateLimit';

describe('rateLimit', () => {
  it('fails closed for empty identities and normalizes persistent RPC results', async () => {
    const emptyIdentityRpc = vi.fn();
    await expect(enforceRateLimit({
      adminClient: { rpc: emptyIdentityRpc },
      identifier: ' ', maxRequests: 2, scope: 'test', windowMs: 5_000,
    })).resolves.toEqual({ allowed: false, remaining: 0, retryAfterMs: 5_000 });
    expect(emptyIdentityRpc).not.toHaveBeenCalled();

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

  it('emits bounded rate limit headers', () => {
    const denied = { allowed: false, remaining: 0, retryAfterMs: 1_000 };
    expect(rateLimitHeaders(denied, 3)).toMatchObject({
      'X-RateLimit-Limit': '3', 'X-RateLimit-Remaining': '0', 'Retry-After': '1',
    });
    expect(rateLimitHeaders({ allowed: true, remaining: 2 }, 3)).not.toHaveProperty('Retry-After');
  });
});
