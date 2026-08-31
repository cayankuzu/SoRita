import { describe, expect, it } from 'vitest';

import { ROUTE_DEFINITIONS, validatePayload } from '../src/contracts';
import { handleWorkerRequest } from '../src/index';
import {
  createDependencies,
  createJsonRequest,
  createJwtFixture,
  createTestEnv,
  jsonOriginResponse,
  TEST_ORIGIN,
  TEST_BUILD_SHA,
  TEST_REQUEST_ID,
  TEST_USER_B_ID,
  TEST_USER_ID,
  toFetchFunction,
} from './helpers';

const noOriginFetch = toFetchFunction(() => {
  throw new Error('Origin must not be called.');
});

describe('route, method, CORS, body, and action contracts', () => {
  it('exposes a secret-free, no-store GET /health response only', async () => {
    const env = createTestEnv();
    const response = await handleWorkerRequest(
      createJsonRequest('/health', undefined, { method: 'GET', origin: null }),
      env,
      createDependencies(noOriginFetch),
    );
    const bodyText = await response.text();

    expect(response.status).toBe(200);
    expect(bodyText).toBe(`{"buildSha":"${TEST_BUILD_SHA}","ok":true}`);
    expect(bodyText).not.toContain(env.SUPABASE_URL);
    expect(bodyText).not.toContain(env.SUPABASE_PUBLISHABLE_KEY);
    expect(bodyText).not.toContain(env.ORIGIN_HMAC_SECRET);
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('x-request-id')).toBe(TEST_REQUEST_ID);
  });

  it('rejects unknown paths, trailing slashes, query strings, and wrong methods', async () => {
    const requests = [
      createJsonRequest('/v1/unknown', {}),
      createJsonRequest('/v1/auth-gateway/', { action: 'login' }),
      createJsonRequest('/v1/auth-gateway?debug=1', { action: 'login' }),
      createJsonRequest('/v1/maps-geocoding', undefined, { method: 'GET' }),
      createJsonRequest('/health', {}, { method: 'POST' }),
    ];

    for (const request of requests) {
      const response = await handleWorkerRequest(
        request,
        createTestEnv(),
        createDependencies(noOriginFetch),
      );
      expect([400, 404, 405]).toContain(response.status);
      expect(response.headers.get('cache-control')).toContain('no-store');
    }

    const wrongMethodResponse = await handleWorkerRequest(
      createJsonRequest('/v1/maps-geocoding', undefined, { method: 'GET' }),
      createTestEnv(),
      createDependencies(noOriginFetch),
    );
    expect(wrongMethodResponse.headers.get('allow')).toBe('POST, OPTIONS');
  });

  it('redacts untrusted paths and never logs request body identifiers', async () => {
    const logEntries: Array<Record<string, unknown>> = [];
    const response = await handleWorkerRequest(
      createJsonRequest('/unknown/user@example.com', { email: 'body@example.com' }),
      createTestEnv(),
      createDependencies(noOriginFetch, {
        log: (_level, entry) => logEntries.push(entry),
      }),
    );

    expect(response.status).toBe(404);
    expect(logEntries).toHaveLength(1);
    expect(logEntries[0]).toMatchObject({
      action: 'none',
      actorType: 'none',
      event: 'edge_request_complete',
      path: 'unmatched',
      status: 404,
    });
    expect(JSON.stringify(logEntries)).not.toContain('user@example.com');
    expect(JSON.stringify(logEntries)).not.toContain('body@example.com');
  });

  it('allows native requests without Origin and enforces the exact browser allowlist', async () => {
    const fetchFunction = toFetchFunction(() => jsonOriginResponse({ success: true }));
    const nativeResponse = await handleWorkerRequest(
      createJsonRequest(
        '/v1/auth-gateway',
        { action: 'login', email: 'native@example.com', password: 'secret' },
        { origin: null },
      ),
      createTestEnv(),
      createDependencies(fetchFunction),
    );
    const blockedResponse = await handleWorkerRequest(
      createJsonRequest(
        '/v1/auth-gateway',
        { action: 'login', email: 'browser@example.com', password: 'secret' },
        { origin: 'https://evil.example' },
      ),
      createTestEnv(),
      createDependencies(noOriginFetch),
    );

    expect(nativeResponse.status).toBe(200);
    expect(nativeResponse.headers.has('access-control-allow-origin')).toBe(false);
    expect(blockedResponse.status).toBe(403);
    expect(blockedResponse.headers.has('access-control-allow-origin')).toBe(false);
  });

  it('handles an exact CORS preflight and rejects unapproved headers', async () => {
    const allowedRequest = new Request('https://edge.example/v1/auth-gateway', {
      headers: {
        'Access-Control-Request-Headers': 'authorization, content-type, x-request-id',
        'Access-Control-Request-Method': 'POST',
        Origin: TEST_ORIGIN,
      },
      method: 'OPTIONS',
    });
    const blockedRequest = new Request('https://edge.example/v1/auth-gateway', {
      headers: {
        'Access-Control-Request-Headers': 'content-type, x-unapproved-header',
        'Access-Control-Request-Method': 'POST',
        Origin: TEST_ORIGIN,
      },
      method: 'OPTIONS',
    });
    const allowedResponse = await handleWorkerRequest(
      allowedRequest,
      createTestEnv(),
      createDependencies(noOriginFetch),
    );
    const blockedResponse = await handleWorkerRequest(
      blockedRequest,
      createTestEnv(),
      createDependencies(noOriginFetch),
    );

    expect(allowedResponse.status).toBe(204);
    expect(allowedResponse.headers.get('access-control-allow-origin')).toBe(TEST_ORIGIN);
    expect(allowedResponse.headers.get('access-control-allow-methods')).toBe('POST');
    expect(blockedResponse.status).toBe(403);
  });

  it('rejects media upload actions, fileBase64 fields, and over-limit streaming bodies', async () => {
    const uploadResponse = await handleWorkerRequest(
      createJsonRequest('/v1/media-assets', {
        action: 'upload',
        bucket: 'place-media',
        contentType: 'image/jpeg',
        fileBase64: 'AQID',
        prefix: 'cover',
      }),
      createTestEnv(),
      createDependencies(noOriginFetch),
    );
    const smuggledBase64Response = await handleWorkerRequest(
      createJsonRequest('/v1/media-assets', {
        action: 'create-read-url',
        bucket: 'place-media-private',
        fileBase64: 'AQID',
        path: `${TEST_USER_ID}/asset.jpg`,
      }),
      createTestEnv(),
      createDependencies(noOriginFetch),
    );
    const oversizedResponse = await handleWorkerRequest(
      createJsonRequest('/v1/media-assets', {
        action: 'upload',
        fileBase64: 'A'.repeat(70 * 1024),
      }),
      createTestEnv(),
      createDependencies(noOriginFetch),
    );

    expect(uploadResponse.status).toBe(413);
    await expect(uploadResponse.json()).resolves.toMatchObject({
      code: 'media_body_proxy_forbidden',
    });
    expect(smuggledBase64Response.status).toBe(413);
    expect(oversizedResponse.status).toBe(413);
  });

  it('binds media upload lifecycle actions to UUID upload sessions', () => {
    const route = ROUTE_DEFINITIONS['/v1/media-assets'];
    const uploadSessionId = '30000000-0000-4000-8000-000000000003';
    const createUpload = {
      action: 'create-upload-url',
      bucket: 'place-media-private',
      contentType: 'image/jpeg',
      fileSizeBytes: 1_024,
      prefix: 'cover',
    };
    const completeUpload = {
      action: 'complete-upload',
      bucket: 'place-media-private',
      contentType: 'image/jpeg',
      fileSizeBytes: 1_024,
      mediaType: 'photo',
      objectPath: `${TEST_USER_ID}/asset.jpg`,
    };
    const deleteUpload = {
      action: 'delete',
      bucket: 'place-media-private',
      paths: [`${TEST_USER_ID}/asset.jpg`],
    };

    expect(validatePayload(route, createUpload)).toMatchObject({ success: false });
    expect(validatePayload(route, { ...createUpload, uploadSessionId })).toMatchObject({
      action: 'create-upload-url',
      success: true,
    });
    expect(validatePayload(route, completeUpload)).toMatchObject({ success: false });
    expect(validatePayload(route, { ...completeUpload, uploadSessionId })).toMatchObject({
      action: 'complete-upload',
      success: true,
    });
    expect(validatePayload(route, deleteUpload)).toMatchObject({
      action: 'delete',
      success: true,
    });
    expect(validatePayload(route, { ...deleteUpload, uploadSessionId })).toMatchObject({
      action: 'delete',
      success: true,
    });
    expect(
      validatePayload(route, { ...deleteUpload, uploadSessionId: 'not-a-uuid' }),
    ).toMatchObject({ success: false });
  });

  it('rejects non-JSON, malformed JSON, unknown fields, and invalid actions', async () => {
    const requests = [
      new Request('https://edge.example/v1/auth-gateway', {
        body: 'plain text',
        headers: { 'Cf-Connecting-Ip': '203.0.113.9', 'Content-Type': 'text/plain' },
        method: 'POST',
      }),
      new Request('https://edge.example/v1/auth-gateway', {
        body: '{',
        headers: { 'Cf-Connecting-Ip': '203.0.113.9', 'Content-Type': 'application/json' },
        method: 'POST',
      }),
      createJsonRequest('/v1/auth-gateway', {
        action: 'login',
        email: 'user@example.com',
        extra: true,
        password: 'secret',
      }),
      createJsonRequest('/v1/maps-geocoding', { action: 'delete-everything' }),
    ];

    for (const request of requests) {
      const response = await handleWorkerRequest(
        request,
        createTestEnv(),
        createDependencies(noOriginFetch),
      );
      expect([400, 415]).toContain(response.status);
    }
  });

  it('accepts an authenticated media control action and never accepts media bytes', async () => {
    const jwt = await createJwtFixture();
    const token = await jwt.signToken();
    let originCalled = false;
    const fetchFunction = toFetchFunction((request) => {
      if (new URL(request.url).pathname.endsWith('/.well-known/jwks.json')) {
        return jsonOriginResponse(jwt.jwks);
      }

      originCalled = true;
      return jsonOriginResponse({ signedUrl: 'https://storage.example/signed' });
    });
    const response = await handleWorkerRequest(
      createJsonRequest(
        '/v1/media-assets',
        {
          action: 'create-read-url',
          bucket: 'place-media-private',
          path: `${TEST_USER_ID}/asset.jpg`,
        },
        { token },
      ),
      createTestEnv(),
      createDependencies(fetchFunction),
    );

    expect(response.status).toBe(200);
    expect(originCalled).toBe(true);
  });

  it('binds authenticated actor IDs to account availability and moderation payloads', async () => {
    const jwt = await createJwtFixture();
    const token = await jwt.signToken();
    const availabilityResponse = await handleWorkerRequest(
      createJsonRequest(
        '/v1/auth-gateway',
        {
          action: 'check-availability',
          excludeUserId: TEST_USER_B_ID,
          username: 'candidate_name',
        },
        { token },
      ),
      createTestEnv(),
      createDependencies(toFetchFunction((request) => {
        if (new URL(request.url).pathname.endsWith('/.well-known/jwks.json')) {
          return jsonOriginResponse(jwt.jwks);
        }

        return jsonOriginResponse();
      })),
    );
    const moderationResponse = await handleWorkerRequest(
      createJsonRequest(
        '/v1/moderation-reports',
        {
          reason: 'spam',
          reporterUserId: TEST_USER_B_ID,
          targetType: 'user',
          targetUserId: TEST_USER_ID,
        },
        { token },
      ),
      createTestEnv(),
      createDependencies(toFetchFunction((request) => {
        if (new URL(request.url).pathname.endsWith('/.well-known/jwks.json')) {
          return jsonOriginResponse(jwt.jwks);
        }

        return jsonOriginResponse();
      })),
    );

    expect(availabilityResponse.status).toBe(403);
    expect(moderationResponse.status).toBe(403);
  });
});
