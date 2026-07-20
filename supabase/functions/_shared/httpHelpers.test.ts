import { describe, expect, it } from 'vitest';

import {
  corsPreflightResponse,
  getBearerToken,
  getCorsHeaders,
  HttpRequestError,
  isHttpRequestError,
  jsonResponse,
  parseJsonBody,
} from './httpHelpers';

describe('httpHelpers', () => {
  it('emits allowlisted CORS, security, request-id, and override headers', async () => {
    const request = new Request('https://edge.example.com', {
      headers: { Origin: 'https://app.example.com' },
    });
    const headers = getCorsHeaders(
      request,
      ['https://other.example.com', 'https://app.example.com'],
      'request-1',
    );
    expect(headers).toMatchObject({
      'Access-Control-Allow-Origin': 'https://app.example.com',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-Request-Id': 'request-1',
    });

    const response = jsonResponse(request, ['https://app.example.com'], 201, { ok: true }, {
      extraHeaders: { 'Cache-Control': 'no-store' },
      requestId: 'request-2',
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Request-Id')).toBe('request-2');
  });

  it('falls back safely for denied or absent origins and handles preflight', async () => {
    const denied = new Request('https://edge.example.com', {
      headers: { Origin: 'https://evil.example.com' },
    });
    expect(getCorsHeaders(denied, ['https://app.example.com'])['Access-Control-Allow-Origin']).toBe(
      'https://app.example.com',
    );
    expect(getCorsHeaders(new Request('https://edge.example.com'), [])['Access-Control-Allow-Origin']).toBe(
      'null',
    );

    const preflight = corsPreflightResponse(denied, ['https://app.example.com']);
    expect(preflight.status).toBe(200);
    await expect(preflight.text()).resolves.toBe('ok');

    const response = jsonResponse(denied, ['https://app.example.com'], 200, { ok: true });
    expect(response.headers.get('X-Request-Id')).toBeNull();
  });

  it('parses JSON and bearer tokens with fail-closed malformed input', () => {
    expect(parseJsonBody(' {"ok":true} ')).toEqual({ ok: true });
    expect(parseJsonBody('')).toEqual({});
    expect(parseJsonBody('   ', null)).toBeNull();
    expect(() => parseJsonBody('{invalid')).toThrowError(HttpRequestError);

    try {
      parseJsonBody('{invalid');
    } catch (error) {
      expect(isHttpRequestError(error)).toBe(true);
      expect(error).toMatchObject({ code: 'invalid_json', status: 400 });
    }
    expect(isHttpRequestError(new Error('other'))).toBe(false);

    expect(getBearerToken(null)).toBeNull();
    expect(getBearerToken('Bearer token-1')).toBe('token-1');
    expect(getBearerToken('bearer    ')).toBeNull();
    expect(getBearerToken('raw-token')).toBe('raw-token');
  });
});
