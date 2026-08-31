import { describe, expect, it } from 'vitest';

import { handleWorkerRequest } from '../src/index';
import {
  createDependencies,
  createJsonRequest,
  createTestEnv,
  jsonOriginResponse,
  TEST_BUILD_SHA,
  toFetchFunction,
} from './helpers';

function createPublicLoginRequest(): Request {
  return createJsonRequest(
    '/v1/auth-gateway',
    { action: 'login', email: 'user@example.com', password: 'secret' },
    { origin: null },
  );
}

describe('origin proxy behavior', () => {
  it('exposes the immutable build SHA in the no-store health contract', async () => {
    const response = await handleWorkerRequest(
      createJsonRequest('/health', undefined, { method: 'GET', origin: null }),
      createTestEnv(),
      createDependencies(toFetchFunction(() => jsonOriginResponse())),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    await expect(response.json()).resolves.toEqual({ buildSha: TEST_BUILD_SHA, ok: true });
  });

  it('streams successful JSON while replacing cache and cookie headers', async () => {
    const fetchFunction = toFetchFunction(() =>
      jsonOriginResponse(
        { success: true },
        {
          headers: {
            'Cache-Control': 'public, max-age=86400',
            'Set-Cookie': 'session=must-not-leak',
          },
        },
      ),
    );
    const response = await handleWorkerRequest(
      createPublicLoginRequest(),
      createTestEnv(),
      createDependencies(fetchFunction),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    expect(response.headers.has('set-cookie')).toBe(false);
    expect(response.headers.get('pragma')).toBe('no-cache');
  });

  it('preserves a valid origin Retry-After but not the origin response body', async () => {
    const fetchFunction = toFetchFunction(
      () =>
        new Response('{"secret":"origin detail"}', {
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '17',
          },
          status: 429,
        }),
    );
    const response = await handleWorkerRequest(
      createPublicLoginRequest(),
      createTestEnv(),
      createDependencies(fetchFunction),
    );
    const bodyText = await response.text();

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('17');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(bodyText).not.toContain('origin detail');
  });

  it('does not retry mutations and sanitizes origin 5xx responses', async () => {
    let originCalls = 0;
    const fetchFunction = toFetchFunction(() => {
      originCalls += 1;
      return new Response('{"stack":"upstream-internal-secret"}', {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      });
    });
    const response = await handleWorkerRequest(
      createPublicLoginRequest(),
      createTestEnv(),
      createDependencies(fetchFunction),
    );
    const bodyText = await response.text();

    expect(response.status).toBe(502);
    expect(originCalls).toBe(1);
    expect(bodyText).not.toContain('upstream-internal-secret');
    expect(bodyText).not.toContain('stack');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('aborts a timed-out mutation once and returns a no-store 504', async () => {
    let originCalls = 0;
    const fetchFunction = toFetchFunction((request) => {
      originCalls += 1;

      return new Promise<Response>((_resolve, reject) => {
        if (request.signal.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }

        request.signal.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      });
    });
    const response = await handleWorkerRequest(
      createPublicLoginRequest(),
      createTestEnv({ ORIGIN_TIMEOUT_MS: '1000' }),
      createDependencies(fetchFunction),
    );

    expect(response.status).toBe(504);
    expect(originCalls).toBe(1);
    expect(response.headers.get('cache-control')).toContain('no-store');
    await expect(response.json()).resolves.toMatchObject({ code: 'origin_timeout' });
  });

  it('rejects non-JSON and redirect responses from the origin', async () => {
    for (const originResponse of [
      new Response('<html>bad gateway</html>', {
        headers: { 'Content-Type': 'text/html' },
        status: 200,
      }),
      new Response(null, {
        headers: { Location: 'https://other.example' },
        status: 302,
      }),
    ]) {
      const response = await handleWorkerRequest(
        createPublicLoginRequest(),
        createTestEnv(),
        createDependencies(toFetchFunction(() => originResponse.clone())),
      );

      expect(response.status).toBe(502);
      expect(response.headers.get('cache-control')).toContain('no-store');
    }
  });

  it('fails health closed without echoing invalid configuration values', async () => {
    const badSecret = 'too-short';
    const response = await handleWorkerRequest(
      createJsonRequest('/health', undefined, { method: 'GET', origin: null }),
      createTestEnv({ ORIGIN_HMAC_SECRET: badSecret }),
      createDependencies(toFetchFunction(() => jsonOriginResponse())),
    );
    const bodyText = await response.text();

    expect(response.status).toBe(503);
    expect(bodyText).not.toContain(badSecret);
    expect(bodyText).not.toContain('SUPABASE');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
});
