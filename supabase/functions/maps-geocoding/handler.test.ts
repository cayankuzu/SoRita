import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRequestSignature, sha256Hex } from '../_shared/requestSecurity';
import { createMapsGeocodingHandler } from './handler';

function createDeps(options?: {
  claimsResult?: {
    data?: { claims?: { sub?: string } | null } | null;
    error?: { message: string } | null;
  };
  rateLimited?: boolean;
}) {
  const seenNonces = new Set<string>();
  const nonceDeleteLtMock = vi.fn().mockResolvedValue({ error: null });
  const nonceInsertMock = vi.fn().mockImplementation(async (payload: { nonce?: string }) => {
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
    error: null,
  });
  const getClaimsMock = vi.fn().mockResolvedValue(options?.claimsResult ?? {
    data: {
      claims: {
        sub: 'user-1',
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
        getClaims: getClaimsMock,
      },
    }),
  });

  return {
    getClaimsMock,
    handler,
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
});
