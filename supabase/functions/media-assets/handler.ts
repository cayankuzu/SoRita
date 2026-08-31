import { z } from 'zod';

import { createEdgeRequestContext, logEdgeEvent } from '../_shared/edgeLogger.ts';
import { verifyRequestEnvelope, verifySignedRequest } from '../_shared/requestSecurity.ts';
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
  copy: (
    fromPath: string,
    toPath: string,
    options?: { destinationBucket?: string },
  ) => Promise<{ error?: ErrorLike | null }>;
  createSignedUploadUrl: (path: string, options?: { upsert: boolean }) => Promise<{
    data?: SignedUploadUrlData | null;
    error?: ErrorLike | null;
  }>;
  createSignedUrl: (path: string, expiresIn: number) => Promise<{
    data?: { signedUrl?: string | null } | null;
    error?: ErrorLike | null;
  }>;
  createSignedUrls: (paths: string[], expiresIn: number) => Promise<{
    data?: Array<{
      error?: string | null;
      path?: string | null;
      signedUrl?: string | null;
    }> | null;
    error?: ErrorLike | null;
  }>;
  getPublicUrl: (path: string) => { data: { publicUrl: string } };
  info: (path: string) => Promise<{
    data?: {
      contentType?: string | null;
      metadata?: { mimetype?: string | null; size?: number | null } | null;
      size?: number | null;
    } | null;
    error?: ErrorLike | null;
  }>;
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
  fetchObjectPrefix?: (signedUrl: string, maxBytes: number, totalBytes?: number) => Promise<Uint8Array>;
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
const placeMediaMaxVideoDurationSeconds = 180;
const placeMediaVideoDurationToleranceSeconds = 3;
const placeMediaMaxAcceptedVideoDurationSeconds =
  placeMediaMaxVideoDurationSeconds + placeMediaVideoDurationToleranceSeconds;
const placeMediaUploadSizeHeadroomSeconds = 5;
const placeMediaUploadBytes = Math.ceil(
  ((placeMediaTargetVideoBitrate + placeMediaAudioBitrateHeadroom) *
    (placeMediaMaxAcceptedVideoDurationSeconds + placeMediaUploadSizeHeadroomSeconds) *
    placeMediaContainerHeadroomRatio) /
    8,
);
const maxDeleteRequestsPerMinute = 160;
// Worst-case place save:
// 6 media items * (file + optional thumbnail) * 3 target lists = 36 requests.
// Keep enough retry headroom without allowing a single client to flood Storage URL creation.
const maxPlaceMediaCreateUploadRequestsPerMinute = 72;
const maxProfileMediaRequestsPerMinute = 120;
const maxPrivateReadUrlRequestsPerMinute = 600;
const maxDeletePathsPerRequest = 64;
const maxReadPathsPerRequest = 64;
const immutableMediaCacheSeconds = '31536000';
const privateReadUrlExpiresInSeconds = 5 * 60;
const mediaSignatureProbeBytes = 512 * 1024;
const privateMediaBucket: AllowedBucket = 'place-media-private';
const publicUploadStagingSegment = 'pending-public';
const mediaRequestBodyMaxBytes = Math.ceil(profileImageUploadBytes * 4 / 3) + 64 * 1024;

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
  bucket: z.enum(allowedBucketValues),
  contentType: z.enum(signedUploadContentTypeValues),
  extension: z.string().trim().min(1).max(8).optional(),
  fileSizeBytes: z.number().int().positive(),
  prefix: z.string().trim().min(1).max(160),
  uploadSessionId: z.string().uuid(),
});

const createReadUrlPayloadSchema = z.object({
  action: z.literal('create-read-url'),
  bucket: z.literal('place-media-private'),
  path: z.string().trim().min(1).max(512),
});

const createReadUrlsPayloadSchema = z.object({
  action: z.literal('create-read-urls'),
  bucket: z.literal('place-media-private'),
  paths: z.array(z.string().trim().min(1).max(512)).min(1).max(maxReadPathsPerRequest),
});

const completeUploadPayloadSchema = z.object({
  action: z.literal('complete-upload'),
  bucket: z.enum(allowedBucketValues),
  contentType: z.enum(signedUploadContentTypeValues),
  durationSeconds: z
    .number()
    .nonnegative()
    .max(placeMediaMaxAcceptedVideoDurationSeconds)
    .optional(),
  fileSizeBytes: z.number().int().positive(),
  height: z.number().int().positive().max(8192).optional(),
  mediaType: z.enum(['photo', 'video']),
  objectPath: z.string().trim().min(1).max(512),
  uploadSessionId: z.string().uuid(),
  width: z.number().int().positive().max(8192).optional(),
});

const deletePayloadSchema = z.object({
  action: z.literal('delete'),
  bucket: z.enum(allowedBucketValues),
  paths: z.array(z.string().trim().min(1).max(512)).max(maxDeletePathsPerRequest),
  uploadSessionId: z.string().uuid().optional(),
});

