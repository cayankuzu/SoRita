import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  type ImageErrorEventData,
  type ImageLoadEventData,
  type ImageProps,
  type ImageStyle,
  type NativeSyntheticEvent,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { colors } from '@/mobile/app/shared/theme/tokens';

const LOADER_DELAY_MS = 180;
const LOADER_FAILSAFE_MS = 1800;

type AppImageProps = Omit<ImageProps, 'source' | 'style'> & {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  fallback?: React.ReactNode;
  backgroundColor?: string;
  showLoader?: boolean;
};

export function AppImage({
  accessibilityLabel,
  backgroundColor = colors.surfaceMuted,
  fallback,
  imageStyle,
  onError,
  onLoad,
  onLoadEnd,
  onLoadStart,
  resizeMode = 'cover',
  showLoader = true,
  style,
  uri,
  ...imageProps
}: AppImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
    clearLoaderTimeout();
    setHasError(false);
    setIsLoading(false);
  }, [uri]);

  useEffect(() => {
    return () => {
      clearLoaderTimeout();
    };
  }, []);

  const showFallback = !uri || hasError;

  const handleLoadStart = () => {
    clearLoaderTimeout();
    if (Platform.OS === 'ios') {
      onLoadStart?.();
      return;
    }

    loaderTimeoutRef.current = setTimeout(() => {
      setIsLoading(true);
      loaderTimeoutRef.current = null;
    }, LOADER_DELAY_MS);
    loaderFailsafeTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      loaderFailsafeTimeoutRef.current = null;
    }, LOADER_FAILSAFE_MS);
    onLoadStart?.();
  };

  const handleLoad = (event: NativeSyntheticEvent<ImageLoadEventData>) => {
    clearLoaderTimeout();
    setIsLoading(false);
    onLoad?.(event);
  };

  const handleLoadEnd = () => {
    clearLoaderTimeout();
    setIsLoading(false);
    onLoadEnd?.();
  };

  const handleError = (event: NativeSyntheticEvent<ImageErrorEventData>) => {
    clearLoaderTimeout();
    setHasError(true);
    setIsLoading(false);
    onError?.(event);
  };

  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      style={[styles.container, { backgroundColor }, style]}
    >
      {uri && !hasError ? (
        <Image
          {...imageProps}
          source={{ uri, cache: 'force-cache' }}
          resizeMode={resizeMode}
          resizeMethod="resize"
          progressiveRenderingEnabled
          fadeDuration={150}
          onError={handleError}
          onLoad={handleLoad}
          onLoadEnd={handleLoadEnd}
          onLoadStart={handleLoadStart}
          style={[StyleSheet.absoluteFillObject, imageStyle]}
        />
      ) : null}
      {showFallback ? (
        <View pointerEvents="none" style={styles.fallback}>
          {fallback}
        </View>
      ) : null}
      {showLoader && Platform.OS !== 'ios' && uri && isLoading && !hasError ? (
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
