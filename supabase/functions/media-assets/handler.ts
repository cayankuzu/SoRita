import { z } from 'zod';

import { createEdgeRequestContext, logEdgeEvent } from '../_shared/edgeLogger.ts';
import { verifySignedRequest } from '../_shared/requestSecurity.ts';
import {
  type AuthClientLike,
  type ErrorLike,
  corsPreflightResponse,
  getBearerToken,
  HttpRequestError,
  isHttpRequestError,
  jsonResponse,
  parseJsonBody,
} from '../_shared/httpHelpers.ts';
import { enforceRateLimit, rateLimitHeaders, type RateLimitAdminClientLike } from '../_shared/rateLimit.ts';

type SignedUploadUrlData = {
  path?: string;
  signedUrl: string;
  token?: string;
};

type NonceStoreLike = {
  delete: () => {
    lt: (column: string, value: string) => Promise<{ error?: ErrorLike | null }>;
  };
  insert: (payload: Record<string, unknown>) => Promise<{ error?: ErrorLike | null }>;
};

type StorageBucketLike = {
  createSignedUploadUrl: (path: string) => Promise<{
    data?: SignedUploadUrlData | null;
    error?: ErrorLike | null;
  }>;
  createSignedUrl: (path: string, expiresIn: number) => Promise<{
    data?: { signedUrl?: string | null } | null;
    error?: ErrorLike | null;
  }>;
  getPublicUrl: (path: string) => { data: { publicUrl: string } };
  remove: (paths: string[]) => Promise<{ error?: ErrorLike | null }>;
  upload: (
    path: string,
    bytes: Uint8Array,
    options: { contentType: string; upsert: boolean },
  ) => Promise<{ error?: ErrorLike | null }>;
};

type AdminClientLike = RateLimitAdminClientLike & {
  rpc?: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data?: unknown; error?: ErrorLike | null }>;
  from: (table: string) => NonceStoreLike & {
    select?: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{
          data?: { is_public?: boolean | null; owner_id?: string | null } | null;
          error?: ErrorLike | null;
        }>;
      };
    };
  };
  storage: {
    from: (bucket: string) => StorageBucketLike;
  };
};

export type MediaAssetsHandlerConfig = {
  allowedOrigins: string[];
  supabasePublishableKey: string;
  supabaseServiceRoleKey: string;
  supabaseUrl: string;
};

export type MediaAssetsHandlerDeps = {
  config: MediaAssetsHandlerConfig;
  createAdminClient: () => AdminClientLike;
  createAuthClient: (token: string) => AuthClientLike;
  createRequestId?: () => string;
};

const allowedBucketValues = ['profile-media', 'place-media', 'place-media-private'] as const;
const directUploadBucketValues = ['profile-media', 'place-media'] as const;
type AllowedBucket = (typeof allowedBucketValues)[number];
type DirectUploadBucket = (typeof directUploadBucketValues)[number];

const imageContentTypeValues = [
  'image/heic',
  'image/jpeg',
  'image/png',
  'image/webp',
];
const signedUploadContentTypeValues = [
  'image/heic',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/3gpp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
];
const allowedBuckets = new Set<string>(allowedBucketValues);
const directUploadBuckets = new Set<string>(directUploadBucketValues);
const imageContentTypes = new Set<string>(imageContentTypeValues);
const signedUploadContentTypes = new Set<string>(signedUploadContentTypeValues);
const profileImageUploadBytes = 5 * 1024 * 1024;
const bytesInMb = 1024 * 1024;
const placeMediaTargetVideoBitrate = 5_000_000;
const placeMediaAudioBitrateHeadroom = 192_000;
const placeMediaContainerHeadroomRatio = 1.15;
const placeMediaMaxVideoDurationSeconds = 60;
const placeMediaUploadSizeHeadroomSeconds = 5;
const placeMediaUploadBytes = Math.ceil(
  ((placeMediaTargetVideoBitrate + placeMediaAudioBitrateHeadroom) *
    (placeMediaMaxVideoDurationSeconds + placeMediaUploadSizeHeadroomSeconds) *
    placeMediaContainerHeadroomRatio) /
    8,
);
const placeMediaUploadMegabytes = Math.ceil(placeMediaUploadBytes / bytesInMb);
const maxDeleteRequestsPerMinute = 160;
// Worst-case place save:
// 6 media items * (file + optional thumbnail) * 1 target list = 12 requests.
// Keep enough retry headroom without allowing a single client to flood Storage URL creation.
const maxPlaceMediaCreateUploadRequestsPerMinute = 72;
const maxProfileMediaRequestsPerMinute = 120;
const maxPrivateReadUrlRequestsPerMinute = 600;
const maxDeletePathsPerRequest = 64;
const privateReadUrlExpiresInSeconds = 5 * 60;

