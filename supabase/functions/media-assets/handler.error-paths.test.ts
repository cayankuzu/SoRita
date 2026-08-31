import { describe, expect, it, vi } from 'vitest';

import { createRequestSignature, sha256Hex } from '../_shared/requestSecurity';
import { createMediaAssetsHandler } from './handler';

const validPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAIAgMBgOnl9QAAAABJRU5ErkJggg==';
const validPngBytes = Uint8Array.from(Buffer.from(validPngBase64, 'base64'));
const uploadSessionId = '11111111-1111-4111-8111-111111111111';
const requestId = 'test-request-id';

type RpcError = {
  code?: string;
  message: string;
};

type RpcResult = {
  data?: unknown;
  error?: RpcError | null;
};

type HarnessOptions = {
  config?: Partial<{
    supabasePublishableKey: string;
    supabaseServiceRoleKey: string;
    supabaseUrl: string;
  }>;
  createSignedUrlResult?: RpcResult;
  createSignedUrlsResult?: RpcResult;
  infoResult?: RpcResult;
  removeResult?: RpcResult;
  rpcOverride?: (
    functionName: string,
    args: Record<string, unknown>,
  ) => RpcResult | Promise<RpcResult | undefined> | undefined;
  userResult?: {
    data?: { user?: { id?: string } | null } | null;
    error?: RpcError | null;
  };
};

function createPrivateSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    claim_status: 'claimed',
    content_type: 'image/png',
    destination_bucket: 'place-media-private',
    destination_path: 'user-1/list-1/place-1/image.png',
    expected_size_bytes: 1024,
    lease_id: requestId,
    upload_bucket: 'place-media-private',
    upload_path: 'user-1/list-1/place-1/image.png',
    ...overrides,
  };
}

function createCleanupSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    claim_status: 'claimed',
    destination_bucket: 'place-media-private',
    destination_path: 'user-1/list-1/place-1/image.png',
    lease_id: requestId,
    upload_bucket: 'place-media-private',
    upload_path: 'user-1/list-1/place-1/image.png',
    ...overrides,
  };
}

