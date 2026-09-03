import { createLocalJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
import { z } from 'zod';

const MAX_JWT_LENGTH = 16 * 1024;
const MAX_JWKS_BYTES = 64 * 1024;
const ALLOWED_JWT_ALGORITHMS = ['ES256', 'RS256'] as const;
const JWKS_FRESH_TTL_MS = 10 * 60 * 1_000;
const JWKS_STALE_GRACE_MS = 5 * 60 * 1_000;
const KID_MISS_REFRESH_COOLDOWN_MS = 30 * 1_000;
const MAX_JWKS_CACHE_ENTRIES = 4;
const MAX_NEGATIVE_KIDS_PER_ISSUER = 32;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const jwksSchema = z
  .object({
    keys: z
      .array(
        z
          .object({
            alg: z.string().optional(),
            crv: z.string().optional(),
            e: z.string().optional(),
            kid: z.string().max(256).optional(),
            kty: z.string().min(1),
            n: z.string().optional(),
            use: z.string().optional(),
            x: z.string().optional(),
            y: z.string().optional(),
          })
          .passthrough(),
      )
      .min(1)
      .max(16),
  })
  .strict();

type Jwks = z.infer<typeof jwksSchema>;
type JwksCacheEntry = {
  freshUntilMs: number;
  jwks: Jwks;
  staleUntilMs: number;
};
type KidMissOutcome = 'invalid' | 'unavailable';
type KidMissState = {
  lastOutcome: KidMissOutcome;
  negativeKids: Map<string, KidMissOutcome>;
  refreshNotBeforeMs: number;
};

const jwksCache = new Map<string, JwksCacheEntry>();
const kidMissStates = new Map<string, KidMissState>();

export type FetchFunction = typeof fetch;

export class InvalidJwtError extends Error {
  constructor() {
    super('JWT validation failed');
    this.name = 'InvalidJwtError';
  }
}

export class JwtVerifierUnavailableError extends Error {
  constructor() {
    super('JWT verifier unavailable');
    this.name = 'JwtVerifierUnavailableError';
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function readBoundedText(response: Response, maximumBytes: number): Promise<string> {
  const contentLengthValue = response.headers.get('content-length');
  const contentLength = contentLengthValue ? Number(contentLengthValue) : undefined;

  if (
    contentLength !== undefined &&
    (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > maximumBytes)
  ) {
    await response.body?.cancel();
    throw new JwtVerifierUnavailableError();
  }

  const reader = response.body?.getReader();

  if (!reader) {
    return '';
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const result = await reader.read();

    if (result.done) {
      break;
    }

    if (!result.value) {
      continue;
    }

    totalBytes += result.value.byteLength;

    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new JwtVerifierUnavailableError();
    }

    chunks.push(result.value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    throw new JwtVerifierUnavailableError();
  }
}

async function fetchJwks(params: {
  fetchFunction: FetchFunction;
  jwksUrl: URL;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort('jwks_timeout');
  }, params.timeoutMs);

  try {
    const response = await params.fetchFunction(params.jwksUrl, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      redirect: 'manual',
      signal: controller.signal,
    });

    if (!response.ok || response.status >= 300) {
      await response.body?.cancel();
      throw new JwtVerifierUnavailableError();
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

    if (!contentType.includes('application/json')) {
      await response.body?.cancel();
      throw new JwtVerifierUnavailableError();
    }

    const bodyText = await readBoundedText(response, MAX_JWKS_BYTES);
    let parsedBody: unknown;

    try {
      parsedBody = JSON.parse(bodyText);
    } catch {
      throw new JwtVerifierUnavailableError();
    }

    const result = jwksSchema.safeParse(parsedBody);

    if (!result.success) {
      throw new JwtVerifierUnavailableError();
    }

    return result.data;
  } catch (error) {
    if (error instanceof JwtVerifierUnavailableError) {
      throw error;
    }

    if (timedOut || controller.signal.aborted) {
      throw new JwtVerifierUnavailableError();
    }

    throw new JwtVerifierUnavailableError();
  } finally {
    clearTimeout(timeout);
  }
}

function cacheJwks(cacheKey: string, jwks: Jwks, nowMs: number): Jwks {
  // Only resolved, structured-cloneable key data may cross request boundaries.
  // Never cache a fetch/Response/stream/Promise created by another invocation.
  const cachedJwks = structuredClone(jwks);
  jwksCache.delete(cacheKey);
  jwksCache.set(cacheKey, {
    freshUntilMs: nowMs + JWKS_FRESH_TTL_MS,
    jwks: cachedJwks,
    staleUntilMs: nowMs + JWKS_FRESH_TTL_MS + JWKS_STALE_GRACE_MS,
  });

  while (jwksCache.size > MAX_JWKS_CACHE_ENTRIES) {
    const oldestKey = jwksCache.keys().next().value;

    if (oldestKey === undefined) {
      break;
    }

    jwksCache.delete(oldestKey);
    kidMissStates.delete(oldestKey);
  }

  return cachedJwks;
}

function readCachedJwks(cacheKey: string): JwksCacheEntry | undefined {
  const entry = jwksCache.get(cacheKey);

  if (entry) {
    jwksCache.delete(cacheKey);
    jwksCache.set(cacheKey, entry);
  }

  return entry;
}

function containsKeyId(jwks: Jwks, kid: string | undefined): boolean {
  return kid === undefined || jwks.keys.some((key) => key.kid === kid);
}

async function refreshJwks(params: {
  cacheKey: string;
  fetchFunction: FetchFunction;
  jwksUrl: URL;
  nowMs: number;
  timeoutMs: number;
}): Promise<Jwks> {
  // A fetch Promise belongs to the request that created it. Concurrent Worker
  // invocations intentionally perform independent refreshes instead of sharing
  // request-scoped I/O through module state.
  const jwks = await fetchJwks({
    fetchFunction: params.fetchFunction,
    jwksUrl: params.jwksUrl,
    timeoutMs: params.timeoutMs,
  });
  return cacheJwks(params.cacheKey, jwks, params.nowMs);
}

function readKidMissState(cacheKey: string): KidMissState {
  const existing = kidMissStates.get(cacheKey);

  if (existing) {
    kidMissStates.delete(cacheKey);
    kidMissStates.set(cacheKey, existing);
    return existing;
  }

  const created: KidMissState = {
    lastOutcome: 'invalid',
    negativeKids: new Map(),
    refreshNotBeforeMs: 0,
  };
  kidMissStates.set(cacheKey, created);

  while (kidMissStates.size > MAX_JWKS_CACHE_ENTRIES) {
    const oldestKey = kidMissStates.keys().next().value;

    if (oldestKey === undefined) {
      break;
    }

    kidMissStates.delete(oldestKey);
  }

  return created;
}

function cacheNegativeKid(
  state: KidMissState,
  kid: string,
  outcome: KidMissOutcome,
): void {
  state.negativeKids.delete(kid);
  state.negativeKids.set(kid, outcome);

  while (state.negativeKids.size > MAX_NEGATIVE_KIDS_PER_ISSUER) {
    const oldestKid = state.negativeKids.keys().next().value;

    if (oldestKid === undefined) {
      break;
    }

    state.negativeKids.delete(oldestKid);
  }
}

function rememberKidMiss(
  state: KidMissState,
  kid: string,
  nowMs: number,
  outcome: KidMissOutcome,
): void {
  state.lastOutcome = outcome;
  state.refreshNotBeforeMs = Math.max(
    state.refreshNotBeforeMs,
    nowMs + KID_MISS_REFRESH_COOLDOWN_MS,
  );
  cacheNegativeKid(state, kid, outcome);
}

function throwKidMiss(outcome: KidMissOutcome): never {
  if (outcome === 'unavailable') {
    throw new JwtVerifierUnavailableError();
  }

  throw new InvalidJwtError();
}

async function resolveKidMiss(params: {
  cacheKey: string;
  fetchFunction: FetchFunction;
  jwksUrl: URL;
  kid: string;
  nowMs: number;
  timeoutMs: number;
}): Promise<Jwks> {
  const state = readKidMissState(params.cacheKey);

  if (params.nowMs < state.refreshNotBeforeMs) {
    const outcome = state.negativeKids.get(params.kid) ?? state.lastOutcome;
    cacheNegativeKid(state, params.kid, outcome);
    throwKidMiss(outcome);
  }

  state.negativeKids.clear();

  try {
    const jwks = await refreshJwks(params);

    if (containsKeyId(jwks, params.kid)) {
      state.refreshNotBeforeMs = 0;
      return jwks;
    }

    rememberKidMiss(state, params.kid, params.nowMs, 'invalid');
    throw new InvalidJwtError();
  } catch (error) {
    if (error instanceof InvalidJwtError) {
      throw error;
    }

    rememberKidMiss(state, params.kid, params.nowMs, 'unavailable');
    throw new JwtVerifierUnavailableError();
  }
}

async function resolveJwks(params: {
  cacheKey: string;
  fetchFunction: FetchFunction;
  jwksUrl: URL;
  kid?: string;
  nowMs: number;
  timeoutMs: number;
}): Promise<Jwks> {
  const cached = readCachedJwks(params.cacheKey);
  const cachedContainsKid = cached ? containsKeyId(cached.jwks, params.kid) : false;

  if (cached && params.nowMs < cached.freshUntilMs && cachedContainsKid) {
    return cached.jwks;
  }

  if (params.kid !== undefined && !cachedContainsKid) {
    return resolveKidMiss({ ...params, kid: params.kid });
  }

  try {
    return await refreshJwks(params);
  } catch (error) {
    if (
      error instanceof JwtVerifierUnavailableError &&
      cached &&
      cachedContainsKid &&
      params.nowMs <= cached.staleUntilMs
    ) {
      return cached.jwks;
    }

    throw error;
  }
}

export function readBearerToken(headerValue: string | null): string | undefined {
  if (!headerValue) {
    return undefined;
  }

  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(headerValue);

  if (!match?.[1] || match[1].length > MAX_JWT_LENGTH) {
    throw new InvalidJwtError();
  }

  return match[1];
}

export async function verifySupabaseJwt(params: {
  audience: string;
  fetchFunction: FetchFunction;
  nowMs: number;
  supabaseOrigin: string;
  timeoutMs: number;
  token: string;
}): Promise<{ userId: string }> {
  const issuer = new URL('/auth/v1', params.supabaseOrigin).toString().replace(/\/$/, '');
  const jwksUrl = new URL('/auth/v1/.well-known/jwks.json', params.supabaseOrigin);
  let kid: string | undefined;

  try {
    kid = decodeProtectedHeader(params.token).kid;
  } catch {
    throw new InvalidJwtError();
  }

  if (kid !== undefined && (kid.length === 0 || kid.length > 256)) {
    throw new InvalidJwtError();
  }

  const jwks = await resolveJwks({
    cacheKey: issuer,
    fetchFunction: params.fetchFunction,
    jwksUrl,
    kid,
    nowMs: params.nowMs,
    timeoutMs: params.timeoutMs,
  });

  try {
    const result = await jwtVerify(params.token, createLocalJWKSet(jwks), {
      algorithms: [...ALLOWED_JWT_ALGORITHMS],
      audience: params.audience,
      clockTolerance: 5,
      currentDate: new Date(params.nowMs),
      issuer,
    });
    const userId = result.payload.sub;

    if (!userId || !UUID_PATTERN.test(userId)) {
      throw new InvalidJwtError();
    }

    return { userId };
  } catch (error) {
    if (error instanceof InvalidJwtError) {
      throw error;
    }

    throw new InvalidJwtError();
  }
}

export const securityTestInternals = {
  clearJwksCache(): void {
    jwksCache.clear();
    kidMissStates.clear();
  },
  getJwksCacheSize(): number {
    return jwksCache.size;
  },
  getNegativeKidCount(): number {
    return Array.from(
      kidMissStates.values(),
      (state) => state.negativeKids.size,
    ).reduce((total, size) => total + size, 0);
  },
  KID_MISS_REFRESH_COOLDOWN_MS,
  JWKS_FRESH_TTL_MS,
  JWKS_STALE_GRACE_MS,
  MAX_JWKS_CACHE_ENTRIES,
  MAX_NEGATIVE_KIDS_PER_ISSUER,
} as const;

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message),
  );
  return new Uint8Array(signature);
}

export async function hashIpAddress(ipAddress: string, pepper: string): Promise<string> {
  return bytesToBase64Url(await hmacSha256(pepper, ipAddress));
}

export function buildOriginSigningMessage(params: {
  bodyHash: string;
  canonicalPath: string;
  method: string;
  nonce: string;
  timestamp: string;
}): string {
  return [
    params.timestamp,
    params.nonce,
    params.method.toUpperCase(),
    params.canonicalPath,
    params.bodyHash,
  ].join('\n');
}

export async function createOriginSignature(params: {
  bodyText: string;
  canonicalPath: string;
  method: string;
  nonce: string;
  secret: string;
  timestamp: string;
}): Promise<{ bodyHash: string; signature: string }> {
  const bodyHash = await sha256Hex(params.bodyText);
  const message = buildOriginSigningMessage({
    bodyHash,
    canonicalPath: params.canonicalPath,
    method: params.method,
    nonce: params.nonce,
    timestamp: params.timestamp,
  });
  const signature = bytesToBase64Url(await hmacSha256(params.secret, message));
  return { bodyHash, signature: `v1=${signature}` };
}
