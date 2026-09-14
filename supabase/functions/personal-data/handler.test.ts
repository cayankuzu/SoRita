import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTrustedEdgeOriginSignature } from '../_shared/originSecurity';
import { createRequestSignature, sha256Hex } from '../_shared/requestSecurity';
import {
  createPersonalDataHandler,
  PERSONAL_DATA_EXPORT_RESPONSE_MAX_BYTES,
} from './handler';

const endpoint = 'https://example.supabase.co/functions/v1/personal-data';
const allowedOrigin = 'https://app.sorita.example';
const token = 'token-1';
const originSecret = 'origin-secret-that-is-at-least-32-characters-long';

type ErrorResult = { code?: string; message: string };
type ClaimsResult = {
  data?: { claims?: { sub?: string } | null } | null;
  error?: ErrorResult | null;
};
type UserResult = {
  data?: { user?: { id?: string } | null } | null;
  error?: ErrorResult | null;
};

type DepsOptions = {
  claimsResult?: ClaimsResult;
  claimsThrows?: Error;
  configOverrides?: Partial<{
    allowedOrigins: string[];
    supabasePublishableKey: string;
    supabaseServiceRoleKey: string;
    supabaseUrl: string;
  }>;
  exportData?: unknown;
  exportError?: ErrorResult | null;
  exportThrows?: Error;
  nonceInsertError?: ErrorResult | null;
  originClaimData?: unknown;
  originClaimError?: ErrorResult | null;
  rateLimitError?: ErrorResult | null;
  rateLimitResult?: {
    allowed: boolean;
    remaining: number;
    retry_after_seconds: number;
  };
  userResult?: UserResult;
  userThrows?: Error;
};

function createDeps(options: DepsOptions = {}) {
  const seenNonces = new Set<string>();
  const nonceInsertMock = vi.fn(async (payload: Record<string, unknown>) => {
    if (options.nonceInsertError) {
      return { error: options.nonceInsertError };
    }

    const nonce = typeof payload.nonce === 'string' ? payload.nonce : '';
    if (seenNonces.has(nonce)) {
      return { error: { code: '23505', message: 'duplicate request nonce' } };
    }

    seenNonces.add(nonce);
    return { error: null };
  });

  const hasExportData = Object.prototype.hasOwnProperty.call(options, 'exportData');
  const rpcMock = vi.fn(async (name: string) => {
    if (name === 'claim_cloudflare_origin_nonce') {
      return {
        data: options.originClaimData ?? true,
        error: options.originClaimError ?? null,
      };
    }

    if (name === 'enforce_edge_rate_limit') {
      return {
        data: options.rateLimitResult ?? {
          allowed: true,
          remaining: 1,
          retry_after_seconds: 0,
        },
        error: options.rateLimitError ?? null,
      };
    }

    if (name === 'build_personal_data_export') {
      if (options.exportThrows) {
        throw options.exportThrows;
      }

      return {
        data: hasExportData
          ? options.exportData
          : {
              format_version: 1,
              profile: { username: 'owner' },
            },
        error: options.exportError ?? null,
      };
    }

    return { data: null, error: { message: `Unexpected RPC: ${name}` } };
  });

  const getClaimsMock = options.claimsThrows
    ? vi.fn().mockRejectedValue(options.claimsThrows)
    : vi.fn().mockResolvedValue(options.claimsResult ?? {
        data: { claims: { sub: 'user-1' } },
        error: null,
      });
  const getUserMock = options.userThrows
    ? vi.fn().mockRejectedValue(options.userThrows)
    : vi.fn().mockResolvedValue(options.userResult ?? {
        data: { user: { id: 'user-1' } },
        error: null,
      });
  const createAdminClientMock = vi.fn(() => ({
    from: (table: string) => {
      if (table !== 'request_nonces') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return { insert: nonceInsertMock };
    },
    rpc: rpcMock,
  }));
  const createAuthClientMock = vi.fn(() => ({
    auth: {
      getClaims: getClaimsMock,
      getUser: getUserMock,
    },
  }));
  const handler = createPersonalDataHandler({
    config: {
      allowedOrigins: [allowedOrigin],
      supabasePublishableKey: 'publishable-key',
      supabaseServiceRoleKey: 'service-role-key',
      supabaseUrl: 'https://example.supabase.co',
      ...options.configOverrides,
    },
    createAdminClient: createAdminClientMock,
    createAuthClient: createAuthClientMock,
  });

  return {
    createAdminClientMock,
    createAuthClientMock,
    getClaimsMock,
    getUserMock,
    handler,
    nonceInsertMock,
    rpcMock,
  };
}

