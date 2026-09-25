import * as FileSystem from 'expo-file-system/legacy';
import { trackEvent } from '@/mobile/app/platform/analytics/analyticsEvents';
import { PLACE_MEDIA_MAX_FILE_SIZE_BYTES } from '@/mobile/app/platform/media/placeMediaSize';
import { supabase } from '@/mobile/app/platform/supabase/client';
import {
  buildUploadSizeLimitMessage,
  readStorageUploadError,
} from '@/mobile/app/platform/supabase/mediaErrorMessages';
import {
  createPrivateSignedReadUrlManager,
} from '@/mobile/app/platform/supabase/privateSignedReadUrls';
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
import { createUuid } from '@/shared/utils/id';
import {
  getContentType,
  getFileExtension,
  readLocalMediaSize,
} from '@/mobile/app/platform/supabase/localMediaFiles';
import { t } from '@/mobile/app/shared/i18n';
import { isAbortError, throwIfAborted, waitWithAbort } from '@/mobile/app/shared/utils/abort';
import {
  MEDIA_RETRY_BASE_DELAY_MS,
  callMediaFunction,
  getMediaRequestSession,
  isRetriableMediaStatus,
} from '@/mobile/app/platform/supabase/mediaFunctionClient';

export {
  isAllowedMediaUri,
  isPublicPlaceMediaAsset,
  isStorageAssetUri,
} from '@/mobile/app/platform/supabase/mediaProtocol';
export type { MediaBucket } from '@/mobile/app/platform/supabase/mediaProtocol';

const PROFILE_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
const PLACE_MEDIA_MAX_BYTES = PLACE_MEDIA_MAX_FILE_SIZE_BYTES;
const IMMUTABLE_MEDIA_CACHE_CONTROL = 'max-age=31536000, immutable';
const PRIVATE_COVER_REHOME_DIRECTORY = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ''}private-cover-rehome/`;
const MAX_STORAGE_UPLOAD_ATTEMPTS = 3;

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
      errorBucket: bucket,
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
        bucket: PublicMediaBucket;
        paths: string[];
        uploadSessionId: string;
      },
      { success: true }
    >({
      action: 'delete',
      bucket,
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
  errorBucket: PublicMediaBucket;
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
        bucket: params.errorBucket,
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
      errorBucket: 'place-media',
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
  const temporaryPath = `${PRIVATE_COVER_REHOME_DIRECTORY}${createUuid()}.${extension}`;
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
