import * as FileSystem from 'expo-file-system/legacy';

import { trackEvent } from '@/mobile/app/platform/analytics/analyticsEvents';
import { env } from '@/mobile/app/platform/config/env';
import { getFunctionUrl } from '@/mobile/app/platform/api/edgeFunctions';
import { createSignedEdgeHeaders } from '@/mobile/app/platform/security/requestSigning';
import {
  PLACE_MEDIA_MAX_FILE_SIZE_BYTES,
} from '@/mobile/app/platform/media/placeMediaSize';
import { supabase } from '@/mobile/app/platform/supabase/client';
import {
  buildUploadSizeLimitMessage,
  readMediaFunctionError,
  readStorageUploadError,
} from '@/mobile/app/platform/supabase/mediaErrorMessages';
import { createPrivateSignedReadUrlManager } from '@/mobile/app/platform/supabase/privateSignedReadUrls';
import {
  assertAllowedMediaUri,
  buildStorageAssetUri,
  getStorageAssetRef,
  parseFinalizedPrivateUpload,
  parseFinalizedPublicUpload,
  parsePreparedUpload,
  parseStorageAssetUri,
  PRIVATE_PLACE_MEDIA_BUCKET,
} from '@/mobile/app/platform/supabase/mediaProtocol';
import type {
  MediaBucket,
  PrivateMediaBucket,
  PublicMediaBucket,
} from '@/mobile/app/platform/supabase/mediaProtocol';
import { refreshSupabaseSession } from '@/mobile/app/platform/supabase/sessionRefresh';
import { createUuid } from '@/shared/utils/id';
import {
  getContentType,
  getFileExtension,
  readLocalMediaSize,
} from '@/mobile/app/platform/supabase/localMediaFiles';
import { t } from '@/mobile/app/shared/i18n';
import {
  isAbortError,
  throwIfAborted,
  waitWithAbort,
} from '@/mobile/app/shared/utils/abort';

export {
  isAllowedMediaUri,
  isPublicPlaceMediaAsset,
  isStorageAssetUri,
} from '@/mobile/app/platform/supabase/mediaProtocol';
export type { MediaBucket } from '@/mobile/app/platform/supabase/mediaProtocol';

const PROFILE_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
const PLACE_MEDIA_MAX_BYTES = PLACE_MEDIA_MAX_FILE_SIZE_BYTES;
const IMMUTABLE_MEDIA_CACHE_CONTROL = 'max-age=31536000, immutable';

