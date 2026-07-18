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

import { resolveStorageAssetUrl } from '@/mobile/app/platform/supabase/media';
import { colors } from '@/mobile/app/shared/theme/tokens';

const LOADER_DELAY_MS = 220;
const LOADER_FAILSAFE_MS = 1800;
const DEFAULT_TRANSITION_MS = 140;

type AppImageProps = Omit<ExpoImageProps, 'contentFit' | 'placeholder' | 'source' | 'style'> & {
  backgroundColor?: string;
  blurhash?: string | null;
  fallback?: React.ReactNode;
  imageStyle?: StyleProp<ImageStyle>;
  recycleKey?: string;
  resizeMode?: ImageContentFit;
  showLoader?: boolean;
  style?: StyleProp<ViewStyle>;
  thumbhash?: string | null;
  uri?: string | null;
};

type ExpoImagePrefetch = {
  prefetch: (
    urls: string | string[],
    cachePolicy?: 'disk' | 'memory' | 'memory-disk',
  ) => Promise<boolean>;
};

export function prefetchAppImages(uris: Array<string | null | undefined>) {
  const uniqueUris = Array.from(new Set(uris.filter((uri): uri is string => Boolean(uri))));

  if (uniqueUris.length === 0) {
    return Promise.resolve(false);
  }

  return Promise.all(uniqueUris.map((uri) => resolveStorageAssetUrl(uri))).then((resolvedUris) => {
    const prefetchUris = Array.from(
      new Set(resolvedUris.filter((uri): uri is string => Boolean(uri))),
    );

    if (prefetchUris.length === 0) {
      return false;
    }

    return (ExpoImage as unknown as ExpoImagePrefetch).prefetch(prefetchUris, 'memory-disk');
  })
    .catch(() => false);
}

export function AppImage({
  accessibilityLabel,
  backgroundColor = colors.surfaceMuted,
  blurhash,
  cachePolicy = 'memory-disk',
  fallback,
  imageStyle,
  onError,
  onLoad,
  onLoadEnd,
  onLoadStart,
  recycleKey,
  recyclingKey,
  resizeMode = 'cover',
  showLoader = true,
  style,
  thumbhash,
  transition = DEFAULT_TRANSITION_MS,
  uri,
  ...imageProps
}: AppImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resolvedUri, setResolvedUri] = useState<string | null>(uri ?? null);
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
    setResolvedUri(uri ?? null);

    if (uri) {
      void resolveStorageAssetUrl(uri)
        .then((nextUri) => {
          if (!cancelled) {
            setResolvedUri(nextUri);
          }
        })
        .catch(() => {
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

  const showFallback = !resolvedUri || hasError;
  const placeholder = blurhash
    ? { blurhash }
    : thumbhash
      ? { thumbhash }
      : undefined;

  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      style={[styles.container, { backgroundColor }, style]}
    >
      {resolvedUri && !hasError ? (
        <ExpoImage
          {...imageProps}
          cachePolicy={cachePolicy}
          contentFit={resizeMode}
          placeholder={placeholder}
          recyclingKey={recyclingKey || recycleKey || resolvedUri}
          source={{ uri: resolvedUri }}
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
      {showLoader && resolvedUri && isLoading && !hasError ? (
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