let signedRequestCounter = 0;

beforeEach(() => {
  signedRequestCounter = 0;
});

async function createSignedHeaders(bodyText: string) {
  signedRequestCounter += 1;
  const timestamp = Date.now().toString();
  const deviceId = `personal-device-${signedRequestCounter}`;
  const nonce = `personal-data-nonce-${signedRequestCounter}`;
  const payloadHash = await sha256Hex(bodyText);
  const signature = await createRequestSignature(token, {
    deviceId,
    functionName: 'personal-data',
    method: 'POST',
    nonce,
    payloadHash,
    timestamp,
  });

  return new Headers({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-device-id': deviceId,
    'x-nonce': nonce,
    'x-signature': signature,
    'x-timestamp': timestamp,
  });
}

async function createSignedRequest(
  payload: unknown,
  options: { headers?: HeadersInit; origin?: string; requestId?: string } = {},
) {
  const bodyText = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const headers = await createSignedHeaders(bodyText);

  new Headers(options.headers).forEach((value, name) => {
    headers.set(name, value);
  });
  if (options.origin) headers.set('Origin', options.origin);
  if (options.requestId) headers.set('x-request-id', options.requestId);

  return new Request(endpoint, { body: bodyText, headers, method: 'POST' });
}

function requireTrustedOriginSignatures() {
  vi.stubGlobal('Deno', {
    env: {
      get: (name: string) => {
        if (name === 'CLOUDFLARE_ORIGIN_SIGNATURE_REQUIRED') return 'true';
        if (name === 'CLOUDFLARE_ORIGIN_HMAC_SECRET') return originSecret;
        return undefined;
      },
    },
  });
}

async function createTrustedOriginRequest(payload: unknown) {
  const bodyText = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const headers = await createSignedHeaders(bodyText);
  signedRequestCounter += 1;
  const timestamp = Date.now().toString();
  const nonceSuffix = signedRequestCounter.toString(16).padStart(12, '0');
  const nonce = `00000000-0000-4000-8000-${nonceSuffix}`;
  const originSignature = await createTrustedEdgeOriginSignature({
    bodyText,
    functionName: 'personal-data',
    nonce,
    secret: originSecret,
    timestamp,
  });

  headers.set('x-sorita-edge-body-sha256', originSignature.bodyHash);
  headers.set('x-sorita-edge-nonce', nonce);
  headers.set('x-sorita-edge-signature', originSignature.signature);
  headers.set('x-sorita-edge-timestamp', timestamp);

  return new Request(endpoint, { body: bodyText, headers, method: 'POST' });
}

function expectPrivateNoStore(response: Response) {
  expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
  expect(response.headers.get('expires')).toBe('0');
  expect(response.headers.get('pragma')).toBe('no-cache');
}

