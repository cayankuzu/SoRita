/**
 * In-memory sliding-window rate limiter for Edge Functions.
 * Efficient for serverless: no external dependency, auto-prunes expired entries.
 * For persistent rate limiting across instances, use the DB rate_limits table.
 */

type RateLimitEntry = {
  count: number;
  windowStart: number;
};

type ErrorLike = {
  message: string;
};

type RateLimitRpcRow = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
};

export type RateLimitAdminClientLike = {
  rpc?: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data?: unknown; error?: ErrorLike | null }>;
};

const store = new Map<string, RateLimitEntry>();
const PRUNE_INTERVAL_MS = 60_000;
let lastPruneAt = Date.now();

function pruneExpired(windowMs: number) {
  const now = Date.now();
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;
  for (const [key, entry] of store) {
    if (now - entry.windowStart > windowMs) {
      store.delete(key);
    }
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
};

export async function enforceRateLimit(params: {
  adminClient?: RateLimitAdminClientLike;
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

  if (params.adminClient?.rpc) {
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

  return checkRateLimit(
    `${params.scope}:${params.identifier}`,
    params.maxRequests,
    params.windowMs,
  );
}

/**
 * Check if a request is allowed under the rate limit.
 * @param key - Unique identifier (e.g., userId, IP, deviceId)
 * @param maxRequests - Maximum requests per window
 * @param windowMs - Time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  pruneExpired(windowMs);

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    const retryAfterMs = windowMs - (now - entry.windowStart);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  entry.count += 1;
  return { allowed: true, remaining: maxRequests - entry.count };
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
