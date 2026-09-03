import { exports } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleWorkerRequest } from '../src/index';
import {
  InvalidJwtError,
  JwtVerifierUnavailableError,
  securityTestInternals,
  sha256Hex,
  verifySupabaseJwt,
} from '../src/security';
import {
  createDependencies,
  createJsonRequest,
  createJwtFixture,
  createRateLimitStub,
  createTestEnv,
  jsonOriginResponse,
  TEST_HMAC_SECRET,
  TEST_IP_PEPPER,
  TEST_NOW_MS,
  TEST_REQUEST_ID,
  TEST_SUPABASE_ORIGIN,
  TEST_USER_B_ID,
  TEST_USER_ID,
  toFetchFunction,
} from './helpers';

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function replaceTokenKid(token: string, kid: string): string {
  const segments = token.split('.');
  const payload = segments[1];
  const signature = segments[2];

  if (!payload || !signature) {
    throw new Error('JWT fixture is malformed.');
  }

  const protectedHeader = btoa(JSON.stringify({ alg: 'ES256', kid, typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${protectedHeader}.${payload}.${signature}`;
}

describe('JWT verification and gateway identity', () => {
  beforeEach(() => {
    securityTestInternals.clearJwksCache();
  });

  it('verifies a signed Supabase JWT and forwards only the user bearer and publishable key', async () => {
    const jwt = await createJwtFixture();
    const token = await jwt.signToken();
    const originRequests: Request[] = [];
    const apiLimiter = createRateLimitStub();
    const fetchFunction = toFetchFunction(async (request) => {
      if (new URL(request.url).pathname.endsWith('/.well-known/jwks.json')) {
        return jsonOriginResponse(jwt.jwks);
      }

      originRequests.push(request);
      return jsonOriginResponse({ results: [] });
    });
    const response = await handleWorkerRequest(
      createJsonRequest('/v1/maps-geocoding', { action: 'search', query: 'Istanbul' }, {
        headers: { 'Cf-Ray': 'abc123-IST' },
        token,
      }),
      createTestEnv({ API_RATE_LIMITER: apiLimiter }),
      createDependencies(fetchFunction),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('x-request-id')).toBe(TEST_REQUEST_ID);
    expect(response.headers.get('x-cf-ray')).toBe('abc123-IST');
    expect(originRequests).toHaveLength(1);
    const originRequest = originRequests[0];
    expect(originRequest).toBeDefined();
    expect(originRequest?.headers.get('authorization')).toBe(`Bearer ${token}`);
    expect(originRequest?.headers.get('apikey')).toBe(
      'test-anon-publishable-key-with-safe-placeholder',
    );
    expect(originRequest?.headers.has('cookie')).toBe(false);
    expect(originRequest?.headers.has('x-service-role-key')).toBe(false);
    expect(apiLimiter.keys).toHaveLength(2);
    expect(apiLimiter.keys[0]).toMatch(/^coarse-ip:[A-Za-z0-9_-]+$/);
    expect(apiLimiter.keys[0]).not.toContain('203.0.113.9');
    expect(apiLimiter.keys[1]).toBe(`user:${TEST_USER_ID}:/v1/maps-geocoding:search`);
  });

  it('rejects invalid signature, issuer, audience, expiry, and nbf before the origin', async () => {
    const trustedFixture = await createJwtFixture();
    const untrustedFixture = await createJwtFixture();
    const nowSeconds = Math.floor(TEST_NOW_MS / 1000);
    const cases = [
      await untrustedFixture.signToken(),
      await trustedFixture.signToken({ issuer: 'https://issuer.example/auth/v1' }),
      await trustedFixture.signToken({ audience: 'wrong-audience' }),
      await trustedFixture.signToken({ expiresAtSeconds: nowSeconds - 60 }),
      await trustedFixture.signToken({ notBeforeSeconds: nowSeconds + 60 }),
    ];

    for (const token of cases) {
      let originCalled = false;
      const fetchFunction = toFetchFunction((request) => {
        if (new URL(request.url).pathname.endsWith('/.well-known/jwks.json')) {
          return jsonOriginResponse(trustedFixture.jwks);
        }

        originCalled = true;
        return jsonOriginResponse();
      });
      const response = await handleWorkerRequest(
        createJsonRequest('/v1/maps-geocoding', { action: 'search', query: 'Istanbul' }, { token }),
        createTestEnv(),
        createDependencies(fetchFunction),
      );

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({ code: 'invalid_token' });
      expect(originCalled).toBe(false);
    }
  });

  it('allows only the explicit public auth actions without a JWT and hashes the IP limiter key', async () => {
    const authLimiter = createRateLimitStub();
    let jwksCalled = false;
    const fetchFunction = toFetchFunction((request) => {
      if (new URL(request.url).pathname.endsWith('/.well-known/jwks.json')) {
        jwksCalled = true;
      }

      return jsonOriginResponse({
        session: {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
        },
      });
    });
    const response = await handleWorkerRequest(
      createJsonRequest(
        '/v1/auth-gateway',
        { action: 'login', email: 'user@example.com', password: 'not-logged' },
        { ipAddress: '203.0.113.55', origin: null },
      ),
      createTestEnv({ AUTH_RATE_LIMITER: authLimiter }),
      createDependencies(fetchFunction),
    );

    expect(response.status).toBe(200);
    expect(jwksCalled).toBe(false);
    expect(authLimiter.keys).toHaveLength(1);
    expect(authLimiter.keys[0]).toMatch(/^ip:[A-Za-z0-9_-]+:\/v1\/auth-gateway:login$/);
    expect(authLimiter.keys[0]).not.toContain('203.0.113.55');
  });

  it('requires a bearer token for every protected route', async () => {
    let originCalled = false;
    const response = await handleWorkerRequest(
      createJsonRequest('/v1/maps-geocoding', { action: 'search', query: 'Istanbul' }),
      createTestEnv(),
      createDependencies(toFetchFunction(() => {
        originCalled = true;
        return jsonOriginResponse();
      })),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'missing_authorization' });
    expect(originCalled).toBe(false);
  });

  it('applies the coarse IP limiter before JWT/JWKS work and fails closed', async () => {
    const jwt = await createJwtFixture();
    const token = await jwt.signToken();
    let fetchCalls = 0;
    const fetchFunction = toFetchFunction(() => {
      fetchCalls += 1;
      return jsonOriginResponse(jwt.jwks);
    });
    const denied = await handleWorkerRequest(
      createJsonRequest('/v1/maps-geocoding', { action: 'search', query: 'Istanbul' }, { token }),
      createTestEnv({ API_RATE_LIMITER: createRateLimitStub({ success: false }) }),
      createDependencies(fetchFunction),
    );

    expect(denied.status).toBe(429);
    expect(denied.headers.get('retry-after')).toBe('60');
    expect(fetchCalls).toBe(0);

    const unavailable = await handleWorkerRequest(
      createJsonRequest('/v1/maps-geocoding', { action: 'search', query: 'Istanbul' }, { token }),
      createTestEnv({
        API_RATE_LIMITER: createRateLimitStub({ error: new Error('binding unavailable') }),
      }),
      createDependencies(fetchFunction),
    );

    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toMatchObject({ code: 'rate_limit_unavailable' });
    expect(fetchCalls).toBe(0);
  });

  it('never reuses an authenticated response across user A and user B', async () => {
    const jwt = await createJwtFixture();
    const tokenA = await jwt.signToken({ subject: TEST_USER_ID });
    const tokenB = await jwt.signToken({ subject: TEST_USER_B_ID });
    const fetchFunction = toFetchFunction((request) => {
      if (new URL(request.url).pathname.endsWith('/.well-known/jwks.json')) {
        return jsonOriginResponse(jwt.jwks);
      }

      const actor = request.headers.get('authorization') === `Bearer ${tokenA}`
        ? 'user-a'
        : 'user-b';
      return jsonOriginResponse({
        results: [
          {
            address: `${actor} address`,
            lat: 41.0082,
            lng: 28.9784,
            name: actor,
            placeId: actor,
          },
        ],
      });
    });
    const requestBody = { action: 'search', query: 'Istanbul' };
    const responseA = await handleWorkerRequest(
      createJsonRequest('/v1/maps-geocoding', requestBody, { token: tokenA }),
      createTestEnv(),
      createDependencies(fetchFunction),
    );
    const responseB = await handleWorkerRequest(
      createJsonRequest('/v1/maps-geocoding', requestBody, { token: tokenB }),
      createTestEnv(),
      createDependencies(fetchFunction),
    );

    await expect(responseA.json()).resolves.toMatchObject({
      results: [{ name: 'user-a', placeId: 'user-a' }],
    });
    await expect(responseB.json()).resolves.toMatchObject({
      results: [{ name: 'user-b', placeId: 'user-b' }],
    });
    expect(responseA.headers.get('cache-control')).toContain('no-store');
    expect(responseB.headers.get('cache-control')).toContain('no-store');
  });

  it('fails closed when the rate limiter denies or throws', async () => {
    const jwt = await createJwtFixture();
    const token = await jwt.signToken();

    for (const limiter of [
      createRateLimitStub({ success: false }),
      createRateLimitStub({ error: new Error('binding unavailable') }),
    ]) {
      let originCalled = false;
      const fetchFunction = toFetchFunction((request) => {
        if (new URL(request.url).pathname.endsWith('/.well-known/jwks.json')) {
          return jsonOriginResponse(jwt.jwks);
        }

        originCalled = true;
        return jsonOriginResponse();
      });
      const response = await handleWorkerRequest(
        createJsonRequest('/v1/maps-geocoding', { action: 'search', query: 'Istanbul' }, { token }),
        createTestEnv({ API_RATE_LIMITER: limiter }),
        createDependencies(fetchFunction),
      );

      expect([429, 503]).toContain(response.status);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(originCalled).toBe(false);

      if (response.status === 429) {
        expect(response.headers.get('retry-after')).toBe('60');
      }
    }
  });

  it('signs the exact origin method, canonical path, nonce, timestamp, and raw body hash', async () => {
    const jwt = await createJwtFixture();
    const token = await jwt.signToken();
    let capturedOriginRequest: Request | undefined;
    const fetchFunction = toFetchFunction(async (request) => {
      if (new URL(request.url).pathname.endsWith('/.well-known/jwks.json')) {
        return jsonOriginResponse(jwt.jwks);
      }

      capturedOriginRequest = request;
      return jsonOriginResponse({
        result: {
          isPointOfInterest: false,
          lat: 41.0082,
          lng: 28.9784,
        },
      });
    });
    const requestBody = { action: 'reverse', latitude: 41.0082, longitude: 28.9784 };
    const response = await handleWorkerRequest(
      createJsonRequest('/v1/maps-geocoding', requestBody, { token }),
      createTestEnv({
        IP_HASH_PEPPER: TEST_IP_PEPPER,
        ORIGIN_HMAC_SECRET: TEST_HMAC_SECRET,
      }),
      createDependencies(fetchFunction),
    );

    expect(response.status).toBe(200);
    expect(capturedOriginRequest).toBeDefined();
    const originRequest = capturedOriginRequest;

    if (!originRequest) {
      throw new Error('Origin request was not captured.');
    }

    expect(originRequest.url).toBe(`${TEST_SUPABASE_ORIGIN}/functions/v1/maps-geocoding`);
    const bodyText = await originRequest.text();
    const timestamp = originRequest.headers.get('x-sorita-edge-timestamp');
    const nonce = originRequest.headers.get('x-sorita-edge-nonce');
    const bodyHash = originRequest.headers.get('x-sorita-edge-body-sha256');
    const signatureHeader = originRequest.headers.get('x-sorita-edge-signature');
    expect(timestamp).toBe(String(TEST_NOW_MS));
    expect(nonce).toBe(TEST_REQUEST_ID);
    expect(bodyHash).toBe(await sha256Hex(bodyText));
    expect(signatureHeader).toMatch(/^v1=[A-Za-z0-9_-]+$/);

    if (!timestamp || !nonce || !bodyHash || !signatureHeader) {
      throw new Error('Origin signature headers are incomplete.');
    }

    const message = [
      timestamp,
      nonce,
      'POST',
      '/functions/v1/maps-geocoding',
      bodyHash,
    ].join('\n');
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(TEST_HMAC_SECRET),
      { hash: 'SHA-256', name: 'HMAC' },
      false,
      ['verify'],
    );
    const verified = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(signatureHeader.slice(3)),
      new TextEncoder().encode(message),
    );
    expect(verified).toBe(true);
  });
});

describe('bounded JWKS cache', () => {
  beforeEach(() => {
    securityTestInternals.clearJwksCache();
  });

  it('serves fresh keys from cache and refreshes immediately on a kid miss', async () => {
    const initial = await createJwtFixture({ kid: 'initial-key' });
    const rotated = await createJwtFixture({ kid: 'rotated-key' });
    const initialToken = await initial.signToken();
    const rotatedToken = await rotated.signToken();
    let fetchCalls = 0;
    const fetchFunction = toFetchFunction(() => {
      fetchCalls += 1;
      return jsonOriginResponse(fetchCalls === 1 ? initial.jwks : rotated.jwks);
    });
    const baseParams = {
      audience: 'authenticated',
      fetchFunction,
      nowMs: TEST_NOW_MS,
      supabaseOrigin: TEST_SUPABASE_ORIGIN,
      timeoutMs: 1_000,
    };

    await expect(verifySupabaseJwt({ ...baseParams, token: initialToken })).resolves.toEqual({
      userId: TEST_USER_ID,
    });
    await expect(verifySupabaseJwt({ ...baseParams, token: initialToken })).resolves.toEqual({
      userId: TEST_USER_ID,
    });
    expect(fetchCalls).toBe(1);

    await expect(verifySupabaseJwt({ ...baseParams, token: rotatedToken })).resolves.toEqual({
      userId: TEST_USER_ID,
    });
    expect(fetchCalls).toBe(2);
  });

  it('uses matching stale keys only during the bounded grace period and still validates claims', async () => {
    const fixture = await createJwtFixture();
    const nowSeconds = Math.floor(TEST_NOW_MS / 1_000);
    const token = await fixture.signToken({ expiresAtSeconds: nowSeconds + 3_600 });
    const wrongAudienceToken = await fixture.signToken({
      audience: 'wrong-audience',
      expiresAtSeconds: nowSeconds + 3_600,
    });
    let unavailable = false;
    let fetchCalls = 0;
    const fetchFunction = toFetchFunction(() => {
      fetchCalls += 1;

      if (unavailable) {
        throw new Error('temporary JWKS outage');
      }

      return jsonOriginResponse(fixture.jwks);
    });
    const baseParams = {
      audience: 'authenticated',
      fetchFunction,
      supabaseOrigin: TEST_SUPABASE_ORIGIN,
      timeoutMs: 1_000,
    };

    await verifySupabaseJwt({ ...baseParams, nowMs: TEST_NOW_MS, token });
    unavailable = true;
    const staleNow = TEST_NOW_MS + securityTestInternals.JWKS_FRESH_TTL_MS + 1;
    await expect(verifySupabaseJwt({ ...baseParams, nowMs: staleNow, token })).resolves.toEqual({
      userId: TEST_USER_ID,
    });
    await expect(
      verifySupabaseJwt({ ...baseParams, nowMs: staleNow, token: wrongAudienceToken }),
    ).rejects.toBeInstanceOf(InvalidJwtError);

    const expiredStaleNow =
      TEST_NOW_MS +
      securityTestInternals.JWKS_FRESH_TTL_MS +
      securityTestInternals.JWKS_STALE_GRACE_MS +
      1;
    await expect(
      verifySupabaseJwt({ ...baseParams, nowMs: expiredStaleNow, token }),
    ).rejects.toBeInstanceOf(JwtVerifierUnavailableError);
    expect(fetchCalls).toBe(4);
  });

  it('does not use stale keys for an unknown kid when refresh fails', async () => {
    const cached = await createJwtFixture({ kid: 'cached-key' });
    const unknown = await createJwtFixture({ kid: 'unknown-key' });
    const cachedToken = await cached.signToken();
    const unknownToken = await unknown.signToken();
    let fetchCalls = 0;
    const fetchFunction = toFetchFunction(() => {
      fetchCalls += 1;

      if (fetchCalls > 1) {
        throw new Error('JWKS unavailable during rotation');
      }

      return jsonOriginResponse(cached.jwks);
    });
    const baseParams = {
      audience: 'authenticated',
      fetchFunction,
      nowMs: TEST_NOW_MS,
      supabaseOrigin: TEST_SUPABASE_ORIGIN,
      timeoutMs: 1_000,
    };

    await verifySupabaseJwt({ ...baseParams, token: cachedToken });
    await expect(
      verifySupabaseJwt({ ...baseParams, token: unknownToken }),
    ).rejects.toBeInstanceOf(JwtVerifierUnavailableError);
    await expect(
      verifySupabaseJwt({ ...baseParams, token: unknownToken }),
    ).rejects.toBeInstanceOf(JwtVerifierUnavailableError);
    expect(fetchCalls).toBe(2);
  });

  it('keeps concurrent random-kid refreshes request-owned and bounds the negative cache', async () => {
    const fixture = await createJwtFixture({ kid: 'trusted-key' });
    const trustedToken = await fixture.signToken();
    let fetchCalls = 0;
    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const fetchFunction = toFetchFunction(async () => {
      fetchCalls += 1;

      if (fetchCalls === 1) {
        return jsonOriginResponse(fixture.jwks);
      }

      await refreshGate;
      return jsonOriginResponse(fixture.jwks);
    });
    const baseParams = {
      audience: 'authenticated',
      fetchFunction,
      nowMs: TEST_NOW_MS,
      supabaseOrigin: TEST_SUPABASE_ORIGIN,
      timeoutMs: 1_000,
    };
    await verifySupabaseJwt({ ...baseParams, token: trustedToken });
    const randomKidTokens = Array.from(
      { length: securityTestInternals.MAX_NEGATIVE_KIDS_PER_ISSUER + 8 },
      (_, index) => replaceTokenKid(trustedToken, `random-key-${index}`),
    );
    const attempts = randomKidTokens.map((token) =>
      verifySupabaseJwt({ ...baseParams, token }),
    );
    const expectedFetchCalls = randomKidTokens.length + 1;
    let allRefreshesStarted = false;

    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (fetchCalls === expectedFetchCalls) {
        allRefreshesStarted = true;
        break;
      }

      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }

    releaseRefresh();
    const settled = await Promise.allSettled(attempts);

    expect(allRefreshesStarted).toBe(true);
    expect(settled).toHaveLength(randomKidTokens.length);
    expect(
      settled.every(
        (result) => result.status === 'rejected' && result.reason instanceof InvalidJwtError,
      ),
    ).toBe(true);
    expect(fetchCalls).toBe(expectedFetchCalls);
    expect(securityTestInternals.getNegativeKidCount()).toBeLessThanOrEqual(
      securityTestInternals.MAX_NEGATIVE_KIDS_PER_ISSUER,
    );

    await expect(
      verifySupabaseJwt({
        ...baseParams,
        token: replaceTokenKid(trustedToken, 'another-random-key'),
      }),
    ).rejects.toBeInstanceOf(InvalidJwtError);
    expect(fetchCalls).toBe(expectedFetchCalls);
  });

  it('bounds the issuer cache with LRU eviction', async () => {
    const fixture = await createJwtFixture();

    for (let index = 0; index < securityTestInternals.MAX_JWKS_CACHE_ENTRIES + 2; index += 1) {
      const supabaseOrigin = `https://project-${index}.supabase.test`;
      const token = await fixture.signToken({ issuer: `${supabaseOrigin}/auth/v1` });
      await verifySupabaseJwt({
        audience: 'authenticated',
        fetchFunction: toFetchFunction(() => jsonOriginResponse(fixture.jwks)),
        nowMs: TEST_NOW_MS,
        supabaseOrigin,
        timeoutMs: 1_000,
        token,
      });
    }

    expect(securityTestInternals.getJwksCacheSize()).toBe(
      securityTestInternals.MAX_JWKS_CACHE_ENTRIES,
    );
  });
});

describe('Worker module JWKS isolation', () => {
  beforeEach(() => {
    securityTestInternals.clearJwksCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the hardened JWKS verifier through the real default fetch export', async () => {
    const supabaseOrigin = 'https://replace-local-project-ref.supabase.co';
    const fixture = await createJwtFixture({ kid: 'integration-key' });
    const token = await fixture.signToken({
      expiresAtSeconds: Math.floor(Date.now() / 1_000) + 300,
      issuer: `${supabaseOrigin}/auth/v1`,
    });
    let jwksCalls = 0;
    let originCalls = 0;
    const fetchFunction = toFetchFunction((request) => {
      if (new URL(request.url).pathname.endsWith('/.well-known/jwks.json')) {
        jwksCalls += 1;
        return jsonOriginResponse(fixture.jwks);
      }

      originCalls += 1;
      return jsonOriginResponse({ results: [] });
    });
    vi.stubGlobal('fetch', fetchFunction);

    const response = await exports.default.fetch(
      createJsonRequest(
        '/v1/maps-geocoding',
        { action: 'search', query: 'Istanbul' },
        { origin: null, token },
      ),
    );

    expect(jwksCalls).toBe(1);
    expect(originCalls).toBe(1);
    expect(response.status).toBe(200);
  });
});