describe('personal-data handler', () => {
  it('handles exact CORS, preflight, method rejection, and security headers without invoking dependencies', async () => {
    const { createAdminClientMock, handler } = createDeps();
    const preflight = await handler(new Request(endpoint, {
      headers: { Origin: allowedOrigin, 'x-request-id': 'request-1234' },
      method: 'OPTIONS',
    }));

    expect(preflight.status).toBe(200);
    expect(preflight.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
    expect(preflight.headers.get('vary')).toBe('Origin');
    expect(preflight.headers.get('x-content-type-options')).toBe('nosniff');
    expect(preflight.headers.get('x-request-id')).toBe('request-1234');
    expectPrivateNoStore(preflight);

    const deniedOrigin = await handler(new Request(endpoint, {
      headers: { Origin: 'https://evil.example' },
      method: 'OPTIONS',
    }));
    expect(deniedOrigin.headers.get('access-control-allow-origin')).not.toBe('https://evil.example');
    expect(deniedOrigin.headers.get('access-control-allow-origin')).not.toBe('*');

    const unsupported = await handler(new Request(endpoint, { method: 'GET' }));
    expect(unsupported.status).toBe(405);
    expect(unsupported.headers.get('allow')).toBe('POST, OPTIONS');
    await expect(unsupported.json()).resolves.toMatchObject({ code: 'method_not_allowed' });
    expectPrivateNoStore(unsupported);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it('fails closed for missing or whitespace-only server configuration', async () => {
    for (const configOverrides of [
      { supabaseUrl: '' },
      { supabasePublishableKey: ' ' },
      { supabaseServiceRoleKey: '\t' },
    ]) {
      const { createAdminClientMock, handler } = createDeps({ configOverrides });
      const response = await handler(new Request(endpoint, { body: '{}', method: 'POST' }));

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toMatchObject({ code: 'misconfigured' });
      expectPrivateNoStore(response);
      expect(createAdminClientMock).not.toHaveBeenCalled();
    }
  });

  it('rejects missing authorization, claim errors, and missing claim subjects', async () => {
    const missing = createDeps();
    const missingResponse = await missing.handler(
      new Request(endpoint, { body: '{}', method: 'POST' }),
    );
    expect(missingResponse.status).toBe(401);
    await expect(missingResponse.json()).resolves.toMatchObject({ code: 'missing_authorization' });
    expect(missing.createAdminClientMock).not.toHaveBeenCalled();

    for (const claimsResult of [
      {
        data: { claims: { sub: 'user-1' } },
        error: { message: 'expired despite stale claims' },
      },
      { data: { claims: {} }, error: null },
      { data: { claims: { sub: ' ' } }, error: null },
      { data: null, error: null },
    ]) {
      const deps = createDeps({ claimsResult });
      const response = await deps.handler(await createSignedRequest({ action: 'export' }));

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({ code: 'invalid_jwt' });
      expect(deps.getUserMock).not.toHaveBeenCalled();
      expect(deps.nonceInsertMock).not.toHaveBeenCalled();
      expectPrivateNoStore(response);
    }
  });

  it('requires a live matching user after claim and request-signature verification', async () => {
    for (const userResult of [
      {
        data: { user: { id: 'user-1' } },
        error: { message: 'session revoked' },
      },
      { data: { user: null }, error: null },
      { data: { user: { id: ' ' } }, error: null },
      { data: { user: { id: 'another-user' } }, error: null },
    ]) {
      const deps = createDeps({ userResult });
      const response = await deps.handler(await createSignedRequest({ action: 'export' }));

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({ code: 'invalid_jwt' });
      expect(deps.nonceInsertMock).toHaveBeenCalledTimes(1);
      expect(deps.rpcMock).not.toHaveBeenCalledWith(
        'build_personal_data_export',
        expect.anything(),
      );
    }
  });

  it('rejects missing, tampered, replayed, and unavailable client signatures with safe errors', async () => {
    const unsigned = createDeps();
    const unsignedResponse = await unsigned.handler(new Request(endpoint, {
      body: JSON.stringify({ action: 'export' }),
      headers: { Authorization: `Bearer ${token}` },
      method: 'POST',
    }));
    expect(unsignedResponse.status).toBe(401);
    await expect(unsignedResponse.json()).resolves.toMatchObject({ code: 'invalid_signature' });
    expect(unsigned.getClaimsMock).not.toHaveBeenCalled();

    const signedBody = JSON.stringify({ action: 'export' });
    const tamperedHeaders = await createSignedHeaders(signedBody);
    const tampered = createDeps();
    const tamperedResponse = await tampered.handler(new Request(endpoint, {
      body: JSON.stringify({ action: 'other' }),
      headers: tamperedHeaders,
      method: 'POST',
    }));
    expect(tamperedResponse.status).toBe(401);
    await expect(tamperedResponse.json()).resolves.toMatchObject({ code: 'invalid_signature' });
    expect(tampered.nonceInsertMock).not.toHaveBeenCalled();

    const replayed = createDeps({
      nonceInsertError: { code: '23505', message: 'private duplicate detail' },
    });
    const replayResponse = await replayed.handler(
      await createSignedRequest({ action: 'export' }),
    );
    expect(replayResponse.status).toBe(409);
    const replayPayload = await replayResponse.json();
    expect(replayPayload).toMatchObject({ code: 'invalid_signature' });
    expect(JSON.stringify(replayPayload)).not.toContain('private duplicate detail');

    const unavailable = createDeps({
      nonceInsertError: { message: 'private nonce storage detail' },
    });
    const unavailableResponse = await unavailable.handler(
      await createSignedRequest({ action: 'export' }),
    );
    expect(unavailableResponse.status).toBe(500);
    const unavailablePayload = await unavailableResponse.json();
    expect(unavailablePayload).toMatchObject({ code: 'security_unavailable' });
    expect(JSON.stringify(unavailablePayload)).not.toContain('private nonce storage detail');
    expectPrivateNoStore(unavailableResponse);
  });

  it('accepts the trusted origin envelope and rejects origin replay before auth', async () => {
    requireTrustedOriginSignatures();

    const accepted = createDeps();
    const acceptedResponse = await accepted.handler(
      await createTrustedOriginRequest({ action: 'export' }),
    );
    expect(acceptedResponse.status).toBe(200);
    expect(accepted.rpcMock).toHaveBeenCalledWith('claim_cloudflare_origin_nonce', {
      input_function_name: 'personal-data',
      input_nonce: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });

    const replayed = createDeps({ originClaimData: false });
    const replayedResponse = await replayed.handler(
      await createTrustedOriginRequest({ action: 'export' }),
    );
    expect(replayedResponse.status).toBe(409);
    await expect(replayedResponse.json()).resolves.toMatchObject({ code: 'invalid_signature' });
    expect(replayed.getClaimsMock).not.toHaveBeenCalled();
    expectPrivateNoStore(replayedResponse);
  });

  it('maps malformed JSON separately from strict payload validation failures', async () => {
    const deps = createDeps();
    const malformedResponse = await deps.handler(await createSignedRequest('{invalid'));

    expect(malformedResponse.status).toBe(400);
    await expect(malformedResponse.json()).resolves.toMatchObject({ code: 'invalid_json' });
    expect(deps.rpcMock).not.toHaveBeenCalledWith(
      'enforce_edge_rate_limit',
      expect.anything(),
    );

    for (const payload of [
      null,
      {},
      { action: 'delete' },
      { action: 'export', unexpected: true },
    ]) {
      const response = await deps.handler(await createSignedRequest(payload));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ code: 'invalid_input' });
    }
  });

  it('enforces the one-kibibyte request limit by UTF-8 byte length before auth', async () => {
    const deps = createDeps();
    const oversizedBody = JSON.stringify({
      action: 'export',
      padding: '\u00e9'.repeat(600),
    });
    expect(new TextEncoder().encode(oversizedBody).byteLength).toBeGreaterThan(1024);

    const response = await deps.handler(await createSignedRequest(oversizedBody));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: 'request_too_large' });
    expect(deps.getClaimsMock).not.toHaveBeenCalled();
    expect(deps.nonceInsertMock).not.toHaveBeenCalled();
    expectPrivateNoStore(response);
  });

  it('applies the persistent two-per-day rate limit and fails closed when it is unavailable', async () => {
    const limited = createDeps({
      rateLimitResult: { allowed: false, remaining: 0, retry_after_seconds: 1800 },
    });
    const limitedResponse = await limited.handler(
      await createSignedRequest({ action: 'export' }),
    );

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.headers.get('x-ratelimit-limit')).toBe('2');
    expect(limitedResponse.headers.get('x-ratelimit-remaining')).toBe('0');
    expect(limitedResponse.headers.get('retry-after')).toBe('1800');
    expectPrivateNoStore(limitedResponse);
    expect(limited.rpcMock).toHaveBeenCalledWith('enforce_edge_rate_limit', {
      input_identifier: 'user-1',
      input_max_requests: 2,
      input_scope: 'personal-data:export',
      input_window_seconds: 86_400,
    });
    expect(limited.rpcMock).not.toHaveBeenCalledWith(
      'build_personal_data_export',
      expect.anything(),
    );

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const unavailable = createDeps({
      rateLimitError: { message: 'private limiter storage detail' },
    });
    const unavailableResponse = await unavailable.handler(
      await createSignedRequest({ action: 'export' }),
    );
    expect(unavailableResponse.status).toBe(500);
    const unavailablePayload = await unavailableResponse.json();
    expect(unavailablePayload).toMatchObject({ code: 'export_unavailable' });
    expect(JSON.stringify(unavailablePayload)).not.toContain('private limiter storage detail');
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('private limiter storage detail');
    expect(unavailable.rpcMock).not.toHaveBeenCalledWith(
      'build_personal_data_export',
      expect.anything(),
    );
  });

  it('returns the authenticated user export with the RPC and privacy contract', async () => {
    const exportData = {
      format_version: 1,
      profile: { email: 'owner@example.com', username: 'owner' },
    };
    const deps = createDeps({ exportData });
    const response = await deps.handler(await createSignedRequest(
      { action: 'export' },
      { origin: allowedOrigin, requestId: 'request-5678' },
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: exportData });
    expect(response.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
    expect(response.headers.get('x-request-id')).toBe('request-5678');
    expect(response.headers.get('x-ratelimit-limit')).toBe('2');
    expect(response.headers.get('x-ratelimit-remaining')).toBe('1');
    expectPrivateNoStore(response);
    expect(deps.createAuthClientMock).toHaveBeenCalledWith(token);
    expect(deps.getClaimsMock).toHaveBeenCalledWith(token);
    expect(deps.getUserMock).toHaveBeenCalledWith(token);
    expect(deps.rpcMock).toHaveBeenCalledWith('build_personal_data_export', {
      p_user_id: 'user-1',
    });
    expect(deps.nonceInsertMock).toHaveBeenCalledWith(expect.objectContaining({
      function_name: 'personal-data',
      user_id: 'user-1',
    }));
  });

  it('keeps RPC and auth failures client-safe and rejects invalid export shapes', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    for (const options of [
      { exportError: { message: 'private database export detail' } },
      { exportData: null },
      { exportData: [] },
      { exportThrows: new Error('private thrown export detail') },
      { claimsThrows: new Error('private claims transport detail') },
      { userThrows: new Error('private user transport detail') },
    ]) {
      const deps = createDeps(options);
      const response = await deps.handler(await createSignedRequest({ action: 'export' }));

      expect(response.status).toBe(500);
      const responseText = await response.text();
      expect(JSON.parse(responseText)).toMatchObject({ code: 'export_unavailable' });
      expect(responseText).not.toContain('private');
      expectPrivateNoStore(response);
    }

    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('private');
  });

  it('allows exactly five MiB of serialized JSON and blocks the next UTF-8 byte', async () => {
    const emptyPayloadBytes = new TextEncoder().encode(JSON.stringify({
      data: { content: '' },
    })).byteLength;
    const atLimitData = {
      content: 'x'.repeat(PERSONAL_DATA_EXPORT_RESPONSE_MAX_BYTES - emptyPayloadBytes),
    };
    const atLimit = createDeps({ exportData: atLimitData });
    const atLimitResponse = await atLimit.handler(
      await createSignedRequest({ action: 'export' }),
    );

    expect(atLimitResponse.status).toBe(200);
    const atLimitBody = await atLimitResponse.text();
    expect(new TextEncoder().encode(atLimitBody).byteLength).toBe(
      PERSONAL_DATA_EXPORT_RESPONSE_MAX_BYTES,
    );
    expectPrivateNoStore(atLimitResponse);

    const aboveLimit = createDeps({
      exportData: {
        content: 'x'.repeat(
          PERSONAL_DATA_EXPORT_RESPONSE_MAX_BYTES - emptyPayloadBytes + 1,
        ),
      },
    });
    const aboveLimitResponse = await aboveLimit.handler(
      await createSignedRequest({ action: 'export' }),
    );

    expect(aboveLimitResponse.status).toBe(413);
    const aboveLimitBody = await aboveLimitResponse.text();
    expect(JSON.parse(aboveLimitBody)).toMatchObject({ code: 'export_too_large' });
    expect(aboveLimitBody).not.toContain('"content"');
    expect(aboveLimitResponse.headers.get('x-ratelimit-limit')).toBe('2');
    expectPrivateNoStore(aboveLimitResponse);
  });
});