type MediaPayload =
  | z.infer<typeof uploadPayloadSchema>
  | z.infer<typeof createUploadUrlPayloadSchema>
  | z.infer<typeof createReadUrlPayloadSchema>
  | z.infer<typeof createReadUrlsPayloadSchema>
  | z.infer<typeof completeUploadPayloadSchema>
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
    if (!isAllowedBucket(rawPayload.bucket)) {
      throw new HttpRequestError(400, 'invalid_input', 'Invalid media bucket');
    }

    if (typeof rawPayload.contentType !== 'string' || !signedUploadContentTypes.has(rawPayload.contentType)) {
      throw new HttpRequestError(415, 'unsupported_media_type', 'Unsupported media type');
    }

    if (rawPayload.bucket !== 'place-media-private' && !imageContentTypes.has(rawPayload.contentType)) {
      throw new HttpRequestError(415, 'unsupported_media_type', 'Public media uploads must be images');
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

  if (action === 'create-read-urls') {
    if (rawPayload.bucket !== 'place-media-private') {
      throw new HttpRequestError(400, 'invalid_input', 'Invalid media bucket');
    }

    const parsedPayload = createReadUrlsPayloadSchema.safeParse(rawPayload);

    if (!parsedPayload.success) {
      throw new HttpRequestError(400, 'invalid_input', parsedPayload.error.issues[0]?.message ?? 'Invalid media request body');
    }

    return parsedPayload.data;
  }

  if (action === 'complete-upload') {
    if (!isAllowedBucket(rawPayload.bucket)) {
      throw new HttpRequestError(400, 'invalid_input', 'Invalid media bucket');
    }

    if (typeof rawPayload.contentType !== 'string' || !signedUploadContentTypes.has(rawPayload.contentType)) {
      throw new HttpRequestError(415, 'unsupported_media_type', 'Unsupported media type');
    }

    if (
      rawPayload.bucket !== 'place-media-private'
      && (!imageContentTypes.has(rawPayload.contentType) || rawPayload.mediaType !== 'photo')
    ) {
      throw new HttpRequestError(415, 'unsupported_media_type', 'Public media uploads must be images');
    }

    const parsedPayload = completeUploadPayloadSchema.safeParse(rawPayload);

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

function getMaxUploadBytes(bucket: AllowedBucket, _contentType: string) {
  if (bucket === 'profile-media') {
    return profileImageUploadBytes;
  }

  return placeMediaUploadBytes;
}

function getMediaRequestRateLimit(action: MediaPayload['action']) {
  if (action === 'delete') {
    return maxDeleteRequestsPerMinute;
  }

  if (action === 'create-upload-url' || action === 'complete-upload') {
    return maxPlaceMediaCreateUploadRequestsPerMinute;
  }

  if (action === 'create-read-url' || action === 'create-read-urls') {
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

  if (
    ['video/3gpp', 'video/mp4', 'video/quicktime', 'video/x-m4v'].includes(contentType) &&
    matchesBytes(bytes, [0x66, 0x74, 0x79, 0x70], 4)
  ) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    const isExpectedBrand =
      (contentType === 'video/3gpp' && brand.startsWith('3g')) ||
      (contentType === 'video/quicktime' && brand === 'qt  ') ||
      (contentType === 'video/x-m4v' && ['M4V ', 'M4VH', 'M4VP'].includes(brand)) ||
      (contentType === 'video/mp4' && [
        'avc1',
        'dash',
        'iso2',
        'iso5',
        'iso6',
        'isom',
        'mp41',
        'mp42',
        'MSNV',
      ].includes(brand));

    if (isExpectedBrand) {
      return;
    }
  }

  if (contentType === 'video/webm' && matchesBytes(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
    return;
  }

  throw new HttpRequestError(400, 'invalid_input', 'Media payload does not match content type');
}

type ActualMediaMetadata = {
  durationSeconds?: number;
  height?: number;
  width?: number;
};

function readUint16(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] * 0x1000000 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function findBytes(bytes: Uint8Array, needle: number[], start = 0) {
  for (let offset = start; offset <= bytes.length - needle.length; offset += 1) {
    if (needle.every((value, index) => bytes[offset + index] === value)) {
      return offset;
    }
  }

  return -1;
}

function readJpegDimensions(bytes: Uint8Array): ActualMediaMetadata {
  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    const segmentLength = readUint16(bytes, offset + 2);

    if (segmentLength < 2 || offset + segmentLength + 2 > bytes.length) {
      break;
    }

    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        height: readUint16(bytes, offset + 5),
        width: readUint16(bytes, offset + 7),
      };
    }

    offset += segmentLength + 2;
  }

  return {};
}

