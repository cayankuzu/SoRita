import { describe, expect, it, vi } from 'vitest';

import { createRequestSignature, sha256Hex } from '../_shared/requestSecurity';
import { createMediaAssetsHandler, mediaAssetsInternals as media } from './handler';

const uploadSessionId = '11111111-1111-4111-8111-111111111111';
const coverageRequestId = 'coverage-request-id';
const validPngBytes = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAIAgMBgOnl9QAAAABJRU5ErkJggg==',
  'base64',
));
let signedRequestSequence = 0;

function ascii(value: string) {
  return Uint8Array.from([...value].map((character) => character.charCodeAt(0)));
}

function ftyp(brand: string) {
  const bytes = new Uint8Array(64);
  bytes.set(ascii('ftyp'), 4);
  bytes.set(ascii(brand), 8);
  return bytes;
}

function setUint32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function float64(value: number) {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, value);
  return bytes;
}

function completeUploadPayload(overrides: Record<string, unknown> = {}) {
  return {
    action: 'complete-upload',
    bucket: 'place-media-private',
    contentType: 'image/png',
    fileSizeBytes: 1,
    height: 20,
    mediaType: 'photo',
    objectPath: 'owner/list/image.png',
    uploadSessionId,
    width: 10,
    ...overrides,
  };
}

function fallbackAuthorizationClient(
  result: { data?: { is_public?: boolean; owner_id?: string } | null; error?: { message: string } | null },
) {
  return {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve(result),
        }),
      }),
    })),
  };
}

async function createSignedRequest(body: string) {
  signedRequestSequence += 1;
  const deviceId = `coverage-device-${signedRequestSequence}`;
  const nonce = `coverage-nonce-123456789-${signedRequestSequence}`;
  const timestamp = Date.now().toString();
  const signature = await createRequestSignature('coverage-token', {
    deviceId,
    functionName: 'media-assets',
    method: 'POST',
    nonce,
    payloadHash: await sha256Hex(body),
    timestamp,
  });

  return new Request('https://example.supabase.co/functions/v1/media-assets', {
    body,
    headers: {
      Authorization: 'Bearer coverage-token',
      'x-device-id': deviceId,
      'x-nonce': nonce,
      'x-signature': signature,
      'x-timestamp': timestamp,
    },
    method: 'POST',
  });
}

type HandlerHarnessOptions = {
  cleanupClaimStatus?: string;
  cleanupDecision?: unknown;
  cleanupDestinationBucket?: 'place-media' | 'place-media-private' | 'profile-media';
  cleanupDestinationPath?: string;
  cleanupLeaseId?: string | null;
  cleanupRecorded?: unknown;
  cleanupRenewed?: unknown;
  cleanupUploadPath?: string;
  finalizationClaimData?: unknown;
  finalizationClaimError?: { message: string } | null;
  finalizationClaimStatus?: string | null;
  finalizationCleanupAfter?: string;
  finalizationContentType?: string;
  finalizationDestinationPath?: string;
  finalizationExpectedSizeBytes?: number;
  finalizationLeaseId?: string | null;
  finalizationUploadPath?: string;
  infoResult?: unknown;
  signedUrlResult?: unknown;
  useDefaultFetchObjectPrefix?: boolean;
  useDefaultRequestId?: boolean;
};