const uploadPayloadSchema = z.object({
  action: z.literal('upload'),
  bucket: z.enum(directUploadBucketValues),
  contentType: z.enum(imageContentTypeValues),
  extension: z.string().trim().min(1).max(8).optional(),
  fileBase64: z.string().trim().min(1),
  prefix: z.string().trim().min(1).max(160),
});

const createUploadUrlPayloadSchema = z.object({
  action: z.literal('create-upload-url'),
  bucket: z.literal('place-media-private'),
  contentType: z.enum(signedUploadContentTypeValues),
  extension: z.string().trim().min(1).max(8).optional(),
  fileSizeBytes: z.number().int().positive(),
  prefix: z.string().trim().min(1).max(160),
});

const createReadUrlPayloadSchema = z.object({
  action: z.literal('create-read-url'),
  bucket: z.literal('place-media-private'),
  path: z.string().trim().min(1).max(512),
});

const deletePayloadSchema = z.object({
  action: z.literal('delete'),
  bucket: z.enum(allowedBucketValues),
  paths: z.array(z.string().trim().min(1).max(512)).max(maxDeletePathsPerRequest),
});

type MediaPayload =
  | z.infer<typeof uploadPayloadSchema>
  | z.infer<typeof createUploadUrlPayloadSchema>
  | z.infer<typeof createReadUrlPayloadSchema>
  | z.infer<typeof deletePayloadSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAllowedBucket(value: unknown): value is AllowedBucket {
  return typeof value === 'string' && allowedBuckets.has(value);
}

function isDirectUploadBucket(value: unknown): value is DirectUploadBucket {
  return typeof value === 'string' && directUploadBuckets.has(value);
}

function parseMediaPayload(bodyText: string): MediaPayload {
  const rawPayload = parseJsonBody(bodyText);

  if (!isRecord(rawPayload)) {
    throw new HttpRequestError(400, 'invalid_input', 'Invalid media request body');
  }

  const action = typeof rawPayload.action === 'string' ? rawPayload.action : null;

  if (action === 'upload') {
    if (!isDirectUploadBucket(rawPayload.bucket)) {
      throw new HttpRequestError(400, 'invalid_input', 'Invalid media bucket');
    }

    if (typeof rawPayload.contentType !== 'string' || !imageContentTypes.has(rawPayload.contentType)) {
      throw new HttpRequestError(415, 'unsupported_media_type', 'Unsupported media type');
    }

    if (typeof rawPayload.fileBase64 !== 'string' || !rawPayload.fileBase64.trim()) {
      throw new HttpRequestError(400, 'invalid_input', 'Missing media payload');
    }

    const parsedPayload = uploadPayloadSchema.safeParse(rawPayload);

    if (!parsedPayload.success) {
      throw new HttpRequestError(400, 'invalid_input', parsedPayload.error.issues[0]?.message ?? 'Invalid media request body');
    }

    return parsedPayload.data;
  }

  if (action === 'create-upload-url') {
    if (rawPayload.bucket !== 'place-media-private') {
      throw new HttpRequestError(400, 'invalid_input', 'Invalid media bucket');
    }

    if (typeof rawPayload.contentType !== 'string' || !signedUploadContentTypes.has(rawPayload.contentType)) {
      throw new HttpRequestError(415, 'unsupported_media_type', 'Unsupported media type');
    }

    const parsedPayload = createUploadUrlPayloadSchema.safeParse(rawPayload);

    if (!parsedPayload.success) {
      throw new HttpRequestError(400, 'invalid_input', parsedPayload.error.issues[0]?.message ?? 'Invalid media request body');
    }

    return parsedPayload.data;
  }

  if (action === 'create-read-url') {
    if (rawPayload.bucket !== 'place-media-private') {
      throw new HttpRequestError(400, 'invalid_input', 'Invalid media bucket');
    }

    const parsedPayload = createReadUrlPayloadSchema.safeParse(rawPayload);

    if (!parsedPayload.success) {
      throw new HttpRequestError(400, 'invalid_input', parsedPayload.error.issues[0]?.message ?? 'Invalid media request body');
    }

    return parsedPayload.data;
  }

  if (action === 'delete') {
    if (!isAllowedBucket(rawPayload.bucket)) {
      throw new HttpRequestError(400, 'invalid_input', 'Invalid media bucket');
    }

    if (!Array.isArray(rawPayload.paths)) {
      throw new HttpRequestError(400, 'invalid_input', 'Invalid storage paths');
    }

    if (rawPayload.paths.length > maxDeletePathsPerRequest) {
      throw new HttpRequestError(400, 'invalid_input', 'Too many storage paths');
    }

    const parsedPayload = deletePayloadSchema.safeParse(rawPayload);

    if (!parsedPayload.success) {
      throw new HttpRequestError(400, 'invalid_input', parsedPayload.error.issues[0]?.message ?? 'Invalid media request body');
    }

    return parsedPayload.data;
  }

  throw new HttpRequestError(400, 'invalid_input', 'Invalid media action');
}

