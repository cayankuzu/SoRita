import { describe, expect, it, vi } from 'vitest';

import { createRequestSignature, sha256Hex } from '../_shared/requestSecurity';
import { createMediaAssetsHandler } from './handler';

const validPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAIAgMBgOnl9QAAAABJRU5ErkJggg==';

function createDeps(options?: {
  allowedOrigins?: string[];
  claimsResult?: {
    data?: { claims?: { sub?: string } | null } | null;
    error?: { message: string } | null;
  };
  config?: {
    supabasePublishableKey?: string;
    supabaseServiceRoleKey?: string;
    supabaseUrl?: string;
  };
  removeError?: { message: string } | null;
  uploadError?: { message: string } | null;
}) {
  const uploadMock = vi.fn().mockResolvedValue({ error: options?.uploadError ?? null });
  const removeMock = vi.fn().mockResolvedValue({ error: options?.removeError ?? null });
  const nonceDeleteLtMock = vi.fn().mockResolvedValue({ error: null });
  const seenNonces = new Set<string>();
  const nonceInsertMock = vi.fn().mockImplementation(async (payload: { nonce?: string }) => {
    const nonce = payload?.nonce;

    if (nonce && seenNonces.has(nonce)) {
      return {
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint',
        },
      };
    }

    if (nonce) {
      seenNonces.add(nonce);
    }

    return { error: null };
  });
  const getClaimsMock = vi.fn().mockResolvedValue(options?.claimsResult ?? {
    data: {
      claims: {
        sub: 'user-1',
      },
    },
    error: null,
  });

  const handler = createMediaAssetsHandler({
    config: {
      allowedOrigins: options?.allowedOrigins ?? ['http://localhost:5173'],
      supabasePublishableKey: options?.config?.supabasePublishableKey ?? 'anon-key',
      supabaseServiceRoleKey: options?.config?.supabaseServiceRoleKey ?? 'service-role',
      supabaseUrl: options?.config?.supabaseUrl ?? 'https://example.supabase.co',
    },
    createAdminClient: () => ({
      from: () => ({
        delete: () => ({
          lt: nonceDeleteLtMock,
        }),
        insert: nonceInsertMock,
      }),
      storage: {
        from: () => ({
          getPublicUrl: (path: string) => ({
            data: {
              publicUrl: `https://example.supabase.co/storage/v1/object/public/place-media/${path}`,
            },
          }),
          remove: removeMock,
          upload: uploadMock,
        }),
      },
    }),
    createAuthClient: () => ({
      auth: {
        getClaims: getClaimsMock,
      },
    }),
    createRequestId: () => 'request-1',
  });

  return {
    getClaimsMock,
    handler,
    removeMock,
    nonceInsertMock,
    uploadMock,
  };
}

