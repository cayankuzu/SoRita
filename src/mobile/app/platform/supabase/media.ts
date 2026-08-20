import * as FileSystem from 'expo-file-system/legacy';

import { trackEvent } from '@/mobile/app/platform/analytics/analyticsEvents';
import { env } from '@/mobile/app/platform/config/env';
import { getFunctionUrl } from '@/mobile/app/platform/api/edgeFunctions';
import { createSignedEdgeHeaders } from '@/mobile/app/platform/security/requestSigning';
import {
  PLACE_MEDIA_MAX_FILE_SIZE_BYTES,
  PLACE_MEDIA_MAX_FILE_SIZE_MB,
} from '@/mobile/app/platform/media/placeMediaSize';
import { supabase } from '@/mobile/app/platform/supabase/client';
import {
  getContentType,
  getFileExtension,
  readLocalMediaAsBase64,
  readLocalMediaSize,
} from '@/mobile/app/platform/supabase/localMediaFiles';
import { t } from '@/mobile/app/shared/i18n';
import {
  isAbortError,
  throwIfAborted,
  waitWithAbort,
} from '@/mobile/app/shared/utils/abort';

const PROFILE_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
const PLACE_MEDIA_MAX_BYTES = PLACE_MEDIA_MAX_FILE_SIZE_BYTES;
const IMMUTABLE_MEDIA_CACHE_CONTROL = 'max-age=31536000, immutable';

type PublicMediaBucket = 'profile-media' | 'place-media';
type PrivateMediaBucket = 'place-media-private';
export type MediaBucket = PublicMediaBucket | PrivateMediaBucket;
type StorageAssetRef = {
  bucket: MediaBucket;
  path: string;
};

const PRIVATE_PLACE_MEDIA_BUCKET: PrivateMediaBucket = 'place-media-private';
const STORAGE_ASSET_SCHEME = 'sorita-storage://';
const signedReadUrlCache = new Map<string, { expiresAt: number; signedUrl: string }>();
const signedReadUrlInFlight = new Map<string, Promise<string>>();
const pendingSignedReadRequests = new Map<
  string,
  {
    ref: StorageAssetRef;
    reject: (error: unknown) => void;
    resolve: (signedUrl: string) => void;
  }
>();
let signedReadBatchScheduled = false;
const SIGNED_READ_URL_CACHE_TTL_MS = 4 * 60 * 1000;
const SIGNED_READ_URL_BATCH_SIZE = 64;
const AUTH_SESSION_WAIT_TIMEOUT_MS = 5_000;
const AUTH_SESSION_POLL_INTERVAL_MS = 150;
const TRUSTED_MEDIA_HOSTS = new Set([
  'maps.googleapis.com',
  (() => {
    try {
      return new URL(env.supabaseUrl).hostname;
    } catch {
      return '';
    }
  })(),
].filter(Boolean));