function createHandlerHarness(options: HandlerHarnessOptions = {}) {
  const removeMock = vi.fn().mockResolvedValue({ error: null });
  const rpcMock = vi.fn(async (functionName: string) => {
    if (functionName === 'enforce_edge_rate_limit') {
      return {
        data: { allowed: true, remaining: 99, retry_after_seconds: 0 },
        error: null,
      };
    }

    if (functionName === 'claim_media_upload_session_finalize') {
      return {
        data: options.finalizationClaimData ?? [{
          claim_status: options.finalizationClaimStatus === null
            ? undefined
            : options.finalizationClaimStatus ?? 'claimed',
          cleanup_after: options.finalizationCleanupAfter,
          content_type: options.finalizationContentType ?? 'image/png',
          destination_bucket: 'place-media-private',
          destination_path: options.finalizationDestinationPath ?? 'user-1/list/image.png',
          expected_size_bytes: options.finalizationExpectedSizeBytes ?? 1024,
          lease_id: options.finalizationLeaseId ?? coverageRequestId,
          upload_bucket: 'place-media-private',
          upload_path: options.finalizationUploadPath ?? 'user-1/list/image.png',
        }],
        error: options.finalizationClaimError ?? null,
      };
    }

    if (functionName === 'renew_media_upload_session_finalize') {
      return { data: true, error: null };
    }

    if (functionName === 'complete_media_upload_session_finalize') {
      return { data: true, error: null };
    }

    if (functionName === 'claim_media_upload_session_cleanup') {
      return {
        data: [{
          claim_status: options.cleanupClaimStatus ?? 'claimed',
          destination_bucket: options.cleanupDestinationBucket ?? 'place-media-private',
          destination_path: options.cleanupDestinationPath ?? 'user-1/list/image.png',
          lease_id: options.cleanupLeaseId ?? coverageRequestId,
          upload_bucket: 'place-media-private',
          upload_path: options.cleanupUploadPath ?? 'user-1/list/image.png',
        }],
        error: null,
      };
    }

    if (functionName === 'renew_media_upload_session_cleanup') {
      return { data: options.cleanupRenewed ?? true, error: null };
    }

    if (functionName === 'check_media_upload_session_cleanup_reference') {
      return {
        data: options.cleanupDecision ?? [{
          delete_destination: false,
          destination_referenced: false,
          previous_status: 'pending',
        }],
        error: null,
      };
    }

    if (functionName === 'complete_media_upload_session_cleanup') {
      return { data: options.cleanupRecorded ?? true, error: null };
    }

    if (functionName === 'release_media_upload_session_finalize') {
      return { data: true, error: null };
    }

    if (functionName === 'can_read_private_place_media') {
      return { data: true, error: null };
    }

    if (functionName === 'can_read_private_place_media_batch') {
      return { data: [], error: null };
    }

    return { data: null, error: { message: `Unexpected RPC: ${functionName}` } };
  });

  const handlerArgs = {
    config: {
      allowedOrigins: ['http://localhost:5173'],
      supabasePublishableKey: 'publishable-key',
      supabaseServiceRoleKey: 'service-role-key',
      supabaseUrl: 'https://example.supabase.co',
    },
    createAdminClient: () => ({
      from: () => ({
        delete: () => ({ lt: vi.fn().mockResolvedValue({ error: null }) }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
      rpc: rpcMock,
      storage: {
        from: (bucket: string) => ({
          copy: vi.fn().mockResolvedValue({ error: null }),
          createSignedUploadUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: 'https://storage.example/upload' },
            error: null,
          }),
          createSignedUrl: vi.fn().mockResolvedValue(options.signedUrlResult ?? {
            data: { signedUrl: 'https://storage.example/read' },
            error: null,
          }),
          createSignedUrls: vi.fn().mockResolvedValue({ data: [], error: null }),
          getPublicUrl: (path: string) => ({ data: { publicUrl: `${bucket}/${path}` } }),
          info: vi.fn().mockResolvedValue(options.infoResult ?? {
            data: { contentType: 'image/png', size: 1024 },
            error: null,
          }),
          remove: removeMock,
          upload: vi.fn().mockResolvedValue({ error: null }),
        }),
      },
    }),
    createAuthClient: () => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
    }),
    ...(options.useDefaultFetchObjectPrefix
      ? {}
      : { fetchObjectPrefix: vi.fn().mockResolvedValue(validPngBytes) }),
    ...(options.useDefaultRequestId ? {} : { createRequestId: () => coverageRequestId }),
  };

  return {
    handler: createMediaAssetsHandler(handlerArgs as never),
    removeMock,
    rpcMock,
  };
}

function completeUploadBody() {
  return JSON.stringify({
    action: 'complete-upload',
    bucket: 'place-media-private',
    contentType: 'image/png',
    fileSizeBytes: 1024,
    mediaType: 'photo',
    objectPath: 'user-1/list/image.png',
    uploadSessionId,
  });
}

function cleanupDeleteBody(path = 'user-1/list/image.png') {
  return JSON.stringify({
    action: 'delete',
    bucket: 'place-media-private',
    paths: [path],
    uploadSessionId,
  });
}