const AUTH_SESSION_WAIT_TIMEOUT_MS = 5_000;
const AUTH_SESSION_POLL_INTERVAL_MS = 150;
const PRIVATE_COVER_REHOME_DIRECTORY = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ''}private-cover-rehome/`;

async function getMediaRequestSession(signal?: AbortSignal, requireUser = false) {
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

    if (session?.access_token && (!requireUser || session.user?.id)) {
      return {
        accessToken: session.access_token,
        userId: session.user?.id,
      };
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

async function getAccessToken(signal?: AbortSignal) {
  return (await getMediaRequestSession(signal)).accessToken;
}

async function refreshAccessToken() {
  const {
    data: { session },
    error,
  } = await refreshSupabaseSession();

  if (error) {
    throw new Error(error.message);
  }

  if (!session?.access_token) {
    throw new Error(t.system.sessionRefreshFailed);
  }

  return session.access_token;
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
  userId?: string;
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
  const maxUploadBytes = PROFILE_MEDIA_MAX_BYTES;

  if (fileSizeBytes > maxUploadBytes) {
    throw new Error(buildUploadSizeLimitMessage(bucket, maxUploadBytes));
  }

  throwIfAborted(params.signal);
  const authenticatedSession = await getMediaRequestSession(params.signal, true);

  if (authenticatedSession.userId !== params.userId) {
    throw new Error('Media session identity mismatch.');
  }

  const requestSession = { accessToken: authenticatedSession.accessToken };
  const uploadSessionId = createUuid();
  const prepared = parsePreparedUpload(await callMediaFunction<
    {
      action: 'create-upload-url';
      bucket: PublicMediaBucket;
      contentType: string;
      extension: string;
      fileSizeBytes: number;
      prefix: string;
      uploadSessionId: string;
    },
    unknown
  >({
    action: 'create-upload-url',
    bucket,
    contentType,
    extension,
    fileSizeBytes,
    prefix,
    uploadSessionId,
  }, params.signal, requestSession), params.userId, uploadSessionId);

  try {
    await uploadLocalFileToSignedUrl({
      contentType,
      fileSizeBytes,
      maxUploadBytes,
      signal: params.signal,
      signedUrl: prepared.signedUrl,
      uri,
    });

    const finalized = parseFinalizedPublicUpload(await callMediaFunction<
      {
        action: 'complete-upload';
        bucket: PublicMediaBucket;
        contentType: string;
        fileSizeBytes: number;
        mediaType: 'photo';
        objectPath: string;
        uploadSessionId: string;
      },
      unknown
    >({
      action: 'complete-upload',
      bucket,
      contentType,
      fileSizeBytes,
      mediaType: 'photo',
      objectPath: prepared.objectPath,
      uploadSessionId,
    }, params.signal, requestSession), bucket, params.userId);

    return finalized.publicUrl;
  } catch (error) {
    await callMediaFunction<
      {
        action: 'delete';
        bucket: PrivateMediaBucket;
        paths: string[];
        uploadSessionId: string;
      },
      { success: true }
    >({
      action: 'delete',
      bucket: PRIVATE_PLACE_MEDIA_BUCKET,
      paths: [prepared.objectPath],
      uploadSessionId,
    }, undefined, requestSession).catch(() => undefined);
    throw error;
  }
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
  maxUploadBytes: number;
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
        maxUploadBytes: params.maxUploadBytes,
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
  const authenticatedSession = await getMediaRequestSession(params.signal, true);

  if (params.userId && authenticatedSession.userId !== params.userId) {
    throw new Error('Media session identity mismatch.');
  }

  const authenticatedUserId = authenticatedSession.userId as string;
  const requestSession = { accessToken: authenticatedSession.accessToken };
  const uploadSessionId = createUuid();
  const data = parsePreparedUpload(await callMediaFunction<
    {
      action: 'create-upload-url';
      bucket: PrivateMediaBucket;
      contentType: string;
      extension: string;
      fileSizeBytes: number;
      prefix: string;
      uploadSessionId: string;
    },
    unknown
  >({
    action: 'create-upload-url',
    contentType,
    extension: resolvedExtension,
    bucket: PRIVATE_PLACE_MEDIA_BUCKET,
    fileSizeBytes,
    prefix,
    uploadSessionId,
  }, params.signal, requestSession), authenticatedUserId, uploadSessionId);
  const mediaType = params.mediaType ?? (contentType.startsWith('video/') ? 'video' : 'photo');
  let lastReportedProgressBucket = -1;
  let lastReportedProgressPercent = -1;
  trackEvent({ name: 'upload_started', params: { mediaType } });
  try {
    await uploadLocalFileToSignedUrl({
      contentType,
      fileSizeBytes,
      maxUploadBytes: PLACE_MEDIA_MAX_BYTES,
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
    const orphanedStorageUri = buildStorageAssetUri(PRIVATE_PLACE_MEDIA_BUCKET, data.objectPath);
    await callMediaFunction<
      {
        action: 'delete';
        bucket: PrivateMediaBucket;
        paths: string[];
        uploadSessionId: string;
      },
      { success: true }
    >({
      action: 'delete',
      bucket: PRIVATE_PLACE_MEDIA_BUCKET,
      paths: [data.objectPath],
      uploadSessionId,
    }, undefined, requestSession).catch(async () => {
      await params.onOrphanedUpload?.(orphanedStorageUri);
    });
    throw error;
  }

  try {
    const finalized = parseFinalizedPrivateUpload(await callMediaFunction<
      {
        action: 'complete-upload';
        bucket: PrivateMediaBucket;
        contentType: string;
        durationSeconds?: number;
        fileSizeBytes: number;
        height?: number;
        mediaType: 'photo' | 'video';
        objectPath: string;
        uploadSessionId: string;
        width?: number;
      },
      unknown
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
      uploadSessionId,
      width: params.width,
    }, params.signal, requestSession), authenticatedUserId);

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
      {
        action: 'delete';
        bucket: PrivateMediaBucket;
        paths: string[];
        uploadSessionId: string;
      },
      { success: true }
    >({
      action: 'delete',
      bucket: PRIVATE_PLACE_MEDIA_BUCKET,
      paths: [data.objectPath],
      uploadSessionId,
    }, undefined, requestSession).catch(async () => {
      await params.onOrphanedUpload?.(orphanedStorageUri);
    });
    throw error;
  }
}

export async function rehomePublicPlaceMediaAssetToPrivate(params: {
  prefix: string;
  signal?: AbortSignal;
  uri: string;
  userId: string;
}) {
  const source = getStorageAssetRef('place-media', params.uri);

  if (!source || source.bucket !== 'place-media' || !PRIVATE_COVER_REHOME_DIRECTORY) {
    throw new Error('Public list cover cannot be moved to private storage safely.');
  }

  throwIfAborted(params.signal);
  const directoryInfo = await FileSystem.getInfoAsync(PRIVATE_COVER_REHOME_DIRECTORY);

  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(PRIVATE_COVER_REHOME_DIRECTORY, { intermediates: true });
  }

  const extension = getFileExtension(source.path);
  const temporaryPath = `${PRIVATE_COVER_REHOME_DIRECTORY}${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}.${extension}`;
  const { data } = supabase.storage.from(source.bucket).getPublicUrl(source.path);
  assertAllowedMediaUri(data.publicUrl);

  try {
    const download = await FileSystem.downloadAsync(data.publicUrl, temporaryPath);

    if (download.status < 200 || download.status >= 300) {
      throw new Error('Public list cover download failed.');
    }

    throwIfAborted(params.signal);
    return await uploadPlaceMediaAsset({
      extension,
      mediaType: 'photo',
      prefix: params.prefix,
      signal: params.signal,
      uri: download.uri,
      userId: params.userId,
    });
  } finally {
    await FileSystem.deleteAsync(temporaryPath, { idempotent: true }).catch(() => undefined);
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

const privateSignedReadUrlManager = createPrivateSignedReadUrlManager({
  async getRequestSession() {
    const requestSession = await getMediaRequestSession(undefined, true);

    if (!requestSession.userId) {
      throw new Error(t.settings.sessionMissing);
    }

    return { accessToken: requestSession.accessToken, userId: requestSession.userId };
  },
  requestSignedUrls: ({ paths, requestSession, signal }) =>
    callMediaFunction<
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
      paths,
    }, signal, requestSession),
});

/** Clears every private signed URL and invalidates queued/in-flight batches. */
export function purgePrivateSignedReadUrlState() {
  privateSignedReadUrlManager.purge();
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

  return privateSignedReadUrlManager.resolve(ref);
}

export async function resolveStorageAssetUrls(uris: Array<string | null | undefined>) {
  const parsedUris = uris.map((uri) => ({
    ref: uri ? parseStorageAssetUri(uri) : null,
    uri,
  }));
  parsedUris.forEach(({ ref, uri }) => {
    if (uri && !ref) {
      assertAllowedMediaUri(uri);
    }
  });
  const privateRefs = parsedUris.flatMap(({ ref }) =>
    ref?.bucket === PRIVATE_PLACE_MEDIA_BUCKET ? [ref] : []);
  const privateUrls = await privateSignedReadUrlManager.resolveMany(privateRefs);
  let privateUrlIndex = 0;

  return parsedUris.map(({ ref, uri }) => {
    if (!uri) {
      return null;
    }

    if (!ref) {
      return uri;
    }

    if (ref.bucket !== PRIVATE_PLACE_MEDIA_BUCKET) {
      return uri;
    }

    const privateUrl = privateUrls[privateUrlIndex];
    privateUrlIndex += 1;

    if (!privateUrl) {
      throw new Error('Private media URL response was incomplete.');
    }

    return privateUrl;
  });
}