export function isAllowedMediaUri(uri: string) {
  if (/^(asset|content|file|ph):\/\//i.test(uri)) {
    return true;
  }

  try {
    const parsed = new URL(uri);
    return parsed.protocol === 'https:' && TRUSTED_MEDIA_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function assertAllowedMediaUri(uri: string) {
  if (!isAllowedMediaUri(uri)) {
    throw new Error('Media URL host is not trusted.');
  }
}

function buildStorageAssetUri(bucket: MediaBucket, path: string) {
  return `${STORAGE_ASSET_SCHEME}${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export function isStorageAssetUri(value?: string | null) {
  return Boolean(value?.startsWith(STORAGE_ASSET_SCHEME));
}

function parseStorageAssetUri(value: string): StorageAssetRef | null {
  if (!isStorageAssetUri(value)) {
    return null;
  }

  try {
    const parsedUrl = new URL(value);
    const bucket = parsedUrl.hostname as MediaBucket;

    if (!['profile-media', 'place-media', PRIVATE_PLACE_MEDIA_BUCKET].includes(bucket)) {
      return null;
    }

    const path = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));

    if (!path || path.includes('..')) {
      return null;
    }

    return { bucket, path };
  } catch {
    return null;
  }
}

function getStorageAssetRef(
  fallbackBucket: MediaBucket,
  url?: string | null,
): StorageAssetRef | null {
  if (!url) {
    return null;
  }

  const storageAssetRef = parseStorageAssetUri(url);

  if (storageAssetRef) {
    return storageAssetRef;
  }

  try {
    const normalizedUrl = new URL(url);
    const pathMatch = normalizedUrl.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);

    if (!pathMatch) {
      return null;
    }

    const [, bucketName, encodedPath] = pathMatch;

    if (bucketName !== fallbackBucket) {
      return null;
    }

    return {
      bucket: fallbackBucket,
      path: decodeURIComponent(encodedPath),
    };
  } catch {
    return null;
  }
}

async function getAccessToken(signal?: AbortSignal) {
  const waitDeadline = Date.now() + AUTH_SESSION_WAIT_TIMEOUT_MS;

  while (true) {
    throwIfAborted(signal);

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw new Error(error.message);
    }

    if (session?.access_token) {
      return session.access_token;
    }

    const remainingWaitMs = waitDeadline - Date.now();

    if (remainingWaitMs <= 0) {
      throw new Error(t.settings.sessionMissing);
    }

    // Cached authenticated screens can render before the persisted Supabase
    // session has finished restoring. Wait briefly so private media does not
    // become a permanent fallback image during that startup window.
    await waitWithAbort(
      Math.min(AUTH_SESSION_POLL_INTERVAL_MS, remainingWaitMs),
      signal,
    );
  }
}

async function refreshAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.refreshSession();

  if (error) {
    throw new Error(error.message);
  }

  if (!session?.access_token) {
    throw new Error(t.system.sessionRefreshFailed);
  }

  return session.access_token;
}

async function readMediaFunctionError(response: Response) {
  const retryAfterHeaderValue = response.headers.get('Retry-After');
  const retryAfterSecondsFromHeader =
    retryAfterHeaderValue && Number.isFinite(Number(retryAfterHeaderValue))
      ? Number(retryAfterHeaderValue)
      : null;
  const responseText = await response.text().catch(() => '');
  const trimmedResponseText = responseText.trim();

  const buildRateLimitMessage = (retryAfterSeconds?: number | null) => {
    const totalSeconds = Math.max(1, Math.ceil(retryAfterSeconds || 60));
    const retryAt = new Date(Date.now() + totalSeconds * 1000);
    const retryAtLabel = retryAt.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    if (totalSeconds < 60) {
      return `Medya istek sinirina ulasildi. Lutfen ${totalSeconds} saniye sonra, ${retryAtLabel} itibariyla tekrar deneyin.`;
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const durationLabel = seconds > 0 ? `${minutes} dk ${seconds} sn` : `${minutes} dk`;
    return `Medya istek sinirina ulasildi. Lutfen ${durationLabel} sonra, ${retryAtLabel} itibariyla tekrar deneyin.`;
  };

  if (trimmedResponseText) {
    try {
      const payload = JSON.parse(trimmedResponseText);

      if (payload && typeof payload === 'object') {
        if (response.status === 429 && retryAfterSecondsFromHeader) {
          return buildRateLimitMessage(retryAfterSecondsFromHeader);
        }

        if (
          response.status === 429 &&
          'retryAfterSeconds' in payload &&
          typeof payload.retryAfterSeconds === 'number' &&
          payload.retryAfterSeconds > 0
        ) {
          return buildRateLimitMessage(payload.retryAfterSeconds);
        }

        if ('error' in payload && typeof payload.error === 'string' && payload.error.trim()) {
          return payload.error;
        }

        if ('message' in payload && typeof payload.message === 'string' && payload.message.trim()) {
          return payload.message;
        }
      }
    } catch {
      return trimmedResponseText;
    }
  }

  if (response.status === 429) {
    return buildRateLimitMessage(retryAfterSecondsFromHeader);
  }

  return response.statusText || `Media request failed (${response.status})`;
}

function readUploadResponseError(bodyText: string, fallbackMessage: string) {
  const trimmedBody = bodyText.trim();

  if (!trimmedBody) {
    return fallbackMessage;
  }

  try {
    const parsedBody = JSON.parse(trimmedBody);

    if (
      parsedBody &&
      typeof parsedBody === 'object' &&
      'error' in parsedBody &&
      typeof parsedBody.error === 'string' &&
      parsedBody.error.trim()
    ) {
      return parsedBody.error;
    }

    if (
      parsedBody &&
      typeof parsedBody === 'object' &&
      'message' in parsedBody &&
      typeof parsedBody.message === 'string' &&
      parsedBody.message.trim()
    ) {
      return parsedBody.message;
    }
  } catch {
    return trimmedBody;
  }

  return fallbackMessage;
}

function buildUploadSizeLimitMessage(bucket: 'profile-media' | 'place-media') {
  if (bucket === 'place-media') {
    return t.placeEditor.mediaSizeLimitPopupDescription(PLACE_MEDIA_MAX_FILE_SIZE_MB);
  }

  return `Media upload failed (${Math.ceil(PROFILE_MEDIA_MAX_BYTES / (1024 * 1024))} MB max)`;
}

function readStorageUploadError(params: {
  bodyText: string;
  bucket: 'profile-media' | 'place-media';
  fallbackMessage: string;
  status: number;
}) {
  const normalizedBodyText = params.bodyText.trim().toLowerCase();

  if (
    params.status === 413 ||
    normalizedBodyText.includes('payload too large') ||
    normalizedBodyText.includes('entity too large')
  ) {
    return buildUploadSizeLimitMessage(params.bucket);
  }

  return readUploadResponseError(params.bodyText, params.fallbackMessage);
}

async function performMediaFunctionRequest<TPayload extends Record<string, unknown>>(
  payload: TPayload,
  accessToken: string,
  signal?: AbortSignal,
  legacySignature = false,
) {
  const bodyText = JSON.stringify(payload);
  const signedHeaders = await createSignedEdgeHeaders({
    accessToken,
    bodyText,
    functionName: env.supabaseMediaAssetsFunctionName,
    ...(legacySignature ? { legacy: true } : {}),
    method: 'POST',
  });

  return fetch(getFunctionUrl(env.supabaseMediaAssetsFunctionName), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: env.supabasePublishableKey,
      'Content-Type': 'application/json',
      ...signedHeaders,
    },
    body: bodyText,
    signal,
  });
}

async function isInvalidSignatureResponse(response: Response) {
  if (response.status !== 401) {
    return false;
  }

  const responseText = await response.clone().text().catch(() => '');

  try {
    const payload = JSON.parse(responseText) as { code?: unknown; error?: unknown };
    return payload.code === 'invalid_signature'
      || (typeof payload.error === 'string' && payload.error.includes('signature verification'));
  } catch {
    return responseText.includes('signature verification');
  }
}

function isRetriableMediaStatus(status: number) {
  return status === 408 || status === 425 || status === 500 || status === 502 || status === 503 || status === 504;
}

const MAX_MEDIA_REQUEST_ATTEMPTS = 3;
const MAX_AUTO_RATE_LIMIT_RETRY_AFTER_SECONDS = 12;
const MAX_STORAGE_UPLOAD_ATTEMPTS = 3;
const MEDIA_RETRY_BASE_DELAY_MS = 500;

type MediaRequestSession = {
  accessToken: string;
};

async function readRetryAfterSeconds(response: Response) {
  const retryAfterHeaderValue = response.headers.get('Retry-After');
  const retryAfterSecondsFromHeader =
    retryAfterHeaderValue && Number.isFinite(Number(retryAfterHeaderValue))
      ? Number(retryAfterHeaderValue)
      : null;

  if (retryAfterSecondsFromHeader && retryAfterSecondsFromHeader > 0) {
    return retryAfterSecondsFromHeader;
  }

  try {
    const responseText = await response.clone().text();
    const trimmedResponseText = responseText.trim();

    if (!trimmedResponseText) {
      return null;
    }

    const payload = JSON.parse(trimmedResponseText);

    if (
      payload &&
      typeof payload === 'object' &&
      'retryAfterSeconds' in payload &&
      typeof payload.retryAfterSeconds === 'number' &&
      payload.retryAfterSeconds > 0
    ) {
      return payload.retryAfterSeconds;
    }
  } catch {
    return null;
  }

  return null;
}

async function callMediaFunction<TPayload extends Record<string, unknown>, TResult>(
  payload: TPayload,
  signal?: AbortSignal,
  requestSession?: MediaRequestSession,
): Promise<TResult> {
  let accessToken = requestSession?.accessToken ?? await getAccessToken(signal);
  let refreshedSessionAfterUnauthorized = false;
  let retriedWithLegacySignature = false;
  let useLegacySignature = false;

  for (let attempt = 0; attempt < MAX_MEDIA_REQUEST_ATTEMPTS; attempt += 1) {
    throwIfAborted(signal);
    let response: Response;

    try {
      response = await performMediaFunctionRequest(
        payload,
        accessToken,
        signal,
        useLegacySignature,
      );
    } catch (error) {
      if (
        isAbortError(error) ||
        signal?.aborted ||
        attempt >= MAX_MEDIA_REQUEST_ATTEMPTS - 1
      ) {
        throw error;
      }

      await waitWithAbort(MEDIA_RETRY_BASE_DELAY_MS * (attempt + 1), signal);
      continue;
    }

    if (response.ok) {
      return (await response.json()) as TResult;
    }

    if (!retriedWithLegacySignature && await isInvalidSignatureResponse(response)) {
      retriedWithLegacySignature = true;
      useLegacySignature = true;
      continue;
    }

    if (response.status === 401 && !refreshedSessionAfterUnauthorized) {
      accessToken = await refreshAccessToken();
      if (requestSession) {
        requestSession.accessToken = accessToken;
      }
      refreshedSessionAfterUnauthorized = true;
      continue;
    }

    if (response.status === 429 && attempt < MAX_MEDIA_REQUEST_ATTEMPTS - 1) {
      const retryAfterSeconds = await readRetryAfterSeconds(response);

      if (
        retryAfterSeconds &&
        retryAfterSeconds > 0 &&
        retryAfterSeconds <= MAX_AUTO_RATE_LIMIT_RETRY_AFTER_SECONDS
      ) {
        await waitWithAbort(retryAfterSeconds * 1000, signal);
        continue;
      }
    }

    if (isRetriableMediaStatus(response.status) && attempt < MAX_MEDIA_REQUEST_ATTEMPTS - 1) {
      await waitWithAbort(MEDIA_RETRY_BASE_DELAY_MS * (attempt + 1), signal);
      continue;
    }

    throw new Error(await readMediaFunctionError(response));
  }

  throw new Error('Media request failed');
}

export async function uploadImageAsset(params: {
  bucket: PublicMediaBucket;
  signal?: AbortSignal;
  userId: string;
  uri?: string;
  prefix: string;
}) {
  const { bucket, uri, prefix } = params;

  if (!uri) {
    return undefined;
  }

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    assertAllowedMediaUri(uri);
    return uri;
  }

  const extension = getFileExtension(uri);
  const contentType = getContentType(extension);
  const fileSizeBytes = await readLocalMediaSize(uri);
  const maxUploadBytes = bucket === 'place-media' ? PLACE_MEDIA_MAX_BYTES : PROFILE_MEDIA_MAX_BYTES;

  if (fileSizeBytes > maxUploadBytes) {
    throw new Error(buildUploadSizeLimitMessage(bucket));
  }

  throwIfAborted(params.signal);
  const base64File = await readLocalMediaAsBase64(uri);
  const result = await callMediaFunction<
    {
      action: 'upload';
      bucket: PublicMediaBucket;
      contentType: string;
      extension: string;
      fileBase64: string;
      prefix: string;
    },
    { publicUrl: string }
  >({
    action: 'upload',
    bucket,
    contentType,
    extension,
    fileBase64: base64File,
    prefix,
  }, params.signal);

  return result.publicUrl;
}

export type UploadPlaceMediaAssetParams = {
  durationMs?: number;
  extension?: string;
  height?: number;
  mediaType?: 'photo' | 'video';
  mimeType?: string;
  onProgress?: (progress: { sentBytes: number; totalBytes: number }) => void;
  onOrphanedUpload?: (storageUri: string) => Promise<void> | void;
  prefix: string;
  signal?: AbortSignal;
  uri?: string;
  userId?: string;
  width?: number;
};

function isRetriableStorageUploadStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || isRetriableMediaStatus(status);
}

async function uploadLocalFileToSignedUrl(params: {
  contentType: string;
  fileSizeBytes: number;
  onProgress?: UploadPlaceMediaAssetParams['onProgress'];
  signal?: AbortSignal;
  signedUrl: string;
  uri: string;
}) {
  for (let attempt = 0; attempt < MAX_STORAGE_UPLOAD_ATTEMPTS; attempt += 1) {
    throwIfAborted(params.signal);
    const uploadTask = FileSystem.createUploadTask(
      params.signedUrl,
      params.uri,
      {
        headers: {
          'cache-control': IMMUTABLE_MEDIA_CACHE_CONTROL,
          'content-type': params.contentType,
        },
        httpMethod: 'PUT',
        sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      },
      params.onProgress
        ? ({ totalBytesExpectedToSend, totalBytesSent }) => {
            params.onProgress?.({
              sentBytes: Math.max(0, totalBytesSent),
              totalBytes: Math.max(params.fileSizeBytes, totalBytesExpectedToSend),
            });
          }
        : undefined,
    );
    const abortHandler = () => {
      void uploadTask.cancelAsync().catch(() => undefined);
    };
    params.signal?.addEventListener('abort', abortHandler, { once: true });

    let uploadResult;

    try {
      uploadResult = await uploadTask.uploadAsync();
    } catch (error) {
      if (
        isAbortError(error) ||
        params.signal?.aborted ||
        attempt >= MAX_STORAGE_UPLOAD_ATTEMPTS - 1
      ) {
        throw error;
      }

      await waitWithAbort(MEDIA_RETRY_BASE_DELAY_MS * (attempt + 1), params.signal);
      continue;
    } finally {
      params.signal?.removeEventListener('abort', abortHandler);
    }

    if (!uploadResult) {
      throwIfAborted(params.signal);

      if (attempt >= MAX_STORAGE_UPLOAD_ATTEMPTS - 1) {
        throw new Error('Media upload was interrupted');
      }

      await waitWithAbort(MEDIA_RETRY_BASE_DELAY_MS * (attempt + 1), params.signal);
      continue;
    }

    if (uploadResult.status >= 200 && uploadResult.status < 300) {
      return uploadResult;
    }

    const uploadError = new Error(
      readStorageUploadError({
        bodyText: uploadResult.body,
        bucket: 'place-media',
        fallbackMessage: `Media upload failed (${uploadResult.status})`,
        status: uploadResult.status,
      }),
    );

    if (
      !isRetriableStorageUploadStatus(uploadResult.status) ||
      attempt >= MAX_STORAGE_UPLOAD_ATTEMPTS - 1
    ) {
      throw uploadError;
    }

    await waitWithAbort(MEDIA_RETRY_BASE_DELAY_MS * (attempt + 1), params.signal);
  }

  throw new Error('Media upload failed');
}

export async function uploadPlaceMediaAsset(params: UploadPlaceMediaAssetParams) {
  const { extension, mimeType, prefix, uri } = params;

  if (!uri) {
    return undefined;
  }

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    assertAllowedMediaUri(uri);
    return uri;
  }

  const resolvedExtension = extension || getFileExtension(uri);
  const contentType = mimeType || getContentType(resolvedExtension);
  const fileSizeBytes = await readLocalMediaSize(uri);

  if (fileSizeBytes > PLACE_MEDIA_MAX_BYTES) {
    throw new Error(buildUploadSizeLimitMessage('place-media'));
  }

  throwIfAborted(params.signal);
  const requestSession = { accessToken: await getAccessToken() };
  const data = await callMediaFunction<
    {
      action: 'create-upload-url';
      bucket: PrivateMediaBucket;
      contentType: string;
      extension: string;
      fileSizeBytes: number;
      prefix: string;
    },
    { objectPath: string; signedUrl: string; storageUri?: string }
  >({
    action: 'create-upload-url',
    contentType,
    extension: resolvedExtension,
    bucket: PRIVATE_PLACE_MEDIA_BUCKET,
    fileSizeBytes,
    prefix,
  }, params.signal, requestSession);
  const mediaType = params.mediaType ?? (contentType.startsWith('video/') ? 'video' : 'photo');
  let lastReportedProgressBucket = -1;
  let lastReportedProgressPercent = -1;
  trackEvent({ name: 'upload_started', params: { mediaType } });
  try {
    await uploadLocalFileToSignedUrl({
      contentType,
      fileSizeBytes,
      onProgress: ({ sentBytes, totalBytes }) => {
        const progressPercent = totalBytes > 0
          ? Math.min(100, Math.floor((sentBytes / totalBytes) * 100))
          : 0;

        if (progressPercent > lastReportedProgressPercent) {
          lastReportedProgressPercent = progressPercent;
          params.onProgress?.({ sentBytes, totalBytes });
        }
        const progressBucket = totalBytes > 0
          ? Math.min(4, Math.floor((sentBytes / totalBytes) * 4))
          : 0;

        if (progressBucket > lastReportedProgressBucket) {
          lastReportedProgressBucket = progressBucket;
          trackEvent({
            name: 'upload_progress_bucket',
            params: { bucket: progressBucket, mediaType },
          });
        }
      },
      signal: params.signal,
      signedUrl: data.signedUrl,
      uri,
    });
  } catch (error) {
    trackEvent({ name: 'upload_failed', params: { mediaType } });
    throw error;
  }

  try {
    const finalized = await callMediaFunction<
      {
        action: 'complete-upload';
        bucket: PrivateMediaBucket;
        contentType: string;
        durationSeconds?: number;
        fileSizeBytes: number;
        height?: number;
        mediaType: 'photo' | 'video';
        objectPath: string;
        width?: number;
      },
      { objectPath: string; storageUri?: string; verified: true }
    >({
      action: 'complete-upload',
      bucket: PRIVATE_PLACE_MEDIA_BUCKET,
      contentType,
      durationSeconds:
        params.mediaType === 'video' && typeof params.durationMs === 'number'
          ? params.durationMs / 1000
          : undefined,
      fileSizeBytes,
      height: params.height,
      mediaType,
      objectPath: data.objectPath,
      width: params.width,
    }, params.signal, requestSession);

    const storageUri = finalized.storageUri || buildStorageAssetUri(
      PRIVATE_PLACE_MEDIA_BUCKET,
      finalized.objectPath,
    );
    trackEvent({ name: 'upload_completed', params: { mediaType } });
    return storageUri;
  } catch (error) {
    trackEvent({ name: 'upload_failed', params: { mediaType } });
    const orphanedStorageUri = buildStorageAssetUri(PRIVATE_PLACE_MEDIA_BUCKET, data.objectPath);
    await callMediaFunction<
      { action: 'delete'; bucket: PrivateMediaBucket; paths: string[] },
      { success: true }
    >({
      action: 'delete',
      bucket: PRIVATE_PLACE_MEDIA_BUCKET,
      paths: [data.objectPath],
    }, undefined, requestSession).catch(async () => {
      await params.onOrphanedUpload?.(orphanedStorageUri);
    });
    throw error;
  }
}

export async function deleteStorageAssetsByUrls(params: {
  bucket: MediaBucket;
  urls: Array<string | null | undefined>;
}) {
  const refsByBucket = new Map<MediaBucket, Set<string>>();

  params.urls.forEach((url) => {
    const ref = getStorageAssetRef(params.bucket, url);

    if (!ref) {
      return;
    }

    const paths = refsByBucket.get(ref.bucket) ?? new Set<string>();
    paths.add(ref.path);
    refsByBucket.set(ref.bucket, paths);
  });

  if (!refsByBucket.size) {
    return;
  }

  for (const [bucket, pathSet] of refsByBucket.entries()) {
    const paths = Array.from(pathSet);

    if (!paths.length) {
      continue;
    }

    await callMediaFunction<
      {
        action: 'delete';
        bucket: MediaBucket;
        paths: string[];
      },
      { success: true }
    >({
      action: 'delete',
      bucket,
      paths,
    });
  }
}

function cacheSignedReadUrl(cacheKey: string, signedUrl: string, expiresInSeconds?: number) {
  const ttlMs = Math.max(60, expiresInSeconds ?? 300) * 1000;

  signedReadUrlCache.set(cacheKey, {
    expiresAt: Date.now() + Math.min(ttlMs, SIGNED_READ_URL_CACHE_TTL_MS),
    signedUrl,
  });
}

async function flushSignedReadUrlBatch() {
  signedReadBatchScheduled = false;
  const pendingEntries = Array.from(pendingSignedReadRequests.entries());
  pendingSignedReadRequests.clear();

  for (let offset = 0; offset < pendingEntries.length; offset += SIGNED_READ_URL_BATCH_SIZE) {
    const batch = pendingEntries.slice(offset, offset + SIGNED_READ_URL_BATCH_SIZE);

    try {
      const result = await callMediaFunction<
        {
          action: 'create-read-urls';
          bucket: PrivateMediaBucket;
          paths: string[];
        },
        {
          expiresInSeconds?: number;
          items: Array<{ path: string; signedUrl: string }>;
        }
      >({
        action: 'create-read-urls',
        bucket: PRIVATE_PLACE_MEDIA_BUCKET,
        paths: batch.map(([, entry]) => entry.ref.path),
      });
      const signedUrlsByPath = new Map(
        result.items.map((item) => [item.path, item.signedUrl]),
      );

      batch.forEach(([cacheKey, entry]) => {
        const signedUrl = signedUrlsByPath.get(entry.ref.path);

        if (!signedUrl) {
          entry.reject(new Error('Private media URL response was incomplete.'));
          return;
        }

        cacheSignedReadUrl(cacheKey, signedUrl, result.expiresInSeconds);
        entry.resolve(signedUrl);
      });
    } catch (error) {
      batch.forEach(([, entry]) => entry.reject(error));
    }
  }
}

function enqueueSignedReadUrl(ref: StorageAssetRef) {
  const cacheKey = `${ref.bucket}/${ref.path}`;
  const cached = signedReadUrlCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return Promise.resolve(cached.signedUrl);
  }

  const inFlight = signedReadUrlInFlight.get(cacheKey);

  if (inFlight) {
    return inFlight;
  }

  const request = new Promise<string>((resolve, reject) => {
    pendingSignedReadRequests.set(cacheKey, { ref, reject, resolve });

    if (!signedReadBatchScheduled) {
      signedReadBatchScheduled = true;
      void Promise.resolve().then(flushSignedReadUrlBatch);
    }
  }).finally(() => {
    signedReadUrlInFlight.delete(cacheKey);
  });

  signedReadUrlInFlight.set(cacheKey, request);
  return request;
}

export async function resolveStorageAssetUrl(uri?: string | null) {
  if (!uri) {
    return null;
  }

  const ref = parseStorageAssetUri(uri);

  if (!ref) {
    assertAllowedMediaUri(uri);
    return uri;
  }

  if (ref.bucket !== PRIVATE_PLACE_MEDIA_BUCKET) {
    return uri;
  }

  return enqueueSignedReadUrl(ref);
}

export function resolveStorageAssetUrls(uris: Array<string | null | undefined>) {
  return Promise.all(uris.map((uri) => resolveStorageAssetUrl(uri)));
}
