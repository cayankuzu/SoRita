type ErrorLike = {
  message: string;
};

type RateLimitRpcRow = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
};

export type RateLimitAdminClientLike = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data?: unknown; error?: ErrorLike | null }>;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
};

export async function enforceRateLimit(params: {
  adminClient: RateLimitAdminClientLike;
  identifier: string;
  maxRequests: number;
  scope: string;
  windowMs: number;
}): Promise<RateLimitResult> {
  if (!params.identifier.trim()) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: params.windowMs,
    };
  }

  const { data, error } = await params.adminClient.rpc('enforce_edge_rate_limit', {
    input_identifier: params.identifier,
    input_max_requests: params.maxRequests,
    input_scope: params.scope,
    input_window_seconds: Math.ceil(params.windowMs / 1000),
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as RateLimitRpcRow | null;

  if (!row) {
    throw new Error('Rate limit RPC returned no data');
  }

  return {
    allowed: row.allowed,
    remaining: row.remaining,
    retryAfterMs: row.retry_after_seconds * 1000,
  };
}

/**
 * Returns rate limit headers for HTTP responses.
 */
export function rateLimitHeaders(result: RateLimitResult, maxRequests: number) {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
  };
  if (result.retryAfterMs) {
    headers['Retry-After'] = Math.ceil(result.retryAfterMs / 1000).toString();
  }
  return headers;
}