function sanitizePrefix(value: string) {
  const prefix = value.trim().replace(/^\/+|\/+$/g, '');

  if (!/^[a-zA-Z0-9/_-]{1,160}$/.test(prefix) || prefix.includes('..')) {
    throw new HttpRequestError(400, 'invalid_input', 'Invalid upload prefix');
  }

  return prefix;
}

function normalizeExtension(value: string | undefined, contentType: string) {
  const requestedExtension = value?.trim().toLowerCase() ?? '';

  const normalizedExtension = requestedExtension || (() => {
    switch (contentType) {
      case 'image/heic':
        return 'heic';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'video/mp4':
        return 'mp4';
      case 'video/quicktime':
        return 'mov';
      case 'video/x-m4v':
        return 'm4v';
      case 'video/3gpp':
        return '3gp';
      case 'video/webm':
        return 'webm';
      case 'image/jpeg':
      default:
        return 'jpg';
    }
  })();

  const allowedExtensions = new Set(['3gp', 'heic', 'jpg', 'jpeg', 'm4v', 'mov', 'mp4', 'png', 'webm', 'webp']);

  if (!allowedExtensions.has(normalizedExtension)) {
    throw new HttpRequestError(400, 'invalid_input', 'Invalid media extension');
  }

  return normalizedExtension === 'jpeg' ? 'jpg' : normalizedExtension;
}

function getMaxUploadBytes(bucket: AllowedBucket, contentType: string) {
  if (bucket === 'profile-media') {
    return profileImageUploadBytes;
  }

  return placeMediaUploadBytes;
}

function getMediaRequestRateLimit(action: MediaPayload['action']) {
  if (action === 'delete') {
    return maxDeleteRequestsPerMinute;
  }

  if (action === 'create-upload-url') {
    return maxPlaceMediaCreateUploadRequestsPerMinute;
  }

  if (action === 'create-read-url') {
    return maxPrivateReadUrlRequestsPerMinute;
  }

  return maxProfileMediaRequestsPerMinute;
}