describe('media-assets internals coverage regressions', () => {
  it('takes each action through schema validation after the security prechecks', () => {
    const invalidAfterPrecheck = [
      {
        action: 'upload',
        bucket: 'profile-media',
        contentType: 'image/png',
        fileBase64: 'eA==',
        prefix: 'x'.repeat(161),
      },
      {
        action: 'create-upload-url',
        bucket: 'place-media-private',
        contentType: 'image/png',
        fileSizeBytes: 1,
        prefix: 'owner/list',
        uploadSessionId: 'not-a-uuid',
      },
      {
        action: 'create-read-url',
        bucket: 'place-media-private',
        path: 'x'.repeat(513),
      },
      {
        action: 'create-read-urls',
        bucket: 'place-media-private',
        paths: Array.from({ length: 65 }, () => 'owner/list/image.png'),
      },
      completeUploadPayload({ width: 8193 }),
      {
        action: 'delete',
        bucket: 'place-media',
        paths: ['x'.repeat(513)],
      },
    ];

    for (const payload of invalidAfterPrecheck) {
      expect(() => media.parseMediaPayload(JSON.stringify(payload))).toThrow();
    }

    const invalidPrechecks = [
      {
        action: 'create-upload-url',
        bucket: 'unknown',
        contentType: 'image/png',
        fileSizeBytes: 1,
        prefix: 'owner/list',
        uploadSessionId,
      },
      {
        action: 'create-upload-url',
        bucket: 'place-media',
        contentType: 'video/mp4',
        fileSizeBytes: 1,
        prefix: 'owner/list',
        uploadSessionId,
      },
      completeUploadPayload({ bucket: 'unknown' }),
      completeUploadPayload({ bucket: 'place-media', contentType: 'video/mp4', mediaType: 'video' }),
      { action: 'delete', bucket: 'unknown', paths: [] },
      { action: 'delete', bucket: 'place-media', paths: 'owner/list/image.png' },
      { action: 'delete', bucket: 'place-media', paths: Array.from({ length: 65 }, () => 'path') },
    ];

    for (const payload of invalidPrechecks) {
      expect(() => media.parseMediaPayload(JSON.stringify(payload))).toThrow();
    }
  });

  it('covers uncommon allowed container brands and rejects an undeclared family', () => {
    for (const brand of ['heix', 'hevc', 'hevx', 'msf1']) {
      expect(() => media.assertMediaSignature('image/heic', ftyp(brand))).not.toThrow();
    }
    for (const brand of ['3g2a', '3gpp']) {
      expect(() => media.assertMediaSignature('video/3gpp', ftyp(brand))).not.toThrow();
    }
    expect(() => media.assertMediaSignature('video/x-m4v', ftyp('M4VP'))).not.toThrow();
    for (const brand of ['avc1', 'dash', 'iso2', 'iso5', 'iso6', 'mp41', 'MSNV']) {
      expect(() => media.assertMediaSignature('video/mp4', ftyp(brand))).not.toThrow();
    }
    expect(() => media.assertMediaSignature('image/gif', ftyp('isom'))).toThrow(
      'does not match',
    );
  });

  it('reads metadata through skipped JPEG segments, ISO v1 atoms, and malformed EBML safely', () => {
    const jpegWithAppSegment = Uint8Array.from([
      0xff, 0xd8,
      0xff, 0xe0, 0, 4, 0, 0,
      0xff, 0xc0, 0, 7, 8, 0x01, 0xe0, 0x02, 0x80, 0,
    ]);
    expect(media.readActualMediaMetadata('image/jpeg', jpegWithAppSegment)).toEqual({
      height: 480,
      width: 640,
    });

    const isoV1 = new Uint8Array(96);
    isoV1.set(ascii('mvhd'), 4);
    isoV1[8] = 1;
    setUint32(isoV1, 28, 1_000);
    setUint32(isoV1, 32, 0);
    setUint32(isoV1, 36, 5_000);
    setUint32(isoV1, 40, 20);
    isoV1.set(ascii('tkhd'), 44);
    setUint32(isoV1, 64, 28);
    isoV1.set(ascii('tkhd'), 68);
    setUint32(isoV1, 84, 640 * 65_536);
    setUint32(isoV1, 88, 480 * 65_536);
    expect(media.readActualMediaMetadata('video/mp4', isoV1)).toEqual({
      durationSeconds: 5,
      height: 480,
      width: 640,
    });
    expect(media.readActualMediaMetadata('video/mp4', new Uint8Array(5))).toEqual({
      durationSeconds: undefined,
      height: undefined,
      width: undefined,
    });

    const webmWithTwoByteVintAndMalformedHeight = Uint8Array.from([
      0xb0, 0x40, 0x02, 0x02, 0x80,
      0xba, 0,
      0x44, 0x89, 0x88, ...float64(3),
    ]);
    expect(media.readActualMediaMetadata('video/webm', webmWithTwoByteVintAndMalformedHeight)).toEqual({
      durationSeconds: 0.003,
      height: undefined,
      width: 640,
    });
  });

  it('does not infer metadata from truncated atoms, invalid EBML lengths, or zero duration', () => {
    const truncatedMovieHeader = new Uint8Array(20);
    truncatedMovieHeader.set(ascii('mvhd'), 10);
    expect(media.readActualMediaMetadata('video/mp4', truncatedMovieHeader)).toEqual({
      durationSeconds: undefined,
      height: undefined,
      width: undefined,
    });

    const zeroTimescaleMovie = new Uint8Array(40);
    zeroTimescaleMovie.set(ascii('mvhd'), 4);
    expect(media.readActualMediaMetadata('video/mp4', zeroTimescaleMovie)).toEqual({
      durationSeconds: undefined,
      height: undefined,
      width: undefined,
    });

    const undersizedTrackAtom = new Uint8Array(12);
    setUint32(undersizedTrackAtom, 0, 8);
    undersizedTrackAtom.set(ascii('tkhd'), 4);
    expect(media.readActualMediaMetadata('video/mp4', undersizedTrackAtom)).toEqual({
      durationSeconds: undefined,
      height: undefined,
      width: undefined,
    });

    const truncatedEbmlDuration = Uint8Array.from([0x44, 0x89, 0x84, 0, 0]);
    const zeroEbmlDuration = Uint8Array.from([0x44, 0x89, 0x84, 0, 0, 0, 0]);
    for (const bytes of [truncatedEbmlDuration, zeroEbmlDuration]) {
      expect(media.readActualMediaMetadata('video/webm', bytes)).toEqual({
        durationSeconds: undefined,
        height: undefined,
        width: undefined,
      });
    }
  });

  it('keeps direct private-media authorization fail-closed when fallback data is unavailable', async () => {
    await expect(media.getAuthorizedPrivatePlaceMediaPath(
      { from: () => ({}) } as never,
      'viewer',
      'owner/list/image.png',
    )).rejects.toThrow('unavailable');

    await expect(media.getAuthorizedPrivatePlaceMediaPath(
      fallbackAuthorizationClient({ data: null, error: { message: 'database unavailable' } }) as never,
      'viewer',
      'owner/list/image.png',
    )).rejects.toThrow('authorization failed');

    await expect(media.getAuthorizedPrivatePlaceMediaPath(
      fallbackAuthorizationClient({ data: null, error: null }) as never,
      'viewer',
      'owner/list/image.png',
    )).rejects.toThrow('not found');

    await expect(media.getAuthorizedPrivatePlaceMediaPath(
      fallbackAuthorizationClient({ data: { owner_id: 'viewer', is_public: false }, error: null }) as never,
      'viewer',
      'owner/list/image.png',
    )).resolves.toBe('owner/list/image.png');

    await expect(media.getAuthorizedPrivatePlaceMediaPath(
      fallbackAuthorizationClient({ data: { owner_id: 'owner', is_public: false }, error: null }) as never,
      'viewer',
      'owner/list/image.png',
    )).rejects.toThrow('not visible');

    await expect(media.getAuthorizedPrivatePlaceMediaPath(
      fallbackAuthorizationClient({ data: { owner_id: 'owner', is_public: true }, error: null }) as never,
      'viewer',
      'owner',
    )).rejects.toThrow('Invalid storage path');
  });

  it('normalizes nested authorization data and handles batch fallback and failures', async () => {
    expect(media.parsePrivateMediaAuthorizationResult([])).toBe(false);
    expect(media.parsePrivateMediaAuthorizationResult([
      { allowed: false },
      { authorized: false },
      { can_read_private_place_media: true },
    ])).toBe(true);
    expect(media.parsePrivateMediaAuthorizationResult({ allowed: 'true' })).toBe(false);

    const batchFallbackRpc = vi.fn(async (functionName: string) => {
      if (functionName === 'can_read_private_place_media_batch') {
        return { data: { unexpected: true }, error: null };
      }
      return { data: { authorized: true }, error: null };
    });
    await expect(media.getAuthorizedPrivatePlaceMediaPaths(
      { from: vi.fn(), rpc: batchFallbackRpc } as never,
      'viewer',
      ['owner/list/image.png'],
    )).resolves.toEqual(['owner/list/image.png']);

    const missingBatchRpc = vi.fn(async (functionName: string) => {
      if (functionName === 'can_read_private_place_media_batch') {
        return { data: null, error: { code: '42883', message: 'function does not exist' } };
      }
      return { data: true, error: null };
    });
    await expect(media.getAuthorizedPrivatePlaceMediaPaths(
      { from: vi.fn(), rpc: missingBatchRpc } as never,
      'viewer',
      ['owner/list/image.png'],
    )).resolves.toEqual(['owner/list/image.png']);

    await expect(media.getAuthorizedPrivatePlaceMediaPaths(
      {
        from: vi.fn(),
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'XX000', message: 'database unavailable' },
        }),
      } as never,
      'viewer',
      ['owner/list/image.png'],
    )).rejects.toThrow('authorization failed');

    await expect(media.getAuthorizedPrivatePlaceMediaPaths(
      { from: () => ({}) } as never,
      'viewer',
      ['owner/list/image.png', 'owner/list/second.png'],
    )).rejects.toThrow('unavailable');
  });

  it('covers default handler dependencies and a successful claimed finalization lease', async () => {
    const defaultDependencies = createHandlerHarness({
      useDefaultFetchObjectPrefix: true,
      useDefaultRequestId: true,
    });
    const methodResponse = await defaultDependencies.handler(new Request(
      'https://example.supabase.co/functions/v1/media-assets',
      { method: 'GET' },
    ));
    expect(methodResponse.status).toBe(405);

    const finalization = createHandlerHarness();
    const response = await finalization.handler(await createSignedRequest(completeUploadBody()));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ verified: true });
    expect(finalization.rpcMock).toHaveBeenCalledWith(
      'renew_media_upload_session_finalize',
      expect.objectContaining({ p_session_id: uploadSessionId }),
    );
    expect(finalization.rpcMock).toHaveBeenCalledWith(
      'complete_media_upload_session_finalize',
      expect.objectContaining({ p_session_id: uploadSessionId }),
    );
  });

  it('rejects incomplete finalization claims before touching media storage', async () => {
    const harness = createHandlerHarness({ finalizationClaimStatus: null });
    const response = await harness.handler(await createSignedRequest(completeUploadBody()));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'upload_session_conflict' });
  });

  it('fails closed for finalized, mismatched, expired, and malformed cleanup leases', async () => {
    const finalized = createHandlerHarness({ cleanupClaimStatus: 'finalized' });
    const finalizedResponse = await finalized.handler(await createSignedRequest(cleanupDeleteBody()));
    expect(finalizedResponse.status).toBe(200);
    expect(finalized.removeMock).not.toHaveBeenCalled();

    const mismatchedLease = createHandlerHarness({ cleanupLeaseId: 'different-lease' });
    const mismatchedResponse = await mismatchedLease.handler(await createSignedRequest(cleanupDeleteBody()));
    expect(mismatchedResponse.status).toBe(409);
    await expect(mismatchedResponse.json()).resolves.toMatchObject({ code: 'upload_session_conflict' });

    const expiredLease = createHandlerHarness({ cleanupRenewed: false });
    const expiredResponse = await expiredLease.handler(await createSignedRequest(cleanupDeleteBody()));
    expect(expiredResponse.status).toBe(409);
    await expect(expiredResponse.json()).resolves.toMatchObject({ code: 'upload_session_conflict' });

    const malformedDecision = createHandlerHarness({ cleanupDecision: [{}] });
    const malformedResponse = await malformedDecision.handler(await createSignedRequest(cleanupDeleteBody()));
    expect(malformedResponse.status).toBe(500);
    await expect(malformedResponse.json()).resolves.toMatchObject({ code: 'upload_session_failed' });

    const malformedClaim = createHandlerHarness({ cleanupClaimStatus: 'waiting' });
    const malformedClaimResponse = await malformedClaim.handler(await createSignedRequest(cleanupDeleteBody()));
    expect(malformedClaimResponse.status).toBe(500);
    await expect(malformedClaimResponse.json()).resolves.toMatchObject({ code: 'upload_session_failed' });
  });

  it('records both retained and copied-destination cleanup decisions safely', async () => {
    const retainedDestination = createHandlerHarness({
      cleanupDecision: [{
        delete_destination: false,
        destination_referenced: true,
        previous_status: 'finalized',
      }],
    });
    const retainedResponse = await retainedDestination.handler(await createSignedRequest(cleanupDeleteBody()));
    expect(retainedResponse.status).toBe(200);
    expect(retainedDestination.removeMock).not.toHaveBeenCalled();
    expect(retainedDestination.rpcMock).toHaveBeenCalledWith(
      'complete_media_upload_session_cleanup',
      expect.objectContaining({ p_automatic: true, p_destination_retained: true, p_success: true }),
    );

    const stagingPath = 'user-1/pending-public/place-media/image.png';
    const copiedDestination = createHandlerHarness({
      cleanupDecision: [{
        delete_destination: true,
        destination_referenced: false,
        previous_status: 'pending',
      }],
      cleanupDestinationBucket: 'place-media',
      cleanupDestinationPath: 'user-1/list/image.png',
      cleanupUploadPath: stagingPath,
    });
    const copiedResponse = await copiedDestination.handler(await createSignedRequest(cleanupDeleteBody(stagingPath)));
    expect(copiedResponse.status).toBe(200);
    expect(copiedDestination.removeMock).toHaveBeenCalledTimes(2);
    expect(copiedDestination.rpcMock).toHaveBeenCalledWith(
      'complete_media_upload_session_cleanup',
      expect.objectContaining({ p_automatic: false, p_destination_retained: false, p_success: true }),
    );
  });

  it('rejects malformed finalization records and verification failures without trusting storage', async () => {
    const emptyClaim = createHandlerHarness({ finalizationClaimData: [] });
    const emptyClaimResponse = await emptyClaim.handler(await createSignedRequest(completeUploadBody()));
    expect(emptyClaimResponse.status).toBe(500);
    await expect(emptyClaimResponse.json()).resolves.toMatchObject({ code: 'upload_session_failed' });

    const invalidStatus = createHandlerHarness({ finalizationClaimStatus: 'waiting' });
    const invalidStatusResponse = await invalidStatus.handler(await createSignedRequest(completeUploadBody()));
    expect(invalidStatusResponse.status).toBe(500);
    await expect(invalidStatusResponse.json()).resolves.toMatchObject({ code: 'upload_session_failed' });

    const rpcConflict = createHandlerHarness({
      finalizationClaimError: { message: 'claim unavailable' },
    });
    const rpcConflictResponse = await rpcConflict.handler(await createSignedRequest(completeUploadBody()));
    expect(rpcConflictResponse.status).toBe(409);
    await expect(rpcConflictResponse.json()).resolves.toMatchObject({ code: 'upload_session_conflict' });

    const mismatchedSession = createHandlerHarness({
      finalizationUploadPath: 'user-1/list/other-image.png',
    });
    const mismatchedResponse = await mismatchedSession.handler(await createSignedRequest(completeUploadBody()));
    expect(mismatchedResponse.status).toBe(409);
    await expect(mismatchedResponse.json()).resolves.toMatchObject({ code: 'upload_session_conflict' });

    const mismatchedContentType = createHandlerHarness({
      infoResult: {
        data: { contentType: 'image/jpeg', size: 1024 },
        error: null,
      },
    });
    const mismatchedContentResponse = await mismatchedContentType.handler(
      await createSignedRequest(completeUploadBody()),
    );
    expect(mismatchedContentResponse.status).toBe(422);
    await expect(mismatchedContentResponse.json()).resolves.toMatchObject({
      code: 'upload_verification_failed',
    });

    const unavailableProbeUrl = createHandlerHarness({
      signedUrlResult: { data: null, error: { message: 'signing unavailable' } },
    });
    const unavailableProbeResponse = await unavailableProbeUrl.handler(
      await createSignedRequest(completeUploadBody()),
    );
    expect(unavailableProbeResponse.status).toBe(500);
    await expect(unavailableProbeResponse.json()).resolves.toMatchObject({
      code: 'upload_verification_failed',
    });

    const directFinalizedRecord = createHandlerHarness({
      finalizationClaimData: {
        claim_status: 'finalized',
        cleanup_after: '2026-01-01T00:00:00.000Z',
        content_type: 'image/png',
        destination_bucket: 'place-media-private',
        destination_path: 'user-1/list/image.png',
        expected_size_bytes: 1024,
        lease_id: null,
        upload_bucket: 'place-media-private',
        upload_path: 'user-1/list/image.png',
      },
    });
    const directFinalizedResponse = await directFinalizedRecord.handler(
      await createSignedRequest(completeUploadBody()),
    );
    expect(directFinalizedResponse.status).toBe(200);
  });
});