function readWebpDimensions(bytes: Uint8Array): ActualMediaMetadata {
  const chunkType = String.fromCharCode(...bytes.slice(12, 16));

  if (chunkType === 'VP8X' && bytes.length >= 30) {
    return {
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
    };
  }

  if (chunkType === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  const frameHeader = findBytes(bytes, [0x9d, 0x01, 0x2a], 16);

  if (frameHeader >= 0 && frameHeader + 7 <= bytes.length) {
    return {
      width: (bytes[frameHeader + 3] | (bytes[frameHeader + 4] << 8)) & 0x3fff,
      height: (bytes[frameHeader + 5] | (bytes[frameHeader + 6] << 8)) & 0x3fff,
    };
  }

  return {};
}

function readIsoMediaMetadata(bytes: Uint8Array): ActualMediaMetadata {
  const mvhdOffset = findBytes(bytes, [0x6d, 0x76, 0x68, 0x64]);
  let durationSeconds: number | undefined;

  if (mvhdOffset >= 4 && mvhdOffset + 32 <= bytes.length) {
    const version = bytes[mvhdOffset + 4];
    const timescaleOffset = mvhdOffset + (version === 1 ? 24 : 16);
    const durationOffset = mvhdOffset + (version === 1 ? 28 : 20);
    const timescale = readUint32(bytes, timescaleOffset);

    if (timescale > 0) {
      const duration = version === 1
        ? readUint32(bytes, durationOffset + 4) + readUint32(bytes, durationOffset) * 0x100000000
        : readUint32(bytes, durationOffset);
      durationSeconds = duration / timescale;
    }
  }

  let tkhdOffset = findBytes(bytes, [0x74, 0x6b, 0x68, 0x64]);
  let width: number | undefined;
  let height: number | undefined;

  while (tkhdOffset >= 4) {
    const atomStart = tkhdOffset - 4;
    const atomSize = readUint32(bytes, atomStart);
    const atomEnd = atomStart + atomSize;

    if (atomSize >= 16 && atomEnd <= bytes.length) {
      const candidateWidth = readUint32(bytes, atomEnd - 8) / 65_536;
      const candidateHeight = readUint32(bytes, atomEnd - 4) / 65_536;

      if (candidateWidth > 0 && candidateHeight > 0) {
        width = Math.round(candidateWidth);
        height = Math.round(candidateHeight);
        break;
      }
    }

    tkhdOffset = findBytes(bytes, [0x74, 0x6b, 0x68, 0x64], tkhdOffset + 4);
  }

  return { durationSeconds, height, width };
}

function readEbmlElement(bytes: Uint8Array, id: number[]) {
  const idOffset = findBytes(bytes, id);

  if (idOffset < 0) {
    return null;
  }

  const sizeOffset = idOffset + id.length;
  const firstSizeByte = bytes[sizeOffset];
  let sizeLength = 1;
  let marker = 0x80;

  while (sizeLength <= 8 && (firstSizeByte & marker) === 0) {
    sizeLength += 1;
    marker >>= 1;
  }

  if (sizeLength > 8 || sizeOffset + sizeLength > bytes.length) {
    return null;
  }

  let size = firstSizeByte & (marker - 1);

  for (let index = 1; index < sizeLength; index += 1) {
    size = size * 256 + bytes[sizeOffset + index];
  }

  const dataOffset = sizeOffset + sizeLength;
  return dataOffset + size <= bytes.length
    ? bytes.slice(dataOffset, dataOffset + size)
    : null;
}

function readUnsignedBytes(bytes: Uint8Array | null) {
  if (!bytes || bytes.length === 0 || bytes.length > 8) {
    return undefined;
  }

  return bytes.reduce((value, byte) => value * 256 + byte, 0);
}

function readWebmMetadata(bytes: Uint8Array): ActualMediaMetadata {
  const width = readUnsignedBytes(readEbmlElement(bytes, [0xb0]));
  const height = readUnsignedBytes(readEbmlElement(bytes, [0xba]));
  const timecodeScale = readUnsignedBytes(readEbmlElement(bytes, [0x2a, 0xd7, 0xb1])) ?? 1_000_000;
  const durationBytes = readEbmlElement(bytes, [0x44, 0x89]);
  let durationSeconds: number | undefined;

  if (durationBytes?.length === 4 || durationBytes?.length === 8) {
    const view = new DataView(
      durationBytes.buffer,
      durationBytes.byteOffset,
      durationBytes.byteLength,
    );
    const duration = durationBytes.length === 4 ? view.getFloat32(0) : view.getFloat64(0);

    if (Number.isFinite(duration) && duration > 0) {
      durationSeconds = (duration * timecodeScale) / 1_000_000_000;
    }
  }

  return { durationSeconds, height, width };
}

function readActualMediaMetadata(contentType: string, bytes: Uint8Array): ActualMediaMetadata {
  if (contentType === 'image/png' && bytes.length >= 24) {
    return { width: readUint32(bytes, 16), height: readUint32(bytes, 20) };
  }

  if (contentType === 'image/jpeg') {
    return readJpegDimensions(bytes);
  }

  if (contentType === 'image/webp') {
    return readWebpDimensions(bytes);
  }

  if (contentType === 'image/heic') {
    const ispeOffset = findBytes(bytes, [0x69, 0x73, 0x70, 0x65]);
    return ispeOffset >= 0 && ispeOffset + 16 <= bytes.length
      ? { width: readUint32(bytes, ispeOffset + 8), height: readUint32(bytes, ispeOffset + 12) }
      : {};
  }

  return contentType === 'video/webm'
    ? readWebmMetadata(bytes)
    : readIsoMediaMetadata(bytes);
}

function assertActualMediaMetadata(
  payload: z.infer<typeof completeUploadPayloadSchema>,
  actual: ActualMediaMetadata,
) {
  if (!actual.width || !actual.height || actual.width > 8192 || actual.height > 8192) {
    throw new HttpRequestError(422, 'upload_verification_failed', 'Media dimensions could not be verified');
  }

  if (
    (payload.width != null && payload.width !== actual.width) ||
    (payload.height != null && payload.height !== actual.height)
  ) {
    throw new HttpRequestError(422, 'upload_verification_failed', 'Media dimensions do not match the uploaded file');
  }

  if (payload.mediaType === 'video') {
    if (
      !actual.durationSeconds ||
      actual.durationSeconds > placeMediaMaxAcceptedVideoDurationSeconds
    ) {
      throw new HttpRequestError(422, 'upload_verification_failed', 'Video duration could not be verified');
    }

    if (
      payload.durationSeconds == null ||
      Math.abs(payload.durationSeconds - actual.durationSeconds) > 1
    ) {
      throw new HttpRequestError(422, 'upload_verification_failed', 'Video duration does not match the uploaded file');
    }
  }
}

function assertMediaMetadata(payload: z.infer<typeof completeUploadPayloadSchema>) {
  const expectsVideo = payload.mediaType === 'video';

  if (expectsVideo !== payload.contentType.startsWith('video/')) {
    throw new HttpRequestError(400, 'invalid_input', 'Media type does not match content type');
  }

  if (expectsVideo && payload.durationSeconds == null) {
    throw new HttpRequestError(400, 'invalid_input', 'Video duration is required');
  }

  if ((payload.width == null) !== (payload.height == null)) {
    throw new HttpRequestError(400, 'invalid_input', 'Media dimensions must be provided together');
  }
}

async function fetchObjectPrefixWithRange(signedUrl: string, maxBytes: number, totalBytes?: number) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 8_000);

  try {
    const fetchRange = async (range: string) => {
      const response = await fetch(signedUrl, {
        headers: { Range: range },
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new HttpRequestError(422, 'upload_verification_failed', 'Uploaded media could not be verified');
      }

      return new Uint8Array(await response.arrayBuffer());
    };
    const prefix = await fetchRange(`bytes=0-${maxBytes - 1}`);

    if (!totalBytes || totalBytes <= maxBytes) {
      return prefix;
    }

    const suffixStart = Math.max(maxBytes, totalBytes - maxBytes);
    const suffix = await fetchRange(`bytes=${suffixStart}-${totalBytes - 1}`);
    const combined = new Uint8Array(prefix.length + suffix.length);
    combined.set(prefix, 0);
    combined.set(suffix, prefix.length);
    return combined;
  } catch (error) {
    if (isHttpRequestError(error)) {
      throw error;
    }

    throw new HttpRequestError(422, 'upload_verification_failed', 'Uploaded media could not be verified');
  } finally {
    clearTimeout(timeout);
  }
}

