import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  View,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';
import {
  Image as ExpoImage,
  type ImageContentFit,
  type ImageProps as ExpoImageProps,
} from 'expo-image';

import {
  isStorageAssetUri,
  resolveStorageAssetUrl,
  resolveStorageAssetUrls,
} from '@/mobile/app/platform/supabase/media';
import { getCurrentConnectionStatus } from '@/mobile/app/platform/network/connectivityStatus';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { IMAGE_CROSSFADE_MS } from '@/mobile/app/shared/performance/budgets';

const LOADER_DELAY_MS = 220;
const LOADER_FAILSAFE_MS = 1800;
const IMAGE_PREFETCH_CONCURRENCY = 2;
const MAX_WARMED_IMAGE_KEYS = 512;
const MAX_PREFETCH_QUEUE_JOBS = 8;
const MAX_PREFETCH_URIS_PER_JOB = 8;
const DEFAULT_IMAGE_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';
const DEFAULT_IMAGE_PLACEHOLDER = { blurhash: DEFAULT_IMAGE_BLURHASH } as const;

const warmedImageKeys = new Set<string>();
const pendingPrefetchKeys = new Set<string>();
const sourceResolutionInFlight = new Map<string, Promise<ResolvedImageSource | null>>();
type PrefetchPriority = 'high' | 'low' | 'normal';
type PrefetchJob = {
  abortListener?: () => void;
  priority: PrefetchPriority;
  resolve: (succeeded: boolean) => void;
  settled: boolean;
  signal?: AbortSignal;
  uris: string[];
};
const prefetchQueue: PrefetchJob[] = [];
let prefetchQueueRunning = false;

type AppImageProps = Omit<ExpoImageProps, 'contentFit' | 'placeholder' | 'source' | 'style'> & {
  backgroundColor?: string;
  fallback?: React.ReactNode;
  imageStyle?: StyleProp<ImageStyle>;
  placeholder?: ExpoImageProps['placeholder'];
  recycleKey?: string;
  resizeMode?: ImageContentFit;
  showLoader?: boolean;
  style?: StyleProp<ViewStyle>;
  uri?: string | null;
};

type ResolvedImageSource = {
  uri: string;
};

function toFileUri(cachePath: string) {
  if (/^[a-z][a-z\d+.-]*:/i.test(cachePath)) {
    return cachePath;
  }

  return `file://${cachePath}`;
}

function rememberWarmedImage(cacheKey: string) {
  warmedImageKeys.delete(cacheKey);
  warmedImageKeys.add(cacheKey);

  if (warmedImageKeys.size <= MAX_WARMED_IMAGE_KEYS) {
    return;
  }

  const oldestKey = warmedImageKeys.values().next().value;
  if (oldestKey) {
    warmedImageKeys.delete(oldestKey);
  }
}

async function loadPrefetchBatch(entries: Array<{ cacheKey: string; uri: string }>) {
  const results = await Promise.allSettled(
    entries.map(({ cacheKey, uri }) =>
      ExpoImage.loadAsync({ cacheKey, uri }),
    ),
  );

  results.forEach((result, index) => {
    const entry = entries[index];
    if (result.status === 'fulfilled' && entry) {
      rememberWarmedImage(entry.cacheKey);
    }
  });

  return results.every((result) => result.status === 'fulfilled');
}

async function executeImagePrefetch(uniqueUris: string[]) {
  try {
    const cachePaths = await Promise.all(
      uniqueUris.map((uri) =>
        warmedImageKeys.has(uri)
          ? Promise.resolve('memory')
          : ExpoImage.getCachePathAsync(uri).catch(() => null),
      ),
    );
    const uncachedUris = uniqueUris.filter((uri, index) => {
      if (!cachePaths[index]) {
        return true;
      }

      rememberWarmedImage(uri);
      return false;
    });

    if (uncachedUris.length === 0) {
      return true;
    }

    const resolvedUris = await resolveStorageAssetUrls(uncachedUris);
    const entries = uncachedUris.flatMap((cacheKey, index) => {
      const resolvedUri = resolvedUris[index];
      return resolvedUri ? [{ cacheKey, uri: resolvedUri }] : [];
    });

    if (entries.length === 0) {
      return false;
    }

    let succeeded = true;
    for (let offset = 0; offset < entries.length; offset += IMAGE_PREFETCH_CONCURRENCY) {
      const batchSucceeded = await loadPrefetchBatch(
        entries.slice(offset, offset + IMAGE_PREFETCH_CONCURRENCY),
      );
      succeeded = batchSucceeded && succeeded;
    }

    return succeeded;
  } catch {
    return false;
  }
}

