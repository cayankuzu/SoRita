import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRequestSignature, sha256Hex } from '../_shared/requestSecurity';
import { createMapsGeocodingHandler } from './handler';

function createDeps(options?: {
  userResult?: {
    data?: { user?: { id?: string } | null } | null;
    error?: { message: string } | null;
  };
  rateLimited?: boolean;
  rateLimitError?: boolean;
  nonceDeleteError?: boolean;
  nonceInsertError?: { code?: string; message: string };
  configOverrides?: Partial<{
    allowedOrigins: string[];
    googleMapsServicesApiKey: string;
    supabasePublishableKey: string;
    supabaseServiceRoleKey: string;
    supabaseUrl: string;
  }>;
}) {
  const seenNonces = new Set<string>();
  const nonceDeleteLtMock = vi.fn().mockResolvedValue({
    error: options?.nonceDeleteError ? { message: 'cleanup unavailable' } : null,
  });
  const nonceInsertMock = vi.fn().mockImplementation(async (payload: { nonce?: string }) => {
    if (options?.nonceInsertError) return { error: options.nonceInsertError };
    const nonce = payload?.nonce;

    if (nonce && seenNonces.has(nonce)) {
      return {
        error: {
          code: '23505',
          message: 'duplicate',
        },
      };
    }

    if (nonce) {
      seenNonces.add(nonce);
    }

    return { error: null };
  });
  const rpcMock = vi.fn().mockResolvedValue({
    data: {
      allowed: !options?.rateLimited,
      remaining: options?.rateLimited ? 0 : 19,
      retry_after_seconds: options?.rateLimited ? 30 : 0,
    },
    error: options?.rateLimitError ? { message: 'rate limit unavailable' } : null,
  });
  const getUserMock = vi.fn().mockResolvedValue(options?.userResult ?? {
    data: {
      user: {
        id: 'user-1',
      },
    },
    error: null,
  });

  const handler = createMapsGeocodingHandler({
    config: {
      allowedOrigins: ['http://localhost:5173'],
      googleMapsServicesApiKey: 'google-server-key',
      supabasePublishableKey: 'anon-key',
      supabaseServiceRoleKey: 'service-role',
      supabaseUrl: 'https://example.supabase.co',
      ...options?.configOverrides,
    },
    createAdminClient: () => ({
      from: () => ({
        delete: () => ({
          lt: nonceDeleteLtMock,
        }),
        insert: nonceInsertMock,
      }),
      rpc: rpcMock,
    }),
    createAuthClient: () => ({
      auth: {
        getUser: getUserMock,
      },
    }),
  });

  return {
    getUserMock,
    handler,
    nonceDeleteLtMock,
    nonceInsertMock,
    rpcMock,
  };
}

let headerCounter = 0;

async function createSignedHeaders(body: string) {
  headerCounter += 1;
  const deviceId = `device-1234-${headerCounter}`;
  const nonce = `nonce-1234-5678-90ab-${headerCounter}`;
  const timestamp = Date.now().toString();
  const payloadHash = await sha256Hex(body);
  const signature = await createRequestSignature('token-1', {
    deviceId,
    functionName: 'maps-geocoding',
    method: 'POST',
    nonce,
    payloadHash,
    timestamp,
  });

  return {
    Authorization: 'Bearer token-1',
    'x-device-id': deviceId,
    'x-nonce': nonce,
    'x-signature': signature,
    'x-timestamp': timestamp,
  };
}

async function signedRequest(body: unknown, options: { method?: string; origin?: string } = {}) {
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body);
  const headers = new Headers(await createSignedHeaders(bodyText));
  headers.set('content-type', 'application/json');
  if (options.origin) headers.set('Origin', options.origin);

  return new Request('https://example.supabase.co/functions/v1/maps-geocoding', {
    body: options.method === 'GET' || options.method === 'OPTIONS' ? undefined : bodyText,
    headers,
    method: options.method ?? 'POST',
  });
}