function createHarness(options: HarnessOptions = {}) {
  const insertNonceMock = vi.fn().mockResolvedValue({ error: null });
  const removeMock = vi.fn().mockResolvedValue(options.removeResult ?? { error: null });
  const infoMock = vi.fn().mockResolvedValue(options.infoResult ?? {
    data: { contentType: 'image/png', size: 1024 },
    error: null,
  });
  const createSignedUrlMock = vi.fn().mockResolvedValue(options.createSignedUrlResult ?? {
    data: { signedUrl: 'https://storage.example/read/image.png' },
    error: null,
  });
  const createSignedUrlsMock = vi.fn().mockImplementation((paths: string[]) => Promise.resolve(
    options.createSignedUrlsResult ?? {
      data: paths.map((path) => ({
        error: null,
        path,
        signedUrl: `https://storage.example/read/${encodeURIComponent(path)}`,
      })),
      error: null,
    },
  ));
  const rpcMock = vi.fn().mockImplementation(async (
    functionName: string,
    args: Record<string, unknown>,
  ): Promise<RpcResult> => {
    const override = await options.rpcOverride?.(functionName, args);
    if (override) return override;

    if (functionName === 'enforce_edge_rate_limit') {
      return {
        data: { allowed: true, remaining: 99, retry_after_seconds: 0 },
        error: null,
      };
    }

    if (functionName === 'begin_media_upload_session') {
      return {
        data: [{
          content_type: args.p_content_type,
          destination_bucket: args.p_destination_bucket,
          destination_path: args.p_destination_path,
          expected_size_bytes: args.p_expected_size_bytes,
          initialization_id: args.p_initialization_id,
          session_id: args.p_session_id,
          session_status: 'pending',
          upload_bucket: 'place-media-private',
          upload_path: args.p_upload_path,
        }],
        error: null,
      };
    }

    if (functionName === 'can_read_private_place_media') {
      return { data: true, error: null };
    }

    if (functionName === 'can_read_private_place_media_batch') {
      const paths = Array.isArray(args.p_paths) ? args.p_paths : [];
      return {
        data: paths.map((path) => ({ allowed: true, path })),
        error: null,
      };
    }

    if (functionName === 'renew_media_upload_session_finalize') {
      return { data: true, error: null };
    }

    if (functionName === 'complete_media_upload_session_finalize') {
      return { data: true, error: null };
    }

    if (functionName === 'release_media_upload_session_finalize') {
      return { data: true, error: null };
    }

    if (functionName === 'renew_media_upload_session_cleanup') {
      return { data: true, error: null };
    }

    if (functionName === 'complete_media_upload_session_cleanup') {
      return { data: true, error: null };
    }

    return { data: null, error: { message: `Unexpected RPC: ${functionName}` } };
  });

  const handler = createMediaAssetsHandler({
    config: {
      allowedOrigins: ['http://localhost:5173'],
      supabasePublishableKey: options.config?.supabasePublishableKey ?? 'anon-key',
      supabaseServiceRoleKey: options.config?.supabaseServiceRoleKey ?? 'service-role',
      supabaseUrl: options.config?.supabaseUrl ?? 'https://example.supabase.co',
    },
    createAdminClient: () => ({
      from: () => ({
        delete: () => ({ lt: vi.fn().mockResolvedValue({ error: null }) }),
        insert: insertNonceMock,
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({
              data: { is_public: true, owner_id: 'other-user' },
              error: null,
            }),
          }),
        }),
      }),
      rpc: rpcMock,
      storage: {
        from: (bucketName: string) => ({
          copy: vi.fn().mockResolvedValue({ error: null }),
          createSignedUploadUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: 'https://storage.example/upload/image.png' },
            error: null,
          }),
          createSignedUrl: createSignedUrlMock,
          createSignedUrls: createSignedUrlsMock,
          getPublicUrl: (path: string) => ({
            data: {
              publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucketName}/${path}`,
            },
          }),
          info: infoMock,
          remove: removeMock,
          upload: vi.fn().mockResolvedValue({ error: null }),
        }),
      },
    }),
    createAuthClient: () => ({
      auth: {
        getUser: vi.fn().mockResolvedValue(options.userResult ?? {
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
    }),
    createRequestId: () => requestId,
    fetchObjectPrefix: vi.fn().mockResolvedValue(validPngBytes),
  });

  return { createSignedUrlMock, createSignedUrlsMock, handler, infoMock, removeMock, rpcMock };
}

let signatureSequence = 0;

async function signedRequest(body: string) {
  signatureSequence += 1;
  const deviceId = `error-device-${signatureSequence}`;
  const nonce = `error-nonce-1234-5678-${signatureSequence}`;
  const timestamp = Date.now().toString();
  const payloadHash = await sha256Hex(body);
  const signature = await createRequestSignature('token-1', {
    deviceId,
    functionName: 'media-assets',
    method: 'POST',
    nonce,
    payloadHash,
    timestamp,
  });

  return new Request('https://example.supabase.co/functions/v1/media-assets', {
    body,
    headers: {
      Authorization: 'Bearer token-1',
      'x-device-id': deviceId,
      'x-nonce': nonce,
      'x-signature': signature,
      'x-timestamp': timestamp,
    },
    method: 'POST',
  });
}

function createUploadUrlBody(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    action: 'create-upload-url',
    bucket: 'place-media-private',
    contentType: 'image/png',
    fileSizeBytes: 1024,
    prefix: 'list-1/place-1/image',
    uploadSessionId,
    ...overrides,
  });
}

function completeUploadBody(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    action: 'complete-upload',
    bucket: 'place-media-private',
    contentType: 'image/png',
    fileSizeBytes: 1024,
    mediaType: 'photo',
    objectPath: 'user-1/list-1/place-1/image.png',
    uploadSessionId,
    ...overrides,
  });
}

function cleanupDeleteBody(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    action: 'delete',
    bucket: 'place-media-private',
    paths: ['user-1/list-1/place-1/image.png'],
    uploadSessionId,
    ...overrides,
  });
}

describe('media-assets handler error paths', () => {
  it('fails closed when configuration is incomplete or the rate-limit RPC is unavailable', async () => {
    const misconfigured = createHarness({
      config: { supabaseServiceRoleKey: '' },
    });
    const misconfiguredResponse = await misconfigured.handler(await signedRequest('{}'));
    expect(misconfiguredResponse.status).toBe(500);
    await expect(misconfiguredResponse.json()).resolves.toMatchObject({ code: 'misconfigured' });

    const unavailableLimiter = createHarness({
      rpcOverride: (functionName) => functionName === 'enforce_edge_rate_limit'
        ? { data: null, error: { message: 'rate limiter unavailable' } }
        : undefined,
    });
    const body = JSON.stringify({
      action: 'create-read-url',
      bucket: 'place-media-private',
      path: 'other-user/list-1/place-1/image.png',
    });
    const limiterResponse = await unavailableLimiter.handler(await signedRequest(body));
    expect(limiterResponse.status).toBe(500);
    await expect(limiterResponse.json()).resolves.toMatchObject({ code: 'unexpected' });
  });

  it('rejects malformed or mismatched upload-session initialization records', async () => {
    const malformedSession = createHarness({
      rpcOverride: (functionName) => functionName === 'begin_media_upload_session'
        ? { data: [{}], error: null }
        : undefined,
    });
    const body = createUploadUrlBody();
    const malformedResponse = await malformedSession.handler(await signedRequest(body));
    expect(malformedResponse.status).toBe(500);
    await expect(malformedResponse.json()).resolves.toMatchObject({ code: 'upload_session_failed' });

    const mismatchedInitialization = createHarness({
      rpcOverride: (functionName, args) => functionName === 'begin_media_upload_session'
        ? {
            data: [{
              content_type: args.p_content_type,
              destination_bucket: args.p_destination_bucket,
              destination_path: args.p_destination_path,
              expected_size_bytes: args.p_expected_size_bytes,
              initialization_id: 'other-initialization',
              session_id: args.p_session_id,
              session_status: 'pending',
              upload_bucket: 'place-media-private',
              upload_path: args.p_upload_path,
            }],
            error: null,
          }
        : undefined,
    });
    const mismatchResponse = await mismatchedInitialization.handler(await signedRequest(body));
    expect(mismatchResponse.status).toBe(409);
    await expect(mismatchResponse.json()).resolves.toMatchObject({ code: 'upload_session_conflict' });
  });

  it('fails closed when private-media authorization or read-url signing fails', async () => {
    const authorizationFailure = createHarness({
      rpcOverride: (functionName) => functionName === 'can_read_private_place_media'
        ? { data: null, error: { message: 'authorization database unavailable' } }
        : undefined,
    });
    const body = JSON.stringify({
      action: 'create-read-url',
      bucket: 'place-media-private',
      path: 'other-user/list-1/place-1/image.png',
    });
    const authorizationResponse = await authorizationFailure.handler(await signedRequest(body));
    expect(authorizationResponse.status).toBe(500);
    await expect(authorizationResponse.json()).resolves.toMatchObject({ code: 'authorization_failed' });

    const signingFailure = createHarness({
      createSignedUrlResult: { data: null, error: { message: 'signing unavailable' } },
    });
    const signingResponse = await signingFailure.handler(await signedRequest(body));
    expect(signingResponse.status).toBe(500);
    await expect(signingResponse.json()).resolves.toMatchObject({ code: 'read_url_failed' });
  });

  it('fails closed when a batch read signer omits an authorized item', async () => {
    const batchFailure = createHarness({
      createSignedUrlsResult: {
        data: [{
          error: null,
          path: 'other-user/list-1/place-1/first.png',
          signedUrl: 'https://storage.example/read/first.png',
        }],
        error: null,
      },
    });
    const body = JSON.stringify({
      action: 'create-read-urls',
      bucket: 'place-media-private',
      paths: [
        'other-user/list-1/place-1/first.png',
        'other-user/list-1/place-1/second.png',
      ],
    });
    const response = await batchFailure.handler(await signedRequest(body));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ code: 'read_url_failed' });
  });

  it('rejects busy or lease-mismatched finalization claims before reading storage', async () => {
    const busyClaim = createHarness({
      rpcOverride: (functionName) => functionName === 'claim_media_upload_session_finalize'
        ? { data: [createPrivateSessionRow({ claim_status: 'busy', lease_id: null })], error: null }
        : undefined,
    });
    const body = completeUploadBody();
    const busyResponse = await busyClaim.handler(await signedRequest(body));
    expect(busyResponse.status).toBe(409);
    await expect(busyResponse.json()).resolves.toMatchObject({ code: 'upload_session_busy' });
    expect(busyClaim.infoMock).not.toHaveBeenCalled();

    const wrongLease = createHarness({
      rpcOverride: (functionName) => functionName === 'claim_media_upload_session_finalize'
        ? { data: [createPrivateSessionRow({ lease_id: 'other-lease' })], error: null }
        : undefined,
    });
    const leaseResponse = await wrongLease.handler(await signedRequest(body));
    expect(leaseResponse.status).toBe(500);
    await expect(leaseResponse.json()).resolves.toMatchObject({ code: 'upload_session_failed' });
    expect(wrongLease.infoMock).not.toHaveBeenCalled();
  });

  it('releases claimed finalization leases after missing storage and lease-renewal failures', async () => {
    const missingStorage = createHarness({
      infoResult: { data: null, error: { message: 'not found' } },
      rpcOverride: (functionName) => functionName === 'claim_media_upload_session_finalize'
        ? { data: [createPrivateSessionRow()], error: null }
        : undefined,
    });
    const body = completeUploadBody();
    const missingResponse = await missingStorage.handler(await signedRequest(body));
    expect(missingResponse.status).toBe(404);
    await expect(missingResponse.json()).resolves.toMatchObject({ code: 'not_found' });
    expect(missingStorage.rpcMock).toHaveBeenCalledWith(
      'release_media_upload_session_finalize',
      expect.objectContaining({ p_session_id: uploadSessionId }),
    );

    const expiredLease = createHarness({
      rpcOverride: (functionName) => {
        if (functionName === 'claim_media_upload_session_finalize') {
          return { data: [createPrivateSessionRow()], error: null };
        }
        if (functionName === 'renew_media_upload_session_finalize') {
          return { data: false, error: null };
        }
        return undefined;
      },
    });
    const expiredResponse = await expiredLease.handler(await signedRequest(body));
    expect(expiredResponse.status).toBe(409);
    await expect(expiredResponse.json()).resolves.toMatchObject({ code: 'upload_session_conflict' });
    expect(expiredLease.rpcMock).toHaveBeenCalledWith(
      'release_media_upload_session_finalize',
      expect.objectContaining({ p_session_id: uploadSessionId }),
    );
  });

  it('surfaces failed finalizer writes and public staging cleanup failures', async () => {
    const finalizeFailure = createHarness({
      rpcOverride: (functionName) => {
        if (functionName === 'claim_media_upload_session_finalize') {
          return { data: [createPrivateSessionRow()], error: null };
        }
        if (functionName === 'complete_media_upload_session_finalize') {
          return { data: false, error: null };
        }
        return undefined;
      },
    });
    const privateBody = completeUploadBody();
    const finalizeResponse = await finalizeFailure.handler(await signedRequest(privateBody));
    expect(finalizeResponse.status).toBe(409);
    await expect(finalizeResponse.json()).resolves.toMatchObject({ code: 'upload_session_conflict' });

    const publicOversize = createHarness({
      removeResult: { error: { message: 'staging cleanup unavailable' } },
      rpcOverride: (functionName) => functionName === 'claim_media_upload_session_finalize'
        ? {
            data: [createPrivateSessionRow({
              destination_bucket: 'profile-media',
              destination_path: 'user-1/profile/oversize.png',
              expected_size_bytes: 200_000_000,
              upload_path: 'user-1/pending-public/profile-media/profile/oversize.png',
            })],
            error: null,
          }
        : undefined,
    });
    const publicBody = completeUploadBody({
      bucket: 'profile-media',
      fileSizeBytes: 200_000_000,
      objectPath: 'user-1/pending-public/profile-media/profile/oversize.png',
    });
    const publicResponse = await publicOversize.handler(await signedRequest(publicBody));
    expect(publicResponse.status).toBe(500);
    await expect(publicResponse.json()).resolves.toMatchObject({ code: 'upload_finalize_failed' });
    expect(publicOversize.removeMock).toHaveBeenCalledWith([
      'user-1/pending-public/profile-media/profile/oversize.png',
    ]);
  });

  it('rejects unsafe cleanup claims and records storage cleanup failures', async () => {
    const busyCleanup = createHarness({
      rpcOverride: (functionName) => functionName === 'claim_media_upload_session_cleanup'
        ? { data: [createCleanupSessionRow({ claim_status: 'busy', lease_id: null })], error: null }
        : undefined,
    });
    const body = cleanupDeleteBody();
    const busyResponse = await busyCleanup.handler(await signedRequest(body));
    expect(busyResponse.status).toBe(409);
    await expect(busyResponse.json()).resolves.toMatchObject({ code: 'upload_session_busy' });

    const mismatchedCleanup = createHarness({
      rpcOverride: (functionName) => functionName === 'claim_media_upload_session_cleanup'
        ? { data: [createCleanupSessionRow()], error: null }
        : undefined,
    });
    const mismatchResponse = await mismatchedCleanup.handler(await signedRequest(
      cleanupDeleteBody({ paths: ['user-1/list-1/place-1/another.png'] }),
    ));
    expect(mismatchResponse.status).toBe(409);
    await expect(mismatchResponse.json()).resolves.toMatchObject({ code: 'upload_session_conflict' });

    const failedStorageCleanup = createHarness({
      removeResult: { error: { message: 'storage delete failed' } },
      rpcOverride: (functionName) => {
        if (functionName === 'claim_media_upload_session_cleanup') {
          return { data: [createCleanupSessionRow()], error: null };
        }
        if (functionName === 'check_media_upload_session_cleanup_reference') {
          return {
            data: [{
              delete_destination: true,
              destination_referenced: false,
              previous_status: 'pending',
            }],
            error: null,
          };
        }
        return undefined;
      },
    });
    const failureResponse = await failedStorageCleanup.handler(await signedRequest(body));
    expect(failureResponse.status).toBe(500);
    await expect(failureResponse.json()).resolves.toMatchObject({ code: 'delete_failed' });
    expect(failedStorageCleanup.rpcMock).toHaveBeenCalledWith(
      'complete_media_upload_session_cleanup',
      expect.objectContaining({ p_success: false }),
    );
  });
});