function takeNextPrefetchJob() {
  const highPriorityIndex = prefetchQueue.findIndex((job) => job.priority === 'high');
  if (highPriorityIndex >= 0) {
    return prefetchQueue.splice(highPriorityIndex, 1)[0];
  }

  const normalPriorityIndex = prefetchQueue.findIndex((job) => job.priority === 'normal');
  if (normalPriorityIndex >= 0) {
    return prefetchQueue.splice(normalPriorityIndex, 1)[0];
  }

  return prefetchQueue.shift();
}

function resolveImageSource(uri: string) {
  const inFlight = sourceResolutionInFlight.get(uri);
  if (inFlight) {
    return inFlight;
  }

  const resolution = (async (): Promise<ResolvedImageSource | null> => {
    if (isStorageAssetUri(uri)) {
      const cachePath = await ExpoImage.getCachePathAsync(uri).catch(() => null);
      if (cachePath) {
        rememberWarmedImage(uri);
        return { uri: toFileUri(cachePath) };
      }
    }

    const resolvedUri = await resolveStorageAssetUrl(uri);
    return resolvedUri ? { uri: resolvedUri } : null;
  })().finally(() => {
    sourceResolutionInFlight.delete(uri);
  });

  sourceResolutionInFlight.set(uri, resolution);
  return resolution;
}

function trimPrefetchQueue(priority: PrefetchPriority) {
  if (prefetchQueue.length < MAX_PREFETCH_QUEUE_JOBS) {
    return true;
  }

  const disposableIndex = prefetchQueue.findLastIndex((job) => job.priority === 'low');

  if (disposableIndex < 0 || priority === 'low') {
    return false;
  }

  const discardedJob = prefetchQueue.splice(disposableIndex, 1)[0];
  if (discardedJob) {
    finishPrefetchJob(discardedJob, false);
  }
  return true;
}

function finishPrefetchJob(job: PrefetchJob, succeeded: boolean) {
  if (job.settled) {
    return;
  }

  job.settled = true;
  if (job.abortListener) {
    job.signal?.removeEventListener('abort', job.abortListener);
  }
  job.uris.forEach((uri) => pendingPrefetchKeys.delete(uri));
  job.resolve(succeeded);
}

function drainPrefetchQueue() {
  if (prefetchQueueRunning) {
    return;
  }

  const job = takeNextPrefetchJob();

  if (!job) {
    return;
  }

  if (job.signal?.aborted) {
    finishPrefetchJob(job, false);
    drainPrefetchQueue();
    return;
  }

  if (job.priority === 'low' && getCurrentConnectionStatus() !== 'online') {
    finishPrefetchJob(job, false);
    drainPrefetchQueue();
    return;
  }

  prefetchQueueRunning = true;
  void executeImagePrefetch(job.uris)
    .then((succeeded) => finishPrefetchJob(job, succeeded))
    .catch(() => finishPrefetchJob(job, false))
    .finally(() => {
      prefetchQueueRunning = false;
      drainPrefetchQueue();
    });
}

export function prefetchAppImages(
  uris: Array<string | null | undefined>,
  options: { priority?: PrefetchPriority; signal?: AbortSignal } = {},
) {
  const requestedUris = Array.from(new Set(uris.filter((uri): uri is string => Boolean(uri))))
    .slice(0, MAX_PREFETCH_URIS_PER_JOB);
  const uniqueUris = requestedUris.filter(
    (uri) => !warmedImageKeys.has(uri) && !pendingPrefetchKeys.has(uri),
  );

  if (options.signal?.aborted) {
    return Promise.resolve(false);
  }

  if (uniqueUris.length === 0) {
    return Promise.resolve(requestedUris.length > 0);
  }

  const priority = options.priority ?? 'normal';

  if (!trimPrefetchQueue(priority)) {
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    const job: PrefetchJob = {
      priority,
      resolve,
      settled: false,
      signal: options.signal,
      uris: uniqueUris,
    };
    uniqueUris.forEach((uri) => pendingPrefetchKeys.add(uri));
    prefetchQueue.push(job);

    job.abortListener = () => {
      const queuedIndex = prefetchQueue.indexOf(job);

      if (queuedIndex >= 0) {
        prefetchQueue.splice(queuedIndex, 1);
        finishPrefetchJob(job, false);
      }
    };
    options.signal?.addEventListener('abort', job.abortListener, { once: true });
    drainPrefetchQueue();
  });
}