describe('maps-geocoding handler', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects missing authorization and malformed JSON bodies', async () => {
    const { handler } = createDeps();

    const missingAuthResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/maps-geocoding', {
        method: 'POST',
        body: JSON.stringify({
          action: 'search',
          query: 'Kadikoy',
        }),
      }),
    );

    expect(missingAuthResponse.status).toBe(401);

    const malformedBody = '{bad json';
    const malformedJsonResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/maps-geocoding', {
        method: 'POST',
        headers: await createSignedHeaders(malformedBody),
        body: malformedBody,
      }),
    );

    expect(malformedJsonResponse.status).toBe(400);
    await expect(malformedJsonResponse.json()).resolves.toMatchObject({
      code: 'invalid_json',
      error: 'Malformed JSON body',
    });
  });

  it('proxies successful place searches through Google services', async () => {
    const { handler } = createDeps();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        places: [
          {
            displayName: { text: 'Moda Sahili' },
            formattedAddress: 'Kadikoy, Istanbul',
            id: 'place-1',
            location: { latitude: 40.98, longitude: 29.03 },
          },
        ],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [
          {
            formatted_address: 'Bahariye Cd, Kadikoy, Istanbul',
            geometry: {
              location: {
                lat: 40.99,
                lng: 29.04,
              },
            },
            place_id: 'geo-1',
          },
        ],
        status: 'OK',
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const body = JSON.stringify({
      action: 'search',
      query: 'Kadikoy',
    });
    const response = await handler(
      new Request('https://example.supabase.co/functions/v1/maps-geocoding', {
        method: 'POST',
        headers: await createSignedHeaders(body),
        body,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      results: expect.arrayContaining([
        expect.objectContaining({
          name: 'Moda Sahili',
          placeId: 'place-1',
        }),
        expect.objectContaining({
          placeId: 'geo-1',
        }),
      ]),
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns 429 when the geocoding rate limit is exceeded', async () => {
    const { handler } = createDeps({ rateLimited: true });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const body = JSON.stringify({
      action: 'reverse',
      latitude: 40.98,
      longitude: 29.03,
    });
    const response = await handler(
      new Request('https://example.supabase.co/functions/v1/maps-geocoding', {
        method: 'POST',
        headers: await createSignedHeaders(body),
        body,
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('30');
    await expect(response.json()).resolves.toMatchObject({
      code: 'rate_limited',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('handles CORS preflight, unsupported methods, and missing configuration', async () => {
    const { handler } = createDeps();
    const preflight = await handler(await signedRequest({}, {
      method: 'OPTIONS', origin: 'http://localhost:5173',
    }));
    expect(preflight.status).toBe(200);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');

    expect((await handler(await signedRequest({}, { method: 'GET' }))).status).toBe(405);

    for (const configOverrides of [
      { supabaseUrl: '' },
      { supabasePublishableKey: '' },
      { supabaseServiceRoleKey: '' },
      { googleMapsServicesApiKey: '' },
    ]) {
      const misconfigured = createDeps({ configOverrides }).handler;
      const response = await misconfigured(await signedRequest({ action: 'search', query: 'Moda' }));
      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toMatchObject({ code: 'misconfigured' });
    }
  });

  it('rejects invalid claims, missing signed headers, and invalid signed payloads', async () => {
    for (const userResult of [
      { data: { user: null }, error: null },
      { data: { user: {} }, error: null },
      { data: null, error: { message: 'expired' } },
    ]) {
      const { handler } = createDeps({ userResult });
      const response = await handler(await signedRequest({}));
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({ code: 'invalid_jwt' });
    }

    const { handler } = createDeps();
    const unsigned = await handler(new Request('https://example.supabase.co/functions/v1/maps-geocoding', {
      body: '{}', headers: { Authorization: 'Bearer token-1' }, method: 'POST',
    }));
    expect(unsigned.status).toBe(401);
    await expect(unsigned.json()).resolves.toMatchObject({ code: 'invalid_signature' });

    for (const payload of [
      {},
      { action: 'unknown' },
      { action: 'search', query: '' },
      { action: 'reverse', latitude: -91, longitude: 0 },
      { action: 'reverse', latitude: 0, longitude: 181 },
    ]) {
      const response = await handler(await signedRequest(payload));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ code: 'invalid_input' });
    }
  });

  it('sorts, deduplicates, and sanitizes results while ignoring malformed provider entries', async () => {
    const { handler } = createDeps();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        places: [
          { id: 'exact', displayName: { text: '  moda  ' }, formattedAddress: 'Istanbul', location: { latitude: 1, longitude: 1 } },
          { id: 'prefix', displayName: { text: 'Moda Sahili' }, formattedAddress: 'Istanbul', location: { latitude: 2, longitude: 2 } },
          { id: 'address-prefix', displayName: { text: 'Sahil' }, formattedAddress: 'Moda Caddesi', location: { latitude: 3, longitude: 3 } },
          { id: 'name-includes', displayName: { text: 'Buyuk Moda Parki' }, formattedAddress: 'Istanbul', location: { latitude: 4, longitude: 4 } },
          { id: 'address-includes', displayName: { text: 'Park' }, formattedAddress: 'Kadikoy Moda', location: { latitude: 5, longitude: 5 } },
          { id: 'other', displayName: {}, formattedAddress: '   ', location: { latitude: 6, longitude: 6 } },
          { id: 'invalid-lat', displayName: { text: 'Invalid' }, location: { longitude: 7 } },
          { id: 'invalid-lng', displayName: { text: 'Invalid' }, location: { latitude: 7 } },
        ],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [
          {
            address_components: [{ long_name: 'Moda Caddesi', types: ['route'] }],
            formatted_address: 'Moda Caddesi, Istanbul',
            geometry: { location: { lat: 8, lng: 8 } },
            place_id: 'geocode',
          },
          {
            address_components: [{ long_name: 'Bina', types: ['premise'] }],
            formatted_address: 'Bina, Istanbul',
            geometry: { location: { lat: 1, lng: 1 } },
            place_id: 'exact',
          },
          { formatted_address: 'No coordinates' },
        ],
        status: 'OK',
      }), { status: 200 })));

    const response = await handler(await signedRequest({ action: 'search', query: 'Moda' }));
    expect(response.status).toBe(200);
    const body = await response.json() as { results: Array<{ name: string; placeId: string }> };
    expect(body.results[0]).toMatchObject({ name: 'moda', placeId: 'exact' });
    expect(body.results.map((item) => item.placeId)).toEqual([
      'exact', 'other', 'prefix', 'geocode', 'address-prefix', 'name-includes', 'address-includes',
    ]);
  });

  it('keeps useful search results when one Google service fails', async () => {
    const { handler } = createDeps();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [{
          formatted_address: 'Moda, Istanbul',
          geometry: { location: { lat: 40.98, lng: 29.03 } },
        }],
        status: 'OK',
      }), { status: 200 })));

    const response = await handler(await signedRequest({ action: 'search', query: 'Moda' }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      results: [expect.objectContaining({ name: 'Moda', placeId: '40.98,29.03' })],
    });
  });

  it('returns an empty search result only when both providers complete without matches', async () => {
    const { handler } = createDeps();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ZERO_RESULTS' }), { status: 200 })));
    const response = await handler(await signedRequest({ action: 'search', query: 'Olmayan' }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ results: [] });
  });

  it('fails search when no fallback result survives provider errors', async () => {
    for (const responses of [
      [new Response('places failed', { status: 503 }), new Response(JSON.stringify({ status: 'ZERO_RESULTS' }), { status: 200 })],
      [new Response(JSON.stringify({ places: [] }), { status: 200 }), new Response('geocode failed', { status: 503 })],
      [new Response('places failed', { status: 503 }), new Response(JSON.stringify({ status: 'OVER_QUERY_LIMIT' }), { status: 200 })],
    ]) {
      const { handler } = createDeps();
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce(responses[0])
        .mockResolvedValueOnce(responses[1]));
      const response = await handler(await signedRequest({ action: 'search', query: 'Moda' }));
      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toMatchObject({ code: 'unexpected' });
    }
  });

  it('reverse geocodes points of interest and preserves provider coordinates', async () => {
    const { handler } = createDeps();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [{
        address_components: [
          { long_name: 'Moda Iskelesi', short_name: 'Iskele', types: ['point_of_interest'] },
        ],
        formatted_address: ' Moda Iskelesi, Kadikoy ',
        geometry: { location: { lat: 40.981, lng: 29.025 } },
        place_id: 'poi-1',
        types: ['POINT_OF_INTEREST'],
      }],
      status: 'OK',
    }), { status: 200 })));

    const response = await handler(await signedRequest({ action: 'reverse', latitude: 40.98, longitude: 29.03 }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      result: {
        address: 'Moda Iskelesi, Kadikoy',
        isPointOfInterest: true,
        lat: 40.981,
        lng: 29.025,
        name: 'Moda Iskelesi',
      },
    });
  });

  it('handles reverse geocoding with no result, ordinary addresses, and provider failures', async () => {
    const cases = [
      {
        provider: new Response(JSON.stringify({ status: 'ZERO_RESULTS' }), { status: 200 }),
        status: 200,
        expected: { result: { isPointOfInterest: false, lat: 40, lng: 29 } },
      },
      {
        provider: new Response(JSON.stringify({
          results: [{ formatted_address: 'Cadde, Istanbul', types: ['route'] }], status: 'OK',
        }), { status: 200 }),
        status: 200,
        expected: { result: { address: 'Cadde, Istanbul', isPointOfInterest: false, lat: 40, lng: 29 } },
      },
      { provider: new Response('failed', { status: 503 }), status: 500, expected: { code: 'unexpected' } },
      {
        provider: new Response(JSON.stringify({ status: 'REQUEST_DENIED' }), { status: 200 }),
        status: 500,
        expected: { code: 'unexpected' },
      },
    ];

    for (const testCase of cases) {
      const { handler } = createDeps();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(testCase.provider));
      const response = await handler(await signedRequest({ action: 'reverse', latitude: 40, longitude: 29 }));
      expect(response.status).toBe(testCase.status);
      await expect(response.json()).resolves.toMatchObject(testCase.expected);
    }
  });

  it('fails closed when rate-limit storage is unavailable', async () => {
    const { handler } = createDeps({ rateLimitError: true });
    vi.stubGlobal('fetch', vi.fn());
    const response = await handler(await signedRequest({ action: 'search', query: 'Moda' }));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ code: 'unexpected' });
  });
});
