import { exportJWK, generateKeyPair, SignJWT } from 'jose';

import type { WorkerDependencies } from '../src/index';
import type { FetchFunction } from '../src/security';

export const TEST_NOW_MS = Date.parse('2026-08-30T12:00:00.000Z');
export const TEST_REQUEST_ID = '0198f301-9c00-7000-8000-000000000001';
export const TEST_USER_ID = '10000000-0000-4000-8000-000000000001';
export const TEST_USER_B_ID = '20000000-0000-4000-8000-000000000002';
export const TEST_ORIGIN = 'https://app.example';
export const TEST_SUPABASE_ORIGIN = 'https://project.supabase.test';
export const TEST_HMAC_SECRET = 'test-origin-hmac-secret-that-is-long-enough';
export const TEST_IP_PEPPER = 'test-ip-hash-pepper-that-is-also-long-enough';
export const TEST_BUILD_SHA = '0000000000000000000000000000000000000000';

export type RateLimitStub = RateLimit & {
  keys: string[];
};

export function createRateLimitStub(options: { error?: Error; success?: boolean } = {}): RateLimitStub {
  const keys: string[] = [];

  return {
    keys,
    async limit({ key }) {
      keys.push(key);

      if (options.error) {
        throw options.error;
      }

      return { success: options.success ?? true };
    },
  };
}

export function createTestEnv(overrides: Partial<Env> = {}): Env {
  const baseEnv = {
    API_RATE_LIMITER: createRateLimitStub(),
    AUTH_RATE_LIMITER: createRateLimitStub(),
    BUILD_SHA: TEST_BUILD_SHA,
    CORS_ALLOWLIST: TEST_ORIGIN,
    ENVIRONMENT: 'development',
    IP_HASH_PEPPER: TEST_IP_PEPPER,
    JWKS_TIMEOUT_MS: '1000',
    LOG_SAMPLE_RATE: '1',
    ORIGIN_HMAC_SECRET: TEST_HMAC_SECRET,
    ORIGIN_TIMEOUT_MS: '1000',
    SUPABASE_JWT_AUDIENCE: 'authenticated',
    SUPABASE_PUBLISHABLE_KEY: 'test-anon-publishable-key-with-safe-placeholder',
    SUPABASE_URL: TEST_SUPABASE_ORIGIN,
  } satisfies Env;

  return { ...baseEnv, ...overrides };
}

export function createDependencies(
  fetchFunction: FetchFunction,
  overrides: Partial<Pick<WorkerDependencies, 'log' | 'now' | 'randomUuid'>> = {},
): WorkerDependencies {
  return {
    fetchFunction,
    log: () => undefined,
    now: () => TEST_NOW_MS,
    randomUuid: () => TEST_REQUEST_ID,
    ...overrides,
  };
}

export function toFetchFunction(
  handler: (request: Request) => Promise<Response> | Response,
): FetchFunction {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request && !init ? input : new Request(input, init);
    return handler(request);
  };
}

export function createJsonRequest(
  path: string,
  body: unknown,
  options: {
    headers?: HeadersInit;
    ipAddress?: string | null;
    method?: string;
    origin?: string | null;
    token?: string;
  } = {},
): Request {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (options.ipAddress !== null) {
    headers.set('Cf-Connecting-Ip', options.ipAddress ?? '203.0.113.9');
  }

  if (options.origin !== null) {
    headers.set('Origin', options.origin ?? TEST_ORIGIN);
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  return new Request(`https://edge.example${path}`, {
    body: options.method === 'GET' || options.method === 'HEAD' ? undefined : JSON.stringify(body),
    headers,
    method: options.method ?? 'POST',
  });
}

export async function createJwtFixture(options: { kid?: string } = {}) {
  const kid = options.kid ?? `test-key-${crypto.randomUUID()}`;
  const keyPair = await generateKeyPair('ES256', { extractable: true });
  const publicJwk = await exportJWK(keyPair.publicKey);
  const jwks = {
    keys: [
      {
        ...publicJwk,
        alg: 'ES256',
        kid,
        use: 'sig',
      },
    ],
  };

  async function signToken(options: {
    audience?: string;
    expiresAtSeconds?: number;
    issuer?: string;
    notBeforeSeconds?: number;
    subject?: string;
  } = {}): Promise<string> {
    const nowSeconds = Math.floor(TEST_NOW_MS / 1000);
    let token = new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid, typ: 'JWT' })
      .setIssuer(options.issuer ?? `${TEST_SUPABASE_ORIGIN}/auth/v1`)
      .setAudience(options.audience ?? 'authenticated')
      .setSubject(options.subject ?? TEST_USER_ID)
      .setIssuedAt(nowSeconds)
      .setExpirationTime(options.expiresAtSeconds ?? nowSeconds + 300);

    if (options.notBeforeSeconds !== undefined) {
      token = token.setNotBefore(options.notBeforeSeconds);
    }

    return token.sign(keyPair.privateKey);
  }

  return { jwks, signToken };
}

export function jsonOriginResponse(
  payload: unknown = { success: true },
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  return Response.json(payload, { ...init, headers });
}