function getOwnedPath(userId: string, value: string) {
  const normalized = value.trim().replace(/^\/+/, '');

  if (!normalized.startsWith(`${userId}/`) || normalized.includes('..')) {
    throw new HttpRequestError(400, 'invalid_input', 'Storage path is outside the authenticated user scope');
  }

  return normalized;
}

function buildSignedUploadPaths(params: {
  bucket: AllowedBucket;
  extension: string;
  prefix: string;
  uploadSessionId: string;
  userId: string;
}) {
  const relativeFinalPath = `${params.prefix}-${params.uploadSessionId}.${params.extension}`;
  const destinationPath = `${params.userId}/${relativeFinalPath}`;

  if (params.bucket === privateMediaBucket) {
    return {
      destinationPath,
      uploadBucket: privateMediaBucket,
      uploadPath: destinationPath,
    };
  }

  return {
    destinationPath,
    uploadBucket: privateMediaBucket,
    uploadPath: `${params.userId}/${publicUploadStagingSegment}/${params.bucket}/${relativeFinalPath}`,
  };
}

type UploadSessionRecord = {
  claimStatus?: 'busy' | 'claimed' | 'finalized';
  cleanupAfter?: string;
  contentType: string;
  destinationBucket: AllowedBucket;
  destinationPath: string;
  expectedSizeBytes: number;
  initializationId?: string;
  leaseId?: string;
  sessionId?: string;
  sessionStatus?: string;
  uploadBucket: typeof privateMediaBucket;
  uploadPath: string;
};

function firstRpcRecord(data: unknown) {
  const value = Array.isArray(data) ? data[0] : data;
  return isRecord(value) ? value : null;
}

function parseUploadSessionRecord(data: unknown): UploadSessionRecord {
  const row = firstRpcRecord(data);
  const expectedSizeBytes = Number(row?.expected_size_bytes);
  const destinationBucket = row?.destination_bucket;

  if (
    !row
    || row.upload_bucket !== privateMediaBucket
    || !isAllowedBucket(destinationBucket)
    || typeof row.upload_path !== 'string'
    || typeof row.destination_path !== 'string'
    || typeof row.content_type !== 'string'
    || !Number.isSafeInteger(expectedSizeBytes)
    || expectedSizeBytes <= 0
  ) {
    throw new HttpRequestError(500, 'upload_session_failed', 'Medya yukleme oturumu dogrulanamadi.');
  }

  const claimStatus = row.claim_status;
  if (
    claimStatus !== undefined
    && claimStatus !== 'busy'
    && claimStatus !== 'claimed'
    && claimStatus !== 'finalized'
  ) {
    throw new HttpRequestError(500, 'upload_session_failed', 'Medya yukleme oturumu dogrulanamadi.');
  }

  return {
    claimStatus,
    cleanupAfter: typeof row.cleanup_after === 'string' ? row.cleanup_after : undefined,
    contentType: row.content_type,
    destinationBucket,
    destinationPath: row.destination_path,
    expectedSizeBytes,
    initializationId: typeof row.initialization_id === 'string' ? row.initialization_id : undefined,
    leaseId: typeof row.lease_id === 'string' ? row.lease_id : undefined,
    sessionId: typeof row.session_id === 'string' ? row.session_id : undefined,
    sessionStatus: typeof row.session_status === 'string' ? row.session_status : undefined,
    uploadBucket: privateMediaBucket,
    uploadPath: row.upload_path,
  };
}

function parseUploadCleanupRecord(data: unknown) {
  const row = firstRpcRecord(data);
  const destinationBucket = row?.destination_bucket;
  const claimStatus = row?.claim_status;

  if (
    !row
    || row.upload_bucket !== privateMediaBucket
    || !isAllowedBucket(destinationBucket)
    || typeof row.upload_path !== 'string'
    || typeof row.destination_path !== 'string'
    || (claimStatus !== 'busy' && claimStatus !== 'claimed' && claimStatus !== 'finalized')
  ) {
    throw new HttpRequestError(500, 'upload_session_failed', 'Medya yukleme oturumu dogrulanamadi.');
  }

  return {
    claimStatus,
    destinationBucket,
    destinationPath: row.destination_path,
    leaseId: typeof row.lease_id === 'string' ? row.lease_id : undefined,
    uploadBucket: privateMediaBucket,
    uploadPath: row.upload_path,
  };
}

