import { describe, expect, it, vi } from 'vitest';

import { createRequestSignature, sha256Hex } from '../_shared/requestSecurity';
import { createMediaAssetsHandler } from './handler';

const validPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAIAgMBgOnl9QAAAABJRU5ErkJggg==';
const validPngBytes = Uint8Array.from(Buffer.from(validPngBase64, 'base64'));

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
  rateLimitResult?: {
    allowed: boolean;
    remaining: number;
    retry_after_seconds: number;
  };
  privateMediaAuthResult?: {
    data?: unknown;
    error?: { message: string } | null;
  };
  listVisibilityResult?: {
    data?: { is_public?: boolean | null; owner_id?: string | null } | null;
    error?: { message: string } | null;
  };
  removeError?: { message: string } | null;
  objectInfoResult?: {
    data?: {
      contentType?: string | null;
      metadata?: { mimetype?: string | null; size?: number | null } | null;
      size?: number | null;
    } | null;
    error?: { message: string } | null;
  };
  objectPrefixBytes?: Uint8Array;
  uploadError?: { message: string } | null;
}) {
  const uploadMock = vi.fn().mockResolvedValue({ error: options?.uploadError ?? null });
  const removeMock = vi.fn().mockResolvedValue({ error: options?.removeError ?? null });
  const createSignedUploadUrlMock = vi.fn().mockImplementation((path: string) =>
    Promise.resolve({
      data: {
        signedUrl: `https://storage.example/upload/${encodeURIComponent(path)}`,
      },
      error: null,
    }));
  const createSignedUrlMock = vi.fn().mockImplementation((path: string) =>
    Promise.resolve({
      data: {
        signedUrl: `https://storage.example/read/${encodeURIComponent(path)}`,
      },
      error: null,
    }));
  const createSignedUrlsMock = vi.fn().mockImplementation((paths: string[]) =>
    Promise.resolve({
      data: paths.map((path) => ({
        error: null,
        path,
        signedUrl: `https://storage.example/read/${encodeURIComponent(path)}`,
      })),
      error: null,
    }));
  const infoMock = vi.fn().mockResolvedValue(options?.objectInfoResult ?? {
    data: {
      contentType: 'image/png',
      size: 1024,
    },
    error: null,
  });
  const fetchObjectPrefixMock = vi.fn().mockResolvedValue(
    options?.objectPrefixBytes ?? validPngBytes,
  );
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
  const rpcMock = vi.fn().mockImplementation((
    functionName: string,
    args?: Record<string, unknown>,
  ) => {
    if (functionName === 'enforce_edge_rate_limit') {
      return Promise.resolve({
        data: options?.rateLimitResult ?? {
          allowed: true,
          remaining: 999,
          retry_after_seconds: 0,
        },
        error: null,
      });
    }

    if (functionName === 'can_read_private_place_media') {
      return Promise.resolve(options?.privateMediaAuthResult ?? {
        data: true,
        error: null,
      });
    }

    if (functionName === 'can_read_private_place_media_batch') {
      const paths = Array.isArray(args?.p_paths) ? args.p_paths : [];
      return Promise.resolve({
        data: paths.map((path) => ({ allowed: true, path })),
        error: null,
      });
    }

    return Promise.resolve({
      data: null,
      error: { message: `Unexpected RPC: ${functionName}` },
    });
  });

  const handler = createMediaAssetsHandler({
    config: {
      allowedOrigins: options?.allowedOrigins ?? ['http://localhost:5173'],
      supabasePublishableKey: options?.config?.supabasePublishableKey ?? 'anon-key',
      supabaseServiceRoleKey: options?.config?.supabaseServiceRoleKey ?? 'service-role',
      supabaseUrl: options?.config?.supabaseUrl ?? 'https://example.supabase.co',
    },
    createAdminClient: () => ({
      rpc: rpcMock,
      from: (table: string) => ({
        delete: () => ({
          lt: nonceDeleteLtMock,
        }),
        insert: nonceInsertMock,
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve(
              table === 'lists'
                ? options?.listVisibilityResult ?? {
                    data: { is_public: true, owner_id: 'other-user' },
                    error: null,
                  }
                : { data: null, error: null },
            ),
          }),
        }),
      }),
      storage: {
        from: () => ({
          createSignedUploadUrl: createSignedUploadUrlMock,
          createSignedUrl: createSignedUrlMock,
          createSignedUrls: createSignedUrlsMock,
          getPublicUrl: (path: string) => ({
            data: {
              publicUrl: `https://example.supabase.co/storage/v1/object/public/place-media/${path}`,
            },
          }),
          info: infoMock,
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
    fetchObjectPrefix: fetchObjectPrefixMock,
  });

  return {
    getClaimsMock,
    handler,
    removeMock,
    nonceInsertMock,
    rpcMock,
    createSignedUploadUrlMock,
    createSignedUrlMock,
    createSignedUrlsMock,
    fetchObjectPrefixMock,
    infoMock,
    uploadMock,
  };
}

describe('media-assets handler', () => {
  let signedHeaderCounter = 0;

  async function createSignedHeaders(body: string) {
    signedHeaderCounter += 1;
    const deviceId = `device-1234-${signedHeaderCounter}`;
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
      code: 'misconfigured',
      error: 'Medya servisi su anda kullanilamiyor.',
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
          bucket: 'profile-media',
          contentType: 'image/png',
          fileBase64: oversizedBase64,
          prefix: 'profile/avatar',
        })),
        body: JSON.stringify({
          action: 'upload',
          bucket: 'profile-media',
          contentType: 'image/png',
          fileBase64: oversizedBase64,
          prefix: 'profile/avatar',
        }),
      }),
    );
    expect(oversizedResponse.status).toBe(413);
    await expect(oversizedResponse.json()).resolves.toMatchObject({
      error: 'Media payload exceeds size limit',
    });

    const oversizedSignedUploadBody = JSON.stringify({
      action: 'create-upload-url',
      bucket: 'place-media-private',
      contentType: 'video/mp4',
      extension: 'mp4',
      fileSizeBytes: 48_512_751,
      prefix: 'list-1/video',
    });
    const oversizedSignedUploadResponse = await oversizedHandler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(oversizedSignedUploadBody),
        body: oversizedSignedUploadBody,
      }),
    );
    expect(oversizedSignedUploadResponse.status).toBe(413);
    await expect(oversizedSignedUploadResponse.json()).resolves.toMatchObject({
      error: 'Dosya boyutu limiti asildi. En fazla 47 MB destekleniyor.',
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
      error: 'Medya yuklemesi tamamlanamadi.',
    });
  });

  it('returns retry timing details when media requests are rate limited', async () => {
    const { handler } = createDeps({
      rateLimitResult: {
        allowed: false,
        remaining: 0,
        retry_after_seconds: 75,
      },
    });
    const requestBody = JSON.stringify({
      action: 'create-upload-url',
      bucket: 'place-media-private',
      contentType: 'image/jpeg',
      extension: 'jpg',
      fileSizeBytes: 1024,
      prefix: 'list-1/cover',
    });

    const response = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(requestBody),
        body: requestBody,
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('75');
    await expect(response.json()).resolves.toMatchObject({
      code: 'rate_limited',
      error: 'Medya istek sinirina ulasildi. Lutfen 1 dakika 15 saniye sonra tekrar deneyin.',
      retryAfterSeconds: 75,
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
        cacheControl: '31536000',
        contentType: 'image/png',
        upsert: false,
      },
    );
    await expect(response.json()).resolves.toMatchObject({
      publicUrl: 'https://example.supabase.co/storage/v1/object/public/place-media/user-1/list-1/cover-request-1.png',
    });
  });

  it('creates private upload refs and authorizes private read URLs', async () => {
    const { createSignedUploadUrlMock, createSignedUrlMock, handler, rpcMock } = createDeps();
    const uploadUrlBody = JSON.stringify({
      action: 'create-upload-url',
      bucket: 'place-media-private',
      contentType: 'image/jpeg',
      extension: 'jpg',
      fileSizeBytes: 1024,
      prefix: 'list-1/place-1/0',
    });
    const uploadUrlResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(uploadUrlBody),
        body: uploadUrlBody,
      }),
    );

    expect(uploadUrlResponse.status).toBe(200);
    expect(createSignedUploadUrlMock).toHaveBeenCalledWith('user-1/list-1/place-1/0-request-1.jpg');
    await expect(uploadUrlResponse.json()).resolves.toMatchObject({
      objectPath: 'user-1/list-1/place-1/0-request-1.jpg',
      signedUrl: 'https://storage.example/upload/user-1%2Flist-1%2Fplace-1%2F0-request-1.jpg',
      storageUri: 'sorita-storage://place-media-private/user-1/list-1/place-1/0-request-1.jpg',
    });

    const readUrlBody = JSON.stringify({
      action: 'create-read-url',
      bucket: 'place-media-private',
      path: 'other-user/list-1/place-1/0.jpg',
    });
    const readUrlResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(readUrlBody),
        body: readUrlBody,
      }),
    );

    expect(readUrlResponse.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith('can_read_private_place_media', {
      p_bucket: 'place-media-private',
      p_path: 'other-user/list-1/place-1/0.jpg',
      p_viewer_id: 'user-1',
    });
    expect(createSignedUrlMock).toHaveBeenCalledWith('other-user/list-1/place-1/0.jpg', 300);
    await expect(readUrlResponse.json()).resolves.toMatchObject({
      expiresInSeconds: 300,
      signedUrl: 'https://storage.example/read/other-user%2Flist-1%2Fplace-1%2F0.jpg',
    });

    const { handler: forbiddenHandler } = createDeps({
      privateMediaAuthResult: {
        data: false,
        error: null,
      },
    });
    const forbiddenResponse = await forbiddenHandler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(readUrlBody),
        body: readUrlBody,
      }),
    );

    expect(forbiddenResponse.status).toBe(403);
    await expect(forbiddenResponse.json()).resolves.toMatchObject({
      error: 'Media asset is not visible to this user.',
    });
  });

  it('finalizes signed uploads only after storage metadata and signature verification', async () => {
    const {
      createSignedUrlMock,
      fetchObjectPrefixMock,
      handler,
      infoMock,
      removeMock,
    } = createDeps();
    const body = JSON.stringify({
      action: 'complete-upload',
      bucket: 'place-media-private',
      contentType: 'image/png',
      fileSizeBytes: 1024,
      height: 1,
      mediaType: 'photo',
      objectPath: 'user-1/list-1/place-1/0-request-1.png',
      width: 1,
    });
    const response = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(body),
        body,
      }),
    );

    expect(response.status).toBe(200);
    expect(infoMock).toHaveBeenCalledWith('user-1/list-1/place-1/0-request-1.png');
    expect(createSignedUrlMock).toHaveBeenCalledWith(
      'user-1/list-1/place-1/0-request-1.png',
      60,
    );
    expect(fetchObjectPrefixMock).toHaveBeenCalledWith(
      expect.stringContaining('https://storage.example/read/'),
      512 * 1024,
      1024,
    );
    expect(removeMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      storageUri: 'sorita-storage://place-media-private/user-1/list-1/place-1/0-request-1.png',
      verified: true,
    });
  });

  it('removes signed uploads whose actual metadata or signature is invalid', async () => {
    const invalidSizeDeps = createDeps({
      objectInfoResult: {
        data: { contentType: 'image/png', size: 2048 },
        error: null,
      },
    });
    const body = JSON.stringify({
      action: 'complete-upload',
      bucket: 'place-media-private',
      contentType: 'image/png',
      fileSizeBytes: 1024,
      mediaType: 'photo',
      objectPath: 'user-1/list-1/place-1/invalid.png',
    });
    const invalidSizeResponse = await invalidSizeDeps.handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(body),
        body,
      }),
    );

    expect(invalidSizeResponse.status).toBe(422);
    expect(invalidSizeDeps.removeMock).toHaveBeenCalledWith([
      'user-1/list-1/place-1/invalid.png',
    ]);

    const invalidSignatureDeps = createDeps({
      objectPrefixBytes: Uint8Array.from([0, 1, 2, 3, 4, 5]),
    });
    const invalidSignatureResponse = await invalidSignatureDeps.handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(body),
        body,
      }),
    );

    expect(invalidSignatureResponse.status).toBe(422);
    expect(invalidSignatureDeps.removeMock).toHaveBeenCalledWith([
      'user-1/list-1/place-1/invalid.png',
    ]);
  });

  it('authorizes and signs private media paths in one batch response', async () => {
    const { createSignedUrlsMock, handler, rpcMock } = createDeps();
    const body = JSON.stringify({
      action: 'create-read-urls',
      bucket: 'place-media-private',
      paths: [
        'other-user/list-1/place-1/0.jpg',
        'other-user/list-1/place-1/1.jpg',
      ],
    });
    const response = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(body),
        body,
      }),
    );

    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock).toHaveBeenCalledWith('can_read_private_place_media_batch', {
      p_bucket: 'place-media-private',
      p_paths: [
        'other-user/list-1/place-1/0.jpg',
        'other-user/list-1/place-1/1.jpg',
      ],
      p_viewer_id: 'user-1',
    });
    expect(createSignedUrlsMock).toHaveBeenCalledWith(
      [
        'other-user/list-1/place-1/0.jpg',
        'other-user/list-1/place-1/1.jpg',
      ],
      300,
    );
    await expect(response.json()).resolves.toMatchObject({
      expiresInSeconds: 300,
      items: [
        { path: 'other-user/list-1/place-1/0.jpg' },
        { path: 'other-user/list-1/place-1/1.jpg' },
      ],
    });
  });

  it('fails closed when private media database authorization fails', async () => {
    const { createSignedUrlMock, handler } = createDeps({
      privateMediaAuthResult: {
        data: null,
        error: { message: 'authorization rpc failed' },
      },
    });
    const readUrlBody = JSON.stringify({
      action: 'create-read-url',
      bucket: 'place-media-private',
      path: 'other-user/list-1/place-1/0.jpg',
    });

    const response = await handler(
      new Request('https://example.supabase.co/functions/v1/media-assets', {
        method: 'POST',
        headers: await createSignedHeaders(readUrlBody),
        body: readUrlBody,
      }),
    );

    expect(response.status).toBe(500);
    expect(createSignedUrlMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      code: 'authorization_failed',
      error: 'Media authorization failed.',
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
      error: 'Medya silme islemi tamamlanamadi.',
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