describe('media-assets handler', () => {
  let signedHeaderCounter = 0;

  async function createSignedHeaders(body: string) {
    const deviceId = 'device-1234';
    signedHeaderCounter += 1;
    const nonce = `nonce-1234-5678-90ab-${signedHeaderCounter}`;
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

  it('handles preflight and method validation', async () => {
    const { handler } = createDeps();

    const optionsResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:5173',
        },
      }),
    );
    expect(optionsResponse.status).toBe(200);
    expect(optionsResponse.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');

    const methodResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'GET',
      }),
    );
    expect(methodResponse.status).toBe(405);
    await expect(methodResponse.json()).resolves.toMatchObject({
      error: 'Method not allowed',
    });
  });

  it('fails fast when the function is misconfigured or authorization is missing', async () => {
    const { handler: misconfiguredHandler } = createDeps({
      config: {
        supabasePublishableKey: '',
      },
    });
    const misconfiguredResponse = await misconfiguredHandler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
      }),
    );
    expect(misconfiguredResponse.status).toBe(500);
    await expect(misconfiguredResponse.json()).resolves.toMatchObject({
      error: 'Function is not configured',
    });

    const { handler } = createDeps();
    const missingAuthResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        body: JSON.stringify({ action: 'upload' }),
      }),
    );

    expect(missingAuthResponse.status).toBe(401);
    await expect(missingAuthResponse.json()).resolves.toMatchObject({
      error: 'Missing authorization header',
    });
  });

  it('rejects invalid jwt claims and malformed request bodies', async () => {
    const { handler: invalidJwtHandler } = createDeps({
      claimsResult: {
        data: null,
        error: { message: 'Invalid token' },
      },
    });

    const invalidJwtResponse = await invalidJwtHandler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(JSON.stringify({ action: 'upload' })),
        body: JSON.stringify({ action: 'upload' }),
      }),
    );

    expect(invalidJwtResponse.status).toBe(401);
    await expect(invalidJwtResponse.json()).resolves.toMatchObject({
      error: 'Invalid token',
    });

    const { handler } = createDeps();
    const malformedJsonResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders('{bad json'),
        body: '{bad json',
      }),
    );
    expect(malformedJsonResponse.status).toBe(400);
    await expect(malformedJsonResponse.json()).resolves.toMatchObject({
      error: 'Malformed JSON body',
    });
  });

  it('rejects missing, tampered, and replayed signed requests', async () => {
    const { handler } = createDeps();
    const body = JSON.stringify({
      action: 'upload',
      bucket: 'place-media',
      contentType: 'image/png',
      fileBase64: validPngBase64,
      prefix: 'list-1/cover',
    });

    const missingSignatureResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token-1',
        },
        body,
      }),
    );
    expect(missingSignatureResponse.status).toBe(401);

    const tamperedHeaders = await createSignedHeaders(body);
    const tamperedResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: tamperedHeaders,
        body: JSON.stringify({
          action: 'upload',
          bucket: 'place-media',
          contentType: 'image/png',
          fileBase64: 'ZmFrZQ==',
          prefix: 'list-1/cover',
        }),
      }),
    );
    expect(tamperedResponse.status).toBe(401);
    await expect(tamperedResponse.json()).resolves.toMatchObject({
      error: 'Request signature verification failed',
    });

    const replayHeaders = await createSignedHeaders(body);
    const firstReplayResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: replayHeaders,
        body,
      }),
    );
    expect(firstReplayResponse.status).toBe(200);

    const replayResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: replayHeaders,
        body,
      }),
    );
    expect(replayResponse.status).toBe(409);
    await expect(replayResponse.json()).resolves.toMatchObject({
      error: 'Replay detected',
    });
  });

  it('rejects invalid upload inputs', async () => {
    const { handler } = createDeps();
    const invalidBucketBody = JSON.stringify({
      action: 'upload',
      bucket: 'unknown',
      contentType: 'image/png',
      fileBase64: validPngBase64,
      prefix: 'list-1/cover',
    });

    const invalidBucketResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(invalidBucketBody),
        body: invalidBucketBody,
      }),
    );
    expect(invalidBucketResponse.status).toBe(400);
    await expect(invalidBucketResponse.json()).resolves.toMatchObject({
      error: 'Invalid media bucket',
    });

    const invalidMimeBody = JSON.stringify({
      action: 'upload',
      bucket: 'place-media',
      contentType: 'application/pdf',
      extension: 'pdf',
      fileBase64: 'aGVsbG8=',
      prefix: 'list-1/cover',
    });
    const invalidMimeResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(invalidMimeBody),
        body: invalidMimeBody,
      }),
    );
    expect(invalidMimeResponse.status).toBe(415);
    await expect(invalidMimeResponse.json()).resolves.toMatchObject({
      error: 'Unsupported media type',
    });

    const invalidPrefixBody = JSON.stringify({
      action: 'upload',
      bucket: 'place-media',
      contentType: 'image/png',
      fileBase64: validPngBase64,
      prefix: '../escape',
    });
    const invalidPrefixResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(invalidPrefixBody),
        body: invalidPrefixBody,
      }),
    );
    expect(invalidPrefixResponse.status).toBe(400);
    await expect(invalidPrefixResponse.json()).resolves.toMatchObject({
      error: 'Invalid upload prefix',
    });

    const invalidExtensionBody = JSON.stringify({
      action: 'upload',
      bucket: 'place-media',
      contentType: 'image/png',
      extension: 'gif',
      fileBase64: validPngBase64,
      prefix: 'list-1/cover',
    });
    const invalidExtensionResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(invalidExtensionBody),
        body: invalidExtensionBody,
      }),
    );
    expect(invalidExtensionResponse.status).toBe(400);
    await expect(invalidExtensionResponse.json()).resolves.toMatchObject({
      error: 'Invalid media extension',
    });

    const missingPayloadBody = JSON.stringify({
      action: 'upload',
      bucket: 'place-media',
      contentType: 'image/png',
      prefix: 'list-1/cover',
    });
    const missingPayloadResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(missingPayloadBody),
        body: missingPayloadBody,
      }),
    );
    expect(missingPayloadResponse.status).toBe(400);
    await expect(missingPayloadResponse.json()).resolves.toMatchObject({
      error: 'Missing media payload',
    });

    const invalidSignatureBody = JSON.stringify({
      action: 'upload',
      bucket: 'place-media',
      contentType: 'image/png',
      fileBase64: 'aGVsbG8=',
      prefix: 'list-1/cover',
    });
    const invalidSignatureResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(invalidSignatureBody),
        body: invalidSignatureBody,
      }),
    );
    expect(invalidSignatureResponse.status).toBe(400);
    await expect(invalidSignatureResponse.json()).resolves.toMatchObject({
      error: 'Media payload does not match content type',
    });
  });

  it('rejects oversized payloads and upload failures', async () => {
    const { handler: oversizedHandler } = createDeps();
    const oversizedBase64 = Buffer.alloc(5 * 1024 * 1024 + 1, 1).toString('base64');

    const oversizedResponse = await oversizedHandler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(JSON.stringify({
          action: 'upload',
          bucket: 'place-media',
          contentType: 'image/png',
          fileBase64: oversizedBase64,
          prefix: 'list-1/cover',
        })),
        body: JSON.stringify({
          action: 'upload',
          bucket: 'place-media',
          contentType: 'image/png',
          fileBase64: oversizedBase64,
          prefix: 'list-1/cover',
        }),
      }),
    );
    expect(oversizedResponse.status).toBe(400);
    await expect(oversizedResponse.json()).resolves.toMatchObject({
      error: 'Media payload exceeds size limit',
    });

    const { handler: uploadFailureHandler } = createDeps({
      uploadError: { message: 'upload failed' },
    });
    const uploadFailureBody = JSON.stringify({
      action: 'upload',
      bucket: 'place-media',
      contentType: 'image/png',
      fileBase64: validPngBase64,
      prefix: 'list-1/cover',
    });
    const uploadFailureResponse = await uploadFailureHandler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(uploadFailureBody),
        body: uploadFailureBody,
      }),
    );
    expect(uploadFailureResponse.status).toBe(500);
    await expect(uploadFailureResponse.json()).resolves.toMatchObject({
      error: 'upload failed',
    });
  });

  it('uploads valid media for the authenticated user', async () => {
    const { handler, uploadMock } = createDeps();
    const uploadBody = JSON.stringify({
      action: 'upload',
      bucket: 'place-media',
      contentType: 'image/png',
      extension: 'png',
      fileBase64: validPngBase64,
      prefix: 'list-1/cover',
    });
    const response = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(uploadBody),
        body: uploadBody,
      }),
    );

    expect(response.status).toBe(200);
    expect(uploadMock).toHaveBeenCalledWith(
      'user-1/list-1/cover-request-1.png',
      expect.any(Uint8Array),
      {
        contentType: 'image/png',
        upsert: false,
      },
    );
    await expect(response.json()).resolves.toMatchObject({
      publicUrl: 'https://example.supabase.co/storage/v1/object/public/place-media/user-1/list-1/cover-request-1.png',
    });
  });

  it('rejects invalid delete paths and handles empty/successful deletes', async () => {
    const { handler, removeMock } = createDeps();
    const invalidPathBody = JSON.stringify({
      action: 'delete',
      bucket: 'place-media',
      paths: ['other-user/cover.jpg'],
    });
    const invalidPathResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(invalidPathBody),
        body: invalidPathBody,
      }),
    );

    expect(invalidPathResponse.status).toBe(400);
    await expect(invalidPathResponse.json()).resolves.toMatchObject({
      error: 'Storage path is outside the authenticated user scope',
    });
    expect(removeMock).not.toHaveBeenCalled();

    const invalidPathsBody = JSON.stringify({
      action: 'delete',
      bucket: 'place-media',
      paths: 'nope',
    });
    const invalidPathsResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(invalidPathsBody),
        body: invalidPathsBody,
      }),
    );
    expect(invalidPathsResponse.status).toBe(400);
    await expect(invalidPathsResponse.json()).resolves.toMatchObject({
      error: 'Invalid storage paths',
    });

    const emptyPathsBody = JSON.stringify({
      action: 'delete',
      bucket: 'place-media',
      paths: [],
    });
    const emptyPathsResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(emptyPathsBody),
        body: emptyPathsBody,
      }),
    );
    expect(emptyPathsResponse.status).toBe(200);
    await expect(emptyPathsResponse.json()).resolves.toMatchObject({
      success: true,
    });

    const deleteBody = JSON.stringify({
      action: 'delete',
      bucket: 'place-media',
      paths: ['user-1/cover.jpg', 'user-1/cover.jpg'],
    });
    const deleteResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(deleteBody),
        body: deleteBody,
      }),
    );
    expect(deleteResponse.status).toBe(200);
    expect(removeMock).toHaveBeenCalledWith(['user-1/cover.jpg']);

    const tooManyPathsBody = JSON.stringify({
      action: 'delete',
      bucket: 'place-media',
      paths: Array.from({ length: 65 }, (_, index) => `user-1/path-${index}.jpg`),
    });
    const tooManyPathsResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(tooManyPathsBody),
        body: tooManyPathsBody,
      }),
    );
    expect(tooManyPathsResponse.status).toBe(400);
    await expect(tooManyPathsResponse.json()).resolves.toMatchObject({
      error: 'Too many storage paths',
    });
  });

  it('propagates delete failures and rejects unknown actions', async () => {
    const { handler: deleteFailureHandler } = createDeps({
      removeError: { message: 'remove failed' },
    });
    const deleteFailureBody = JSON.stringify({
      action: 'delete',
      bucket: 'place-media',
      paths: ['user-1/cover.jpg'],
    });
    const deleteFailureResponse = await deleteFailureHandler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(deleteFailureBody),
        body: deleteFailureBody,
      }),
    );
    expect(deleteFailureResponse.status).toBe(500);
    await expect(deleteFailureResponse.json()).resolves.toMatchObject({
      error: 'remove failed',
    });

    const { handler } = createDeps();
    const invalidActionBody = JSON.stringify({
      action: 'rename',
      bucket: 'place-media',
    });
    const invalidActionResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(invalidActionBody),
        body: invalidActionBody,
      }),
    );
    expect(invalidActionResponse.status).toBe(400);
    await expect(invalidActionResponse.json()).resolves.toMatchObject({
      error: 'Invalid media action',
    });
  });
});