async function callUploadSessionRpc(
  adminClient: AdminClientLike,
  functionName: string,
  args: Record<string, unknown>,
) {
  if (!adminClient.rpc) {
    throw new HttpRequestError(500, 'upload_session_failed', 'Medya yukleme oturumu kullanilamiyor.');
  }

  const result = await adminClient.rpc(functionName, args);
  if (result.error) {
    throw new HttpRequestError(409, 'upload_session_conflict', 'Medya yukleme oturumu kullanilamiyor.');
  }
  return result.data;
}

function assertUploadSessionMatchesPayload(
  session: UploadSessionRecord,
  payload: z.infer<typeof completeUploadPayloadSchema>,
  userId: string,
) {
  const expectedObjectPath = getOwnedPath(userId, payload.objectPath);
  if (
    session.destinationBucket !== payload.bucket
    || session.uploadPath !== expectedObjectPath
    || session.contentType !== payload.contentType
    || session.expectedSizeBytes !== payload.fileSizeBytes
  ) {
    throw new HttpRequestError(409, 'upload_session_conflict', 'Medya yukleme bilgileri oturumla eslesmiyor.');
  }
}

async function verifyStoredUpload(params: {
  bucket: StorageBucketLike;
  fetchObjectPrefix: NonNullable<MediaAssetsHandlerDeps['fetchObjectPrefix']>;
  maxUploadBytes: number;
  objectPath: string;
  payload: z.infer<typeof completeUploadPayloadSchema>;
  removeInvalid: boolean;
}) {
  const { data: objectInfo, error: objectInfoError } = await params.bucket.info(params.objectPath);

  if (objectInfoError || !objectInfo) {
    return false;
  }

  const actualSize = objectInfo.size ?? objectInfo.metadata?.size ?? null;
  const actualContentType = (
    objectInfo.contentType ?? objectInfo.metadata?.mimetype ?? ''
  ).split(';')[0]?.trim().toLowerCase();
  const rejectInvalidUpload = async (message: string) => {
    if (params.removeInvalid) {
      await params.bucket.remove([params.objectPath]).catch(() => undefined);
    }
    throw new HttpRequestError(422, 'upload_verification_failed', message);
  };

  if (
    actualSize == null
    || actualSize !== params.payload.fileSizeBytes
    || actualSize > params.maxUploadBytes
  ) {
    await rejectInvalidUpload('Uploaded media size could not be verified');
  }

  if (actualContentType !== params.payload.contentType) {
    await rejectInvalidUpload('Uploaded media content type could not be verified');
  }

  const { data: probeUrlData, error: probeUrlError } = await params.bucket.createSignedUrl(
    params.objectPath,
    60,
  );

  if (probeUrlError || !probeUrlData?.signedUrl) {
    throw new HttpRequestError(500, 'upload_verification_failed', 'Uploaded media could not be verified');
  }

  const signatureBytes = await params.fetchObjectPrefix(
    probeUrlData.signedUrl,
    mediaSignatureProbeBytes,
    actualSize,
  );

  try {
    assertMediaSignature(params.payload.contentType, signatureBytes);
    assertActualMediaMetadata(
      params.payload,
      readActualMediaMetadata(params.payload.contentType, signatureBytes),
    );
  } catch {
    await rejectInvalidUpload('Uploaded media content could not be verified');
  }

  return true;
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

async function getAuthorizedPrivatePlaceMediaPaths(
  adminClient: AdminClientLike,
  userId: string,
  paths: string[],
) {
  const normalizedPaths = paths.map(sanitizeStoragePath);

  if (adminClient.rpc) {
    const { data, error } = await adminClient.rpc('can_read_private_place_media_batch', {
      p_bucket: 'place-media-private',
      p_paths: normalizedPaths,
      p_viewer_id: userId,
    });

    if (!error && Array.isArray(data)) {
      const authorizationByPath = new Map<string, boolean>();

      data.forEach((row) => {
        if (isRecord(row) && typeof row.path === 'string') {
          authorizationByPath.set(row.path, row.allowed === true);
        }
      });

      if (
        normalizedPaths.every((path) => authorizationByPath.get(path) === true)
      ) {
        return normalizedPaths;
      }

      throw new HttpRequestError(403, 'forbidden', 'One or more media assets are not visible to this user.');
    }

    if (error && error.code !== '42883' && !error.message.includes('can_read_private_place_media_batch')) {
      throw new HttpRequestError(500, 'authorization_failed', 'Media authorization failed.');
    }
  }

  return Promise.all(
    normalizedPaths.map((path) =>
      getAuthorizedPrivatePlaceMediaPath(adminClient, userId, path)
    ),
  );
}

type CompleteUploadActionParams = {
  adminClient: AdminClientLike;
  allowedOrigins: string[];
  createRequestId: () => string;
  fetchObjectPrefix: NonNullable<MediaAssetsHandlerDeps['fetchObjectPrefix']>;
  payload: z.infer<typeof completeUploadPayloadSchema>;
  rateLimitResult: Awaited<ReturnType<typeof enforceRateLimit>>;
  request: Request;
  requestContext: ReturnType<typeof createEdgeRequestContext>;
  userId: string;
};

async function handleCompleteUploadAction({
  adminClient,
  allowedOrigins,
  createRequestId,
  fetchObjectPrefix,
  payload,
  rateLimitResult,
  request,
  requestContext,
  userId,
}: CompleteUploadActionParams) {
  assertMediaMetadata(payload);
  const maxUploadBytes = getMaxUploadBytes(payload.bucket, payload.contentType);
  const finalizeLeaseId = createRequestId();
  const session = parseUploadSessionRecord(await callUploadSessionRpc(
    adminClient,
    'claim_media_upload_session_finalize',
    {
      p_lease_id: finalizeLeaseId,
      p_lease_seconds: 300,
      p_session_id: payload.uploadSessionId,
      p_user_id: userId,
    },
  ));
  assertUploadSessionMatchesPayload(session, payload, userId);

  if (session.claimStatus === 'busy') {
    throw new HttpRequestError(409, 'upload_session_busy', 'Medya yukleme oturumu halen tamamlaniyor.');
  }
  if (
    session.claimStatus !== 'claimed'
    && session.claimStatus !== 'finalized'
  ) {
    throw new HttpRequestError(409, 'upload_session_conflict', 'Medya yukleme oturumu kullanilamiyor.');
  }
  if (session.claimStatus === 'claimed' && session.leaseId !== finalizeLeaseId) {
    throw new HttpRequestError(500, 'upload_session_failed', 'Medya yukleme oturumu dogrulanamadi.');
  }

  const isPublicDestination = session.destinationBucket !== privateMediaBucket;
  const paths = {
    destinationPath: getOwnedPath(userId, session.destinationPath),
    uploadPath: getOwnedPath(userId, session.uploadPath),
  };
  const uploadBucket = adminClient.storage.from(privateMediaBucket);
  const renewFinalizeLease = async () => {
    if (session.claimStatus !== 'claimed') {
      return;
    }
    const renewed = await callUploadSessionRpc(
      adminClient,
      'renew_media_upload_session_finalize',
      {
        p_lease_id: finalizeLeaseId,
        p_lease_seconds: 300,
        p_session_id: payload.uploadSessionId,
        p_user_id: userId,
      },
    );
    if (renewed !== true) {
      throw new HttpRequestError(409, 'upload_session_conflict', 'Medya yukleme oturumu zaman asimina ugradi.');
    }
  };

  const markFinalized = async () => {
    if (session.claimStatus !== 'claimed') {
      return;
    }
    await renewFinalizeLease();
    const marked = await callUploadSessionRpc(
      adminClient,
      'complete_media_upload_session_finalize',
      {
        p_lease_id: finalizeLeaseId,
        p_session_id: payload.uploadSessionId,
        p_user_id: userId,
      },
    );
    if (marked !== true) {
      throw new HttpRequestError(409, 'upload_session_conflict', 'Medya yukleme oturumu tamamlanamadi.');
    }
  };

  const responseOptions = {
    extraHeaders: rateLimitHeaders(
      rateLimitResult,
      getMediaRequestRateLimit(payload.action),
    ),
    requestId: requestContext.requestId,
  };

  try {
    if (payload.fileSizeBytes > maxUploadBytes) {
      const { error: stagingRemoveError } = await uploadBucket.remove([paths.uploadPath]);
      if (stagingRemoveError) {
        throw new HttpRequestError(
          500,
          'upload_finalize_failed',
          'Medya gecici alandan temizlenemedi.',
        );
      }
      throw new HttpRequestError(413, 'file_too_large', 'Media payload exceeds size limit');
    }

    if (!isPublicDestination) {
      const privateUploadExists = await verifyStoredUpload({
        bucket: uploadBucket,
        fetchObjectPrefix,
        maxUploadBytes,
        objectPath: paths.uploadPath,
        payload,
        removeInvalid: true,
      });

      if (!privateUploadExists) {
        throw new HttpRequestError(404, 'not_found', 'Uploaded media was not found');
      }

      await markFinalized();
      return jsonResponse(
        request,
        allowedOrigins,
        200,
        {
          objectPath: paths.destinationPath,
          storageUri: `sorita-storage://${privateMediaBucket}/${paths.destinationPath
            .split('/')
            .map(encodeURIComponent)
            .join('/')}`,
          uploadSessionId: payload.uploadSessionId,
          verified: true,
        },
        responseOptions,
      );
    }

    const destinationBucket = adminClient.storage.from(session.destinationBucket);
    const uploadExists = session.claimStatus === 'claimed'
      ? await verifyStoredUpload({
          bucket: uploadBucket,
          fetchObjectPrefix,
          maxUploadBytes,
          objectPath: paths.uploadPath,
          payload,
          removeInvalid: true,
        })
      : false;

    if (!uploadExists) {
      const alreadyFinalized = await verifyStoredUpload({
        bucket: destinationBucket,
        fetchObjectPrefix,
        maxUploadBytes,
        objectPath: paths.destinationPath,
        payload,
        removeInvalid: true,
      });

      if (!alreadyFinalized) {
        throw new HttpRequestError(404, 'not_found', 'Uploaded media was not found');
      }
    } else {
      await renewFinalizeLease();
      const { error: copyError } = await uploadBucket.copy(
        paths.uploadPath,
        paths.destinationPath,
        { destinationBucket: session.destinationBucket },
      );

      if (copyError) {
        const copyWasAlreadyFinalized = await verifyStoredUpload({
          bucket: destinationBucket,
          fetchObjectPrefix,
          maxUploadBytes,
          objectPath: paths.destinationPath,
          payload,
          removeInvalid: true,
        });

        if (!copyWasAlreadyFinalized) {
          logEdgeEvent('error', 'Verified public media copy failed', requestContext, {
            bucket: session.destinationBucket,
            message: copyError.message,
          });
          throw new HttpRequestError(500, 'upload_finalize_failed', 'Medya yuklemesi tamamlanamadi.');
        }
      } else {
        const destinationVerified = await verifyStoredUpload({
          bucket: destinationBucket,
          fetchObjectPrefix,
          maxUploadBytes,
          objectPath: paths.destinationPath,
          payload,
          removeInvalid: true,
        });

        if (!destinationVerified) {
          throw new HttpRequestError(500, 'upload_finalize_failed', 'Medya yuklemesi tamamlanamadi.');
        }
      }

      const { error: stagingRemoveError } = await uploadBucket.remove([paths.uploadPath]);
      if (stagingRemoveError) {
        throw new HttpRequestError(
          500,
          'upload_finalize_failed',
          'Medya gecici alandan temizlenemedi.',
        );
      }
    }

    await markFinalized();
    const { data: publicUrlData } = destinationBucket.getPublicUrl(paths.destinationPath);

    return jsonResponse(
      request,
      allowedOrigins,
      200,
      {
        objectPath: paths.destinationPath,
        publicUrl: publicUrlData.publicUrl,
        uploadSessionId: payload.uploadSessionId,
        verified: true,
      },
      responseOptions,
    );
  } catch (error) {
    if (session.claimStatus === 'claimed' && adminClient.rpc) {
      await adminClient.rpc('release_media_upload_session_finalize', {
        p_error: error instanceof Error ? error.message : 'upload finalize failed',
        p_lease_id: finalizeLeaseId,
        p_session_id: payload.uploadSessionId,
        p_user_id: userId,
      }).catch(() => undefined);
    }
    throw error;
  }
}

// Pure validation/parsing helpers are exported as one narrow surface so their
// security boundaries can be regression-tested without exercising storage.
export const mediaAssetsInternals = {
  assertActualMediaMetadata,
  assertMediaMetadata,
  assertMediaSignature,
  decodeBase64Payload,
  fetchObjectPrefixWithRange,
  formatRetryAfterMessage,
  getAuthorizedPrivatePlaceMediaPath,
  getAuthorizedPrivatePlaceMediaPaths,
  getMaxUploadBytes,
  getMediaRequestRateLimit,
  getOwnedPath,
  normalizeExtension,
  parseMediaPayload,
  parsePrivateMediaAuthorizationResult,
  readActualMediaMetadata,
  sanitizePrefix,
  sanitizeStoragePath,
};

export function createMediaAssetsHandler({
  config,
  createAdminClient,
  createAuthClient,
  createRequestId = () => crypto.randomUUID(),
  fetchObjectPrefix = fetchObjectPrefixWithRange,
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

      const adminClient = createAdminClient();
      const envelope = await verifyRequestEnvelope({
        adminClient,
        functionName: 'media-assets',
        maxBodyBytes: mediaRequestBodyMaxBytes,
        request,
      });

      if (!envelope.ok) {
        return jsonResponse(
          request,
          allowedOrigins,
          envelope.status,
          { code: 'invalid_signature', error: envelope.error },
          { requestId: requestContext.requestId },
        );
      }

      const authClient = createAuthClient(token);
      const {
        data,
        error: userError,
      } = await authClient.auth.getUser(token);
      const userId = typeof data?.user?.id === 'string' ? data.user.id : null;

      if (userError || !userId) {
        return jsonResponse(
          request,
          allowedOrigins,
          401,
          { code: 'invalid_jwt', error: userError?.message ?? 'Invalid JWT' },
          { requestId: requestContext.requestId },
        );
      }

      const securityResult = await verifySignedRequest({
        adminClient,
        bodyText: envelope.bodyText,
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
        identifier: userId,
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
            cacheControl: immutableMediaCacheSeconds,
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
              error: `Dosya boyutu limiti asildi. En fazla ${Math.ceil(maxUploadBytes / bytesInMb)} MB destekleniyor.`,
            },
            { requestId: requestContext.requestId },
          );
        }

        const prefix = sanitizePrefix(payload.prefix);
        const extension = normalizeExtension(payload.extension, payload.contentType);
        const paths = buildSignedUploadPaths({
          bucket: payload.bucket,
          extension,
          prefix,
          uploadSessionId: payload.uploadSessionId,
          userId,
        });
        const initializationId = createRequestId();
        const session = parseUploadSessionRecord(await callUploadSessionRpc(
          adminClient,
          'begin_media_upload_session',
          {
            p_content_type: payload.contentType,
            p_destination_bucket: payload.bucket,
            p_destination_path: paths.destinationPath,
            p_expected_size_bytes: payload.fileSizeBytes,
            p_initialization_id: initializationId,
            p_session_id: payload.uploadSessionId,
            p_upload_bucket: paths.uploadBucket,
            p_upload_path: paths.uploadPath,
            p_user_id: userId,
          },
        ));

        if (
          session.sessionId !== payload.uploadSessionId
          || session.sessionStatus !== 'pending'
          || session.initializationId !== initializationId
        ) {
          throw new HttpRequestError(409, 'upload_session_conflict', 'Medya yukleme oturumu kullanilamiyor.');
        }

        const bucket = adminClient.storage.from(paths.uploadBucket);
        const { data: signedUploadData, error: signedUploadError } =
          await bucket.createSignedUploadUrl(paths.uploadPath, { upsert: false });

        if (signedUploadError || !signedUploadData?.signedUrl) {
          // Do not cancel here. A reissued request can race an earlier caller
          // that already received a usable URL; cancelling the latest ledger
          // row would make that valid upload impossible to finalize. A pending
          // session is safely reclaimed after its signed-token horizon.
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
            objectPath: paths.uploadPath,
            signedUrl: signedUploadData.signedUrl,
            uploadSessionId: payload.uploadSessionId,
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

      if (payload.action === 'complete-upload') {
        return await handleCompleteUploadAction({
          adminClient,
          allowedOrigins,
          createRequestId,
          fetchObjectPrefix,
          payload,
          rateLimitResult,
          request,
          requestContext,
          userId,
        });
      }

      if (payload.action === 'create-read-urls') {
        const uniquePaths = Array.from(new Set(payload.paths));
        const authorizedPaths = await getAuthorizedPrivatePlaceMediaPaths(
          adminClient,
          userId,
          uniquePaths,
        );
        const { data: signedReadData, error: signedReadError } = await adminClient.storage
          .from(payload.bucket)
          .createSignedUrls(authorizedPaths, privateReadUrlExpiresInSeconds);

        if (
          signedReadError ||
          !signedReadData ||
          signedReadData.length !== authorizedPaths.length ||
          signedReadData.some((item) => item.error || !item.path || !item.signedUrl)
        ) {
          logEdgeEvent('error', 'Batch signed read URL creation failed', requestContext, {
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
            items: signedReadData.map((item) => ({
              path: item.path,
              signedUrl: item.signedUrl,
            })),
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

      if (payload.uploadSessionId) {
        const cleanupLeaseId = createRequestId();
        const session = parseUploadCleanupRecord(await callUploadSessionRpc(
          adminClient,
          'claim_media_upload_session_cleanup',
          {
            p_lease_id: cleanupLeaseId,
            p_lease_seconds: 300,
            p_session_id: payload.uploadSessionId,
            p_user_id: userId,
          },
        ));

        if (session.claimStatus === 'busy') {
          throw new HttpRequestError(409, 'upload_session_busy', 'Medya yukleme oturumu halen kullaniliyor.');
        }
        if (session.claimStatus === 'finalized') {
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
        if (session.claimStatus !== 'claimed' || session.leaseId !== cleanupLeaseId) {
          throw new HttpRequestError(409, 'upload_session_conflict', 'Medya yukleme oturumu temizlenemiyor.');
        }

        const requestedPaths = Array.from(new Set(
          payload.paths.map((path) => getOwnedPath(userId, path)),
        ));
        if (
          payload.bucket !== session.uploadBucket
          || requestedPaths.length !== 1
          || requestedPaths[0] !== session.uploadPath
        ) {
          throw new HttpRequestError(409, 'upload_session_conflict', 'Medya temizleme istegi oturumla eslesmiyor.');
        }

        const cleanupLeaseRenewed = await callUploadSessionRpc(
          adminClient,
          'renew_media_upload_session_cleanup',
          {
            p_lease_id: cleanupLeaseId,
            p_lease_seconds: 300,
            p_session_id: payload.uploadSessionId,
          },
        );
        if (cleanupLeaseRenewed !== true) {
          throw new HttpRequestError(409, 'upload_session_conflict', 'Medya temizleme oturumu zaman asimina ugradi.');
        }

        const cleanupDecision = firstRpcRecord(await callUploadSessionRpc(
          adminClient,
          'check_media_upload_session_cleanup_reference',
          {
            p_allow_unreferenced_destination_delete: true,
            p_lease_id: cleanupLeaseId,
            p_session_id: payload.uploadSessionId,
          },
        ));
        if (
          !cleanupDecision
          || typeof cleanupDecision.destination_referenced !== 'boolean'
          || typeof cleanupDecision.delete_destination !== 'boolean'
          || typeof cleanupDecision.previous_status !== 'string'
        ) {
          throw new HttpRequestError(500, 'upload_session_failed', 'Medya temizleme karari dogrulanamadi.');
        }

        let cleanupError: ErrorLike | null | undefined;
        const pathsAreIdentical =
          session.destinationBucket === session.uploadBucket
          && session.destinationPath === session.uploadPath;

        if (!pathsAreIdentical || cleanupDecision.delete_destination) {
          const uploadRemoval = await adminClient.storage
            .from(session.uploadBucket)
            .remove([session.uploadPath]);
          cleanupError = uploadRemoval.error;
        }

        if (
          !cleanupError
          && cleanupDecision.delete_destination
          && !pathsAreIdentical
        ) {
          const destinationRemoval = await adminClient.storage
            .from(session.destinationBucket)
            .remove([session.destinationPath]);
          cleanupError = destinationRemoval.error;
        }

        const cleanupRecorded = await callUploadSessionRpc(
          adminClient,
          'complete_media_upload_session_cleanup',
          {
            p_automatic:
              cleanupDecision.previous_status === 'finalized'
              && cleanupDecision.destination_referenced,
            p_destination_retained:
              cleanupDecision.previous_status === 'finalized'
              && cleanupDecision.destination_referenced,
            p_error: cleanupError?.message ?? null,
            p_lease_id: cleanupLeaseId,
            p_session_id: payload.uploadSessionId,
            p_success: !cleanupError,
          },
        );

        if (cleanupRecorded !== true || cleanupError) {
          throw new HttpRequestError(500, 'delete_failed', 'Medya silme islemi tamamlanamadi.');
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
