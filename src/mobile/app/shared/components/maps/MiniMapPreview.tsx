import React, { useEffect, useMemo, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { MapPin } from 'lucide-react-native';

import { env } from '@/mobile/app/platform/config/env';
import type { SharedMapProps } from '@/mobile/app/shared/components/maps/SharedMapTypes';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { t } from '@/mobile/app/shared/i18n';
import { runAfterNextPaint } from '@/mobile/app/shared/utils/interaction';
import type { MapMarkerItem } from '@/mobile/app/shared/utils/markerColors';
import { colors, radius, typography } from '@/mobile/app/shared/theme/tokens';

type MiniMapPreviewProps = {
  places: MapMarkerItem[];
  height?: number;
  interactive?: boolean;
  instanceId?: number;
  liteMode?: boolean;
  loadStaticPreview?: boolean;
  onMapGesture?: () => void;
  onMarkerPress?: (index: number) => void;
  highlightedIndex?: number | null;
  focusIndex?: number | null;
  focusTrigger?: number;
};

type MiniMapFallbackProps = {
  places: MapMarkerItem[];
};

function DeferredAppMapView(props: SharedMapProps) {
  const { AppMapView } = require('@/mobile/app/shared/components/maps/AppMapView') as
    typeof import('@/mobile/app/shared/components/maps/AppMapView');
  return <AppMapView {...props} />;
}

const STATIC_MAP_URL_CACHE = new Map<string, string>();
const MAX_STATIC_MAP_URL_CACHE_ENTRIES = 128;

function getCachedStaticMapUrl(cacheKey: string) {
  if (!STATIC_MAP_URL_CACHE.has(cacheKey)) {
    return undefined;
  }

  const cachedUrl = STATIC_MAP_URL_CACHE.get(cacheKey);
  if (!cachedUrl) {
    return undefined;
  }
  STATIC_MAP_URL_CACHE.delete(cacheKey);
  STATIC_MAP_URL_CACHE.set(cacheKey, cachedUrl);
  return cachedUrl;
}

function rememberStaticMapUrl(cacheKey: string, url: string) {
  STATIC_MAP_URL_CACHE.set(cacheKey, url);
  if (STATIC_MAP_URL_CACHE.size <= MAX_STATIC_MAP_URL_CACHE_ENTRIES) {
    return;
  }

  const oldestKey = STATIC_MAP_URL_CACHE.keys().next().value;
  if (oldestKey) {
    STATIC_MAP_URL_CACHE.delete(oldestKey);
  }
}

function toStaticMapColor(color?: string) {
  if (!color) {
    return '0x3b82f6';
  }

  if (color.startsWith('#')) {
    return `0x${color.slice(1)}`;
  }

  return color;
}

function buildStaticMapUrl(places: MapMarkerItem[], height: number, width: number) {
  // Keep the native Maps SDK keys isolated from the quota-limited Static Maps key.
  if (!env.googleMapsStaticApiKey || places.length === 0) {
    return null;
  }

  const normalizedPlaces = places
    .slice()
    .sort((left, right) =>
      `${left.lat.toFixed(6)}:${left.lng.toFixed(6)}:${left.markerColor ?? ''}`.localeCompare(
        `${right.lat.toFixed(6)}:${right.lng.toFixed(6)}:${right.markerColor ?? ''}`,
      ),
    );
  const cacheKey = [
    Math.round(height),
    Math.round(width),
    ...normalizedPlaces.map(
      (place) =>
        `${place.lat.toFixed(6)}:${place.lng.toFixed(6)}:${toStaticMapColor(place.markerColor)}`,
    ),
  ].join('|');

  const cachedUrl = getCachedStaticMapUrl(cacheKey);
  if (cachedUrl !== undefined) {
    return cachedUrl;
  }

  const params = new URLSearchParams();
  params.set('size', `${Math.round(width)}x${Math.round(height)}`);
  params.set('scale', '2');
  params.set('maptype', 'roadmap');
  params.set('key', env.googleMapsStaticApiKey);

  if (normalizedPlaces.length === 1) {
    params.set('center', `${normalizedPlaces[0].lat},${normalizedPlaces[0].lng}`);
    params.set('zoom', '15');
  } else {
    params.set('visible', normalizedPlaces.map((place) => `${place.lat},${place.lng}`).join('|'));
  }

  normalizedPlaces.slice(0, 8).forEach((place) => {
    params.append(
      'markers',
      `color:${toStaticMapColor(place.markerColor)}|${place.lat},${place.lng}`,
    );
  });

  const url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
  rememberStaticMapUrl(cacheKey, url);
  return url;
}

function buildPlacesSignature(places: MapMarkerItem[]) {
  return places
    .map(
      (place, index) =>
        `${index}:${place.name}:${place.lat.toFixed(6)}:${place.lng.toFixed(6)}:${place.markerColor ?? ''}`,
    )
    .join('|');
}

function MiniMapFallback({ places }: MiniMapFallbackProps) {
  const title =
    places.length === 1
      ? places[0]?.name || t.map.previewFallbackTitle
      : t.cards.placesCount(places.length);

  return (
    <View style={styles.fallbackContent}>
      <View style={styles.fallbackPin}>
        <MapPin color={colors.primary} size={16} />
      </View>
      <Text numberOfLines={1} style={styles.fallbackTitle}>
        {title}
      </Text>
      <Text numberOfLines={1} style={styles.fallbackSubtitle}>
        {t.map.previewUnavailable}
      </Text>
    </View>
  );
}

function MiniMapPreviewComponent({
  places,
  height = 148,
  interactive = false,
  instanceId = 0,
  liteMode,
  loadStaticPreview = true,
  onMapGesture,
  onMarkerPress,
  highlightedIndex = null,
  focusIndex = null,
  focusTrigger = 0,
}: MiniMapPreviewProps) {
  const isFocused = useIsFocused();
  const { width: viewportWidth } = useWindowDimensions();
  const [staticPreviewReady, setStaticPreviewReady] = useState(false);
  const [staticPreviewFailed, setStaticPreviewFailed] = useState(false);
  const [focusRecoveryInstanceId, setFocusRecoveryInstanceId] = useState(0);
  const wasInteractiveMapVisibleRef = React.useRef(false);
  const placesSignature = buildPlacesSignature(places);
  const previewWidth = Math.min(480, Math.max(240, viewportWidth - 24));
  const staticMapUrl = useMemo(
    () => loadStaticPreview ? buildStaticMapUrl(places, height, previewWidth) : null,
    [height, loadStaticPreview, places, previewWidth],
  );
  const shouldRenderInteractiveMap = interactive && isFocused;
  const shouldRenderNativePreview = shouldRenderInteractiveMap;
  const staticPreviewUri =
    !shouldRenderInteractiveMap && staticPreviewReady && !staticPreviewFailed ? staticMapUrl : null;
  const effectiveInstanceId = instanceId * 1000 + focusRecoveryInstanceId;

  useEffect(() => {
    setStaticPreviewFailed(false);
  }, [staticMapUrl, placesSignature]);

  useEffect(() => {
    if (shouldRenderInteractiveMap || !staticMapUrl) {
      setStaticPreviewReady(false);
      return;
    }

    const cancelDeferredPreview = runAfterNextPaint(() => {
      setStaticPreviewReady(true);
    });

    return cancelDeferredPreview;
  }, [shouldRenderInteractiveMap, staticMapUrl]);

  useEffect(() => {
    if (!shouldRenderInteractiveMap) {
      wasInteractiveMapVisibleRef.current = false;
      return;
    }

    if (!wasInteractiveMapVisibleRef.current) {
      wasInteractiveMapVisibleRef.current = true;
      return;
    }

    setFocusRecoveryInstanceId((current) => current + 1);
  }, [shouldRenderInteractiveMap]);

  if (!shouldRenderNativePreview) {
    return (
      <View pointerEvents="none" style={[styles.container, { height }]}>
        <View collapsable={false} style={StyleSheet.absoluteFillObject}>
          <AppImage
            uri={staticPreviewUri}
            style={StyleSheet.absoluteFillObject}
            accessibilityLabel={t.map.previewAccessibilityLabel}
            fallback={<MiniMapFallback places={places} />}
            backgroundColor={colors.mapBackground}
            showLoader={Boolean(staticPreviewUri)}
            onError={() => setStaticPreviewFailed(true)}
          />
        </View>
      </View>
    );
  }

  return (
    <View pointerEvents={interactive ? 'auto' : 'none'} style={[styles.container, { height }]}>
      <View collapsable={false} style={StyleSheet.absoluteFillObject}>
        <DeferredAppMapView
          instanceId={effectiveInstanceId}
          places={places}
          interactive={interactive}
          liteMode={liteMode ?? !interactive}
          onMapGesture={onMapGesture}
          onMarkerPress={onMarkerPress}
          highlightedIndex={highlightedIndex}
          focusIndex={focusIndex}
          focusTrigger={focusTrigger}
        />
      </View>
    </View>
  );
}

function areMiniMapPreviewPropsEqual(
  previous: MiniMapPreviewProps,
  next: MiniMapPreviewProps,
) {
  const previousSignature = buildPlacesSignature(previous.places);
  const nextSignature = buildPlacesSignature(next.places);

  return (
    previousSignature === nextSignature &&
    previous.height === next.height &&
    previous.interactive === next.interactive &&
    previous.instanceId === next.instanceId &&
    previous.liteMode === next.liteMode &&
    previous.loadStaticPreview === next.loadStaticPreview &&
    previous.highlightedIndex === next.highlightedIndex &&
    previous.focusIndex === next.focusIndex &&
    previous.focusTrigger === next.focusTrigger &&
    previous.onMapGesture === next.onMapGesture &&
    previous.onMarkerPress === next.onMarkerPress
  );
}

export const MiniMapPreview = React.memo(
  MiniMapPreviewComponent,
  areMiniMapPreviewPropsEqual,
);

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.mapBackground,
  },
  fallbackContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    backgroundColor: colors.mapBackground,
  },
  fallbackPin: {
    width: 30,
    height: 30,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBg,
  },
  fallbackTitle: {
    maxWidth: '88%',
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  fallbackSubtitle: {
    maxWidth: '88%',
    ...typography.metadataText,
    fontWeight: '600',
    color: colors.textSoft,
    textAlign: 'center',
  },
});