function formatRetryAfterMessage(retryAfterMs?: number) {
  const totalSeconds = Math.max(1, Math.ceil((retryAfterMs ?? 60_000) / 1000));

  if (totalSeconds < 60) {
    return `Medya istek sinirina ulasildi. Lutfen ${totalSeconds} saniye sonra tekrar deneyin.`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const secondsLabel = seconds > 0 ? ` ${seconds} saniye` : '';
  return `Medya istek sinirina ulasildi. Lutfen ${minutes} dakika${secondsLabel} sonra tekrar deneyin.`;
}

function decodeBase64Payload(base64Value: string, maxUploadBytes: number) {
  let binary: string;

  try {
    const normalized = base64Value.replace(/^data:[^;]+;base64,/, '');
    binary = atob(normalized);
  } catch {
    throw new HttpRequestError(400, 'invalid_input', 'Malformed media payload');
  }

  if (binary.length > maxUploadBytes) {
    throw new HttpRequestError(413, 'file_too_large', 'Media payload exceeds size limit');
  }

  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function matchesBytes(bytes: Uint8Array, expected: number[], offset = 0) {
  if (bytes.length < offset + expected.length) {
    return false;
  }

  return expected.every((value, index) => bytes[offset + index] === value);
}

function assertMediaSignature(contentType: string, bytes: Uint8Array) {
  if (contentType === 'image/png' && matchesBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return;
  }

  if (contentType === 'image/jpeg' && matchesBytes(bytes, [0xff, 0xd8, 0xff])) {
    return;
  }

  if (
    contentType === 'image/webp' &&
    matchesBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    matchesBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return;
  }

  if (
    contentType === 'image/heic' &&
    matchesBytes(bytes, [0x66, 0x74, 0x79, 0x70], 4) &&
    ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(
      String.fromCharCode(...bytes.slice(8, 12)),
    )
  ) {
    return;
  }

  throw new HttpRequestError(400, 'invalid_input', 'Media payload does not match content type');
}

function getOwnedPath(userId: string, value: string) {
  const normalized = value.trim().replace(/^\/+/, '');

  if (!normalized.startsWith(`${userId}/`) || normalized.includes('..')) {
    throw new HttpRequestError(400, 'invalid_input', 'Storage path is outside the authenticated user scope');
  }

  return normalized;
}

function sanitizeStoragePath(value: string) {
  const normalized = value.trim().replace(/^\/+/, '');

  if (!/^[a-zA-Z0-9/_.,-]{1,512}$/.test(normalized) || normalized.includes('..')) {
    throw new HttpRequestError(400, 'invalid_input', 'Invalid storage path');
  }

  return normalized;
}

function parsePrivateMediaAuthorizationResult(data: unknown) {
  if (data === true) {
    return true;
  }

  if (Array.isArray(data)) {
    return data.some((row) => parsePrivateMediaAuthorizationResult(row));
  }

  if (isRecord(data)) {
    return (
      data.can_read_private_place_media === true ||
      data.authorized === true ||
      data.allowed === true
    );
  }

  return false;
}

async function canReadPrivatePlaceMediaViaDatabase(
  adminClient: AdminClientLike,
  userId: string,
  bucket: 'place-media-private',
  path: string,
) {
  if (!adminClient.rpc) {
    return null;
  }

  const { data, error } = await adminClient.rpc('can_read_private_place_media', {
    p_bucket: bucket,
    p_path: path,
    p_viewer_id: userId,
  });

  if (error) {
    throw new HttpRequestError(500, 'authorization_failed', 'Media authorization failed.');
  }

  return parsePrivateMediaAuthorizationResult(data);
}

async function getAuthorizedPrivatePlaceMediaPath(
  adminClient: AdminClientLike,
  userId: string,
  value: string,
) {
  const normalized = sanitizeStoragePath(value);
  const [ownerId, listId] = normalized.split('/');

  if (!ownerId || !listId) {
    throw new HttpRequestError(400, 'invalid_input', 'Invalid storage path');
  }

  const databaseAuthorized = await canReadPrivatePlaceMediaViaDatabase(
    adminClient,
    userId,
    'place-media-private',
    normalized,
  );

  if (databaseAuthorized === true) {
    return normalized;
  }

  if (databaseAuthorized === false) {
    throw new HttpRequestError(403, 'forbidden', 'Media asset is not visible to this user.');
  }

  if (ownerId === userId) {
    return normalized;
  }

  const listQuery = adminClient.from('lists').select;

  if (!listQuery) {
    throw new HttpRequestError(500, 'misconfigured', 'Media authorization is unavailable.');
  }

  const { data: listRow, error } = await listQuery('owner_id, is_public')
    .eq('id', listId)
    .maybeSingle();

  if (error) {
    throw new HttpRequestError(500, 'authorization_failed', 'Media authorization failed.');
  }

  if (!listRow) {
    throw new HttpRequestError(404, 'not_found', 'Media asset was not found.');
  }

  if (listRow.owner_id === userId || listRow.is_public === true) {
    return normalized;
  }

  throw new HttpRequestError(403, 'forbidden', 'Media asset is not visible to this user.');
}

export function createMediaAssetsHandler({
  config,
  createAdminClient,
  createAuthClient,
  createRequestId = () => crypto.randomUUID(),
}: MediaAssetsHandlerDeps) {
  return async function handleMediaAssetsRequest(request: Request) {
    const requestContext = createEdgeRequestContext(request, 'media-assets');
    const { allowedOrigins, supabasePublishableKey, supabaseServiceRoleKey, supabaseUrl } = config;

    try {
      if (request.method === 'OPTIONS') {
        return corsPreflightResponse(request, allowedOrigins, requestContext.requestId);
      }

      if (request.method !== 'POST') {
        return jsonResponse(
          request,
          allowedOrigins,
          405,
          { code: 'method_not_allowed', error: 'Method not allowed' },
          { requestId: requestContext.requestId },
        );
      }

      if (!supabaseUrl || !supabasePublishableKey || !supabaseServiceRoleKey) {
        logEdgeEvent('error', 'Media assets function is missing configuration', requestContext);
        return jsonResponse(
          request,
          allowedOrigins,
          500,
          { code: 'misconfigured', error: 'Medya servisi su anda kullanilamiyor.' },
          { requestId: requestContext.requestId },
        );
      }

      const token = getBearerToken(request.headers.get('Authorization'));

      if (!token) {
        return jsonResponse(
          request,
          allowedOrigins,
          401,
          { code: 'missing_authorization', error: 'Missing authorization header' },
          { requestId: requestContext.requestId },
        );
      }

      const authClient = createAuthClient(token);
      const {
        data,
        error: claimsError,
      } = await authClient.auth.getClaims(token);
      const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null;

      if (claimsError || !userId) {
        return jsonResponse(
          request,
          allowedOrigins,
          401,
          { code: 'invalid_jwt', error: claimsError?.message ?? 'Invalid JWT' },
          { requestId: requestContext.requestId },
        );
      }

      const adminClient = createAdminClient();
      const securityResult = await verifySignedRequest({
        adminClient,
        functionName: 'media-assets',
        request,
        token,
        userId,
      });

      if (!securityResult.ok) {
        return jsonResponse(
          request,
          allowedOrigins,
          securityResult.status,
          {
            code: 'invalid_signature',
            error: securityResult.error,
          },
          { requestId: requestContext.requestId },
        );
      }

      const payload = parseMediaPayload(securityResult.bodyText ?? '');
      const rateLimitResult = await enforceRateLimit({
        adminClient,
        identifier: `${userId}:${request.headers.get('x-device-id') ?? 'unknown-device'}`,
        maxRequests: getMediaRequestRateLimit(payload.action),
        scope: `media:${payload.action}`,
        windowMs: 60_000,
      });

      if (!rateLimitResult.allowed) {
        logEdgeEvent('warn', 'Media assets rate limit exceeded', requestContext, {
          action: payload.action,
          userId,
        });
        return jsonResponse(
          request,
          allowedOrigins,
          429,
          {
            code: 'rate_limited',
            error: formatRetryAfterMessage(rateLimitResult.retryAfterMs),
            retryAfterSeconds: Math.max(1, Math.ceil((rateLimitResult.retryAfterMs ?? 60_000) / 1000)),
          },
          {
            extraHeaders: rateLimitHeaders(
              rateLimitResult,
              getMediaRequestRateLimit(payload.action),
            ),
            requestId: requestContext.requestId,
          },
        );
      }

      if (payload.action === 'upload') {
        const bytes = decodeBase64Payload(
          payload.fileBase64,
          getMaxUploadBytes(payload.bucket, payload.contentType),
        );
        assertMediaSignature(payload.contentType, bytes);
        const prefix = sanitizePrefix(payload.prefix);
        const extension = normalizeExtension(payload.extension, payload.contentType);
        const fileName = `${userId}/${prefix}-${createRequestId()}.${extension}`;
        const { error: uploadError } = await adminClient.storage
          .from(payload.bucket)
          .upload(fileName, bytes, {
            contentType: payload.contentType,
            upsert: false,
          });

        if (uploadError) {
          logEdgeEvent('error', 'Direct media upload failed', requestContext, {
            bucket: payload.bucket,
            message: uploadError.message,
          });
          return jsonResponse(
            request,
            allowedOrigins,
            500,
            { code: 'upload_failed', error: 'Medya yuklemesi tamamlanamadi.' },
            { requestId: requestContext.requestId },
          );
        }

        const { data: publicUrlData } = adminClient.storage.from(payload.bucket).getPublicUrl(fileName);
        return jsonResponse(
          request,
          allowedOrigins,
          200,
          { publicUrl: publicUrlData.publicUrl },
          {
            extraHeaders: rateLimitHeaders(
              rateLimitResult,
              getMediaRequestRateLimit(payload.action),
            ),
            requestId: requestContext.requestId,
          },
        );
      }

      if (payload.action === 'create-upload-url') {
        if (!signedUploadContentTypes.has(payload.contentType)) {
          return jsonResponse(
            request,
            allowedOrigins,
            415,
            { code: 'unsupported_media_type', error: 'Desteklenmeyen medya tipi.' },
            { requestId: requestContext.requestId },
          );
        }

        const maxUploadBytes = getMaxUploadBytes(payload.bucket, payload.contentType);

        if (payload.fileSizeBytes > maxUploadBytes) {
          return jsonResponse(
            request,
            allowedOrigins,
            413,
            {
              code: 'file_too_large',
              error: `Dosya boyutu limiti asildi. En fazla ${payload.bucket === 'place-media' ? placeMediaUploadMegabytes : Math.ceil(maxUploadBytes / bytesInMb)} MB destekleniyor.`,
            },
            { requestId: requestContext.requestId },
          );
        }

        const prefix = sanitizePrefix(payload.prefix);
        const extension = normalizeExtension(payload.extension, payload.contentType);
        const fileName = `${userId}/${prefix}-${createRequestId()}.${extension}`;
        const bucket = adminClient.storage.from(payload.bucket);
        const { data: signedUploadData, error: signedUploadError } = await bucket.createSignedUploadUrl(fileName);

        if (signedUploadError || !signedUploadData?.signedUrl) {
          logEdgeEvent('error', 'Signed upload URL creation failed', requestContext, {
            bucket: payload.bucket,
            message: signedUploadError?.message,
          });
          return jsonResponse(
            request,
            allowedOrigins,
            500,
            { code: 'upload_init_failed', error: 'Medya yuklemesi baslatilamadi.' },
            { requestId: requestContext.requestId },
          );
        }

        return jsonResponse(
          request,
          allowedOrigins,
          200,
          {
            objectPath: fileName,
            storageUri: `sorita-storage://${payload.bucket}/${fileName.split('/').map(encodeURIComponent).join('/')}`,
            signedUrl: signedUploadData.signedUrl,
          },
          {
            extraHeaders: rateLimitHeaders(
              rateLimitResult,
              getMediaRequestRateLimit(payload.action),
            ),
            requestId: requestContext.requestId,
          },
        );
      }

      if (payload.action === 'create-read-url') {
        const path = await getAuthorizedPrivatePlaceMediaPath(adminClient, userId, payload.path);
        const { data: signedReadData, error: signedReadError } = await adminClient.storage
          .from(payload.bucket)
          .createSignedUrl(path, privateReadUrlExpiresInSeconds);

        if (signedReadError || !signedReadData?.signedUrl) {
          logEdgeEvent('error', 'Signed read URL creation failed', requestContext, {
            bucket: payload.bucket,
            message: signedReadError?.message,
          });
          return jsonResponse(
            request,
            allowedOrigins,
            500,
            { code: 'read_url_failed', error: 'Medya erisimi baslatilamadi.' },
            { requestId: requestContext.requestId },
          );
        }

        return jsonResponse(
          request,
          allowedOrigins,
          200,
          {
            expiresInSeconds: privateReadUrlExpiresInSeconds,
            signedUrl: signedReadData.signedUrl,
          },
          {
            extraHeaders: rateLimitHeaders(
              rateLimitResult,
              getMediaRequestRateLimit(payload.action),
            ),
            requestId: requestContext.requestId,
          },
        );
      }

      const paths = Array.from(new Set(payload.paths.map((path) => getOwnedPath(userId, path))));

      if (paths.length === 0) {
        return jsonResponse(
          request,
          allowedOrigins,
          200,
          { success: true },
          {
            extraHeaders: rateLimitHeaders(
              rateLimitResult,
              getMediaRequestRateLimit(payload.action),
            ),
            requestId: requestContext.requestId,
          },
        );
      }

      const { error: removeError } = await adminClient.storage.from(payload.bucket).remove(paths);

      if (removeError) {
        logEdgeEvent('error', 'Media delete failed', requestContext, {
          bucket: payload.bucket,
          message: removeError.message,
        });
        return jsonResponse(
          request,
          allowedOrigins,
          500,
          { code: 'delete_failed', error: 'Medya silme islemi tamamlanamadi.' },
          { requestId: requestContext.requestId },
        );
      }

      return jsonResponse(
        request,
        allowedOrigins,
        200,
        { success: true },
        {
          extraHeaders: rateLimitHeaders(
            rateLimitResult,
            getMediaRequestRateLimit(payload.action),
          ),
          requestId: requestContext.requestId,
        },
      );
    } catch (error) {
      if (isHttpRequestError(error)) {
        return jsonResponse(
          request,
          allowedOrigins,
          error.status,
          { code: error.code, error: error.message },
          { requestId: requestContext.requestId },
        );
      }

      logEdgeEvent('error', 'Unhandled media-assets error', requestContext, {
        error: error instanceof Error ? error.message : 'Unknown media-assets error',
      });
      return jsonResponse(
        request,
        allowedOrigins,
        500,
        { code: 'unexpected', error: 'Medya istegi tamamlanamadi.' },
        { requestId: requestContext.requestId },
      );
    }
  };
}