export function clearAppImagePrefetchQueue() {
  prefetchQueue.splice(0).forEach((job) => finishPrefetchJob(job, false));
  warmedImageKeys.clear();
  pendingPrefetchKeys.clear();
  sourceResolutionInFlight.clear();
}

export function AppImage({
  accessibilityLabel,
  backgroundColor = colors.surfaceMuted,
  cachePolicy = 'memory-disk',
  fallback,
  imageStyle,
  onError,
  onLoad,
  onLoadEnd,
  onLoadStart,
  placeholder = DEFAULT_IMAGE_PLACEHOLDER,
  recycleKey,
  recyclingKey,
  resizeMode = 'cover',
  showLoader = true,
  style,
  transition = IMAGE_CROSSFADE_MS,
  uri,
  ...imageProps
}: AppImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resolvedSource, setResolvedSource] = useState<ResolvedImageSource | null>(null);
  const loaderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaderFailsafeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLoaderTimeout = () => {
    if (loaderTimeoutRef.current) {
      clearTimeout(loaderTimeoutRef.current);
      loaderTimeoutRef.current = null;
    }

    if (loaderFailsafeTimeoutRef.current) {
      clearTimeout(loaderFailsafeTimeoutRef.current);
      loaderFailsafeTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    let cancelled = false;

    clearLoaderTimeout();
    setHasError(false);
    setIsLoading(false);
    setResolvedSource(null);

    if (uri) {
      void resolveImageSource(uri).then((source) => {
        if (!cancelled) {
          setResolvedSource(source);
        }
      }).catch(() => {
        if (!cancelled) {
          setHasError(true);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [uri]);

  useEffect(() => {
    return () => {
      clearLoaderTimeout();
    };
  }, []);

  const showFallback = !resolvedSource || hasError;
  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      style={[styles.container, { backgroundColor }, style]}
    >
      {resolvedSource && !hasError ? (
        <ExpoImage
          {...imageProps}
          cachePolicy={cachePolicy}
          contentFit={resizeMode}
          placeholder={placeholder}
          placeholderContentFit={resizeMode}
          recyclingKey={recyclingKey || recycleKey || uri || resolvedSource.uri}
          source={{
            cacheKey: uri || resolvedSource.uri,
            uri: resolvedSource.uri,
          }}
          transition={transition}
          onError={(event) => {
            clearLoaderTimeout();
            setHasError(true);
            setIsLoading(false);
            onError?.(event);
          }}
          onLoad={(event) => {
            clearLoaderTimeout();
            setIsLoading(false);
            onLoad?.(event);
          }}
          onLoadEnd={() => {
            clearLoaderTimeout();
            setIsLoading(false);
            onLoadEnd?.();
          }}
          onLoadStart={() => {
            clearLoaderTimeout();
            loaderTimeoutRef.current = setTimeout(() => {
              setIsLoading(true);
              loaderTimeoutRef.current = null;
            }, LOADER_DELAY_MS);
            loaderFailsafeTimeoutRef.current = setTimeout(() => {
              setIsLoading(false);
              loaderFailsafeTimeoutRef.current = null;
            }, LOADER_FAILSAFE_MS);
            onLoadStart?.();
          }}
          style={[StyleSheet.absoluteFillObject, imageStyle]}
        />
      ) : null}
      {showFallback ? (
        <View pointerEvents="none" style={styles.fallback}>
          {fallback}
        </View>
      ) : null}
      {showLoader && resolvedSource && isLoading && !hasError ? (
        <View pointerEvents="none" style={styles.loaderWrap}>
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const appImageInternals = {
  DEFAULT_IMAGE_BLURHASH,
  DEFAULT_IMAGE_PLACEHOLDER,
  MAX_PREFETCH_QUEUE_JOBS,
  MAX_PREFETCH_URIS_PER_JOB,
  clear() {
    clearAppImagePrefetchQueue();
  },
};
