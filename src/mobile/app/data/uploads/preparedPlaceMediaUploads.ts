import {
  uploadPlaceMediaAsset,
  type UploadPlaceMediaAssetParams,
} from '@/mobile/app/platform/supabase/media';
import { trackEvent } from '@/mobile/app/platform/analytics/analyticsEvents';
import { createAbortError, throwIfAborted } from '@/mobile/app/shared/utils/abort';

const PREPARED_UPLOAD_TTL_MS = 10 * 60 * 1000;

type UploadProgress = { sentBytes: number; totalBytes: number };
type PreparedUploadParams = UploadPlaceMediaAssetParams & {
  onUnusedUpload?: (storageUri: string) => Promise<void> | void;
  userId: string;
};

type PreparedUploadEntry = {
  cleanupTimeout: ReturnType<typeof setTimeout> | null;
  lastProgress: UploadProgress | null;
  listeners: Set<(progress: UploadProgress) => void>;
  promise: Promise<string | undefined>;
};

const preparedUploads = new Map<string, PreparedUploadEntry>();

export function isLocalPlaceMediaUri(uri?: string | null) {
  return Boolean(uri?.startsWith('file://') || uri?.startsWith('content://'));
}

function getPreparedUploadKey(params: UploadPlaceMediaAssetParams) {
  return JSON.stringify([
    params.userId || '',
    params.uri || '',
    params.mediaType || '',
    params.mimeType || '',
    params.durationMs || 0,
    params.width || 0,
    params.height || 0,
  ]);
}

function removePreparedUpload(key: string, entry: PreparedUploadEntry) {
  if (preparedUploads.get(key) !== entry) {
    return;
  }

  preparedUploads.delete(key);
  if (entry.cleanupTimeout) {
    clearTimeout(entry.cleanupTimeout);
    entry.cleanupTimeout = null;
  }
}

function createPreparedUpload(key: string, params: PreparedUploadParams) {
  const entry: PreparedUploadEntry = {
    cleanupTimeout: null,
    lastProgress: null,
    listeners: new Set(),
    promise: Promise.resolve(undefined),
  };
  entry.promise = uploadPlaceMediaAsset({
    ...params,
    onProgress: (progress) => {
      entry.lastProgress = progress;
      entry.listeners.forEach((listener) => listener(progress));
    },
  }).then((storageUri) => {
    if (!storageUri) {
      removePreparedUpload(key, entry);
      return undefined;
    }

    entry.cleanupTimeout = setTimeout(() => {
      removePreparedUpload(key, entry);
      void params.onUnusedUpload?.(storageUri);
    }, PREPARED_UPLOAD_TTL_MS);
    return storageUri;
  }).catch((error) => {
    removePreparedUpload(key, entry);
    throw error;
  });
  preparedUploads.set(key, entry);
  return entry;
}

function getOrCreatePreparedUpload(params: PreparedUploadParams) {
  const key = getPreparedUploadKey(params);
  const existingEntry = preparedUploads.get(key);
  return {
    entry: existingEntry ?? createPreparedUpload(key, params),
    key,
    reused: Boolean(existingEntry),
  };
}

function waitForPreparedUpload(entry: PreparedUploadEntry, signal?: AbortSignal) {
  throwIfAborted(signal);

  if (!signal) {
    return entry.promise;
  }

  return new Promise<string | undefined>((resolve, reject) => {
    const handleAbort = () => reject(createAbortError());
    signal.addEventListener('abort', handleAbort, { once: true });
    entry.promise.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', handleAbort);
    });
  });
}

export function preparePlaceMediaUpload(params: PreparedUploadParams) {
  if (!isLocalPlaceMediaUri(params.uri)) {
    return;
  }

  const { entry, reused } = getOrCreatePreparedUpload({ ...params, signal: undefined });
  if (!reused) {
    trackEvent({ name: 'upload_prepared', params: { mediaType: params.mediaType } });
  }
  void entry.promise.catch(() => undefined);
}

export async function uploadPreparedPlaceMediaAsset(params: PreparedUploadParams) {
  if (!isLocalPlaceMediaUri(params.uri)) {
    return uploadPlaceMediaAsset(params);
  }

  const { entry, key, reused } = getOrCreatePreparedUpload(params);
  if (reused) {
    trackEvent({ name: 'upload_prepared_claimed', params: { mediaType: params.mediaType } });
  }
  const listener = params.onProgress;
  if (listener) {
    entry.listeners.add(listener);
    if (entry.lastProgress) {
      listener(entry.lastProgress);
    }
  }

  let consumed = false;
  try {
    const storageUri = await waitForPreparedUpload(entry, params.signal);
    consumed = true;
    return storageUri;
  } finally {
    if (listener) {
      entry.listeners.delete(listener);
    }
    if (consumed) {
      removePreparedUpload(key, entry);
    }
  }
}

export const preparedPlaceMediaUploadInternals = {
  PREPARED_UPLOAD_TTL_MS,
  getPreparedUploadKey,
  reset() {
    preparedUploads.forEach((entry) => {
      if (entry.cleanupTimeout) {
        clearTimeout(entry.cleanupTimeout);
      }
    });
    preparedUploads.clear();
  },
};
