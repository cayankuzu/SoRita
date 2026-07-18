import React, { useEffect, useMemo, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';

import { env } from '@/mobile/app/platform/config/env';
import { AppMapView } from '@/mobile/app/shared/components/maps/AppMapView';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { t } from '@/mobile/app/shared/i18n';
import type { MapMarkerItem } from '@/mobile/app/shared/utils/markerColors';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type MiniMapPreviewProps = {
  places: MapMarkerItem[];
  height?: number;
  interactive?: boolean;
  instanceId?: number;
  liteMode?: boolean;
  onMapGesture?: () => void;
  onMarkerPress?: (index: number) => void;
  highlightedIndex?: number | null;
  focusIndex?: number | null;
  focusTrigger?: number;
};

type MiniMapFallbackProps = {
  places: MapMarkerItem[];
};

const STATIC_MAP_URL_CACHE = new Map<string, string | null>();

function toStaticMapColor(color?: string) {
  if (!color) {
    return '0x3b82f6';
  }

  if (color.startsWith('#')) {
    return `0x${color.slice(1)}`;
  }

  return color;
}

function buildStaticMapUrl(places: MapMarkerItem[], height: number) {
  // This key is intentionally public and restricted to map rendering use cases only.
  if (!env.googleMapsApiKey || places.length === 0) {
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
    ...normalizedPlaces.map(
      (place) =>
        `${place.lat.toFixed(6)}:${place.lng.toFixed(6)}:${toStaticMapColor(place.markerColor)}`,
    ),
  ].join('|');

  if (STATIC_MAP_URL_CACHE.has(cacheKey)) {
    return STATIC_MAP_URL_CACHE.get(cacheKey) || null;
  }

  const params = new URLSearchParams();
  params.set('size', `640x${Math.max(240, Math.round(height * 2.6))}`);
  params.set('scale', '2');
  params.set('maptype', 'roadmap');
  params.set('key', env.googleMapsApiKey);

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
  STATIC_MAP_URL_CACHE.set(cacheKey, url);
  return url;
}

function MiniMapFallback({ places }: MiniMapFallbackProps) {
  const title =
    places.length === 1
      ? places[0]?.name || t.map.previewFallbackTitle
      : t.cards.placesCount(places.length);

  return (
    <View style={styles.fallbackContent}>
      <View style={styles.fallbackPin}>
        <MapPin color={colors.primary} size={18} />
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
  onMapGesture,
  onMarkerPress,
  highlightedIndex = null,
  focusIndex = null,
  focusTrigger = 0,
}: MiniMapPreviewProps) {
  const isFocused = useIsFocused();
  const [staticPreviewFailed, setStaticPreviewFailed] = useState(false);
  const [focusRecoveryInstanceId, setFocusRecoveryInstanceId] = useState(0);
  const wasInteractiveMapVisibleRef = React.useRef(false);
  const placesSignature = places
    .map(
      (place, index) =>
        `${index}:${place.name}:${place.lat.toFixed(6)}:${place.lng.toFixed(6)}:${place.markerColor ?? ''}`,
    )
    .join('|');
  const staticMapUrl = useMemo(() => buildStaticMapUrl(places, height), [height, placesSignature]);
  const shouldRenderInteractiveMap = interactive && isFocused;
  const shouldRenderNativePreview = shouldRenderInteractiveMap;
  const staticPreviewUri = !shouldRenderInteractiveMap && !staticPreviewFailed ? staticMapUrl : null;
  const effectiveInstanceId = instanceId * 1000 + focusRecoveryInstanceId;

  useEffect(() => {
    setStaticPreviewFailed(false);
  }, [staticMapUrl, placesSignature]);

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
            backgroundColor="#ebe7de"
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
        <AppMapView
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
  const previousSignature = previous.places
    .map(
      (place, index) =>
        `${index}:${place.name}:${place.lat.toFixed(6)}:${place.lng.toFixed(6)}:${place.markerColor ?? ''}`,
    )
    .join('|');
  const nextSignature = next.places
    .map(
      (place, index) =>
        `${index}:${place.name}:${place.lat.toFixed(6)}:${place.lng.toFixed(6)}:${place.markerColor ?? ''}`,
    )
    .join('|');

  return (
    previousSignature === nextSignature &&
    previous.height === next.height &&
    previous.interactive === next.interactive &&
    previous.instanceId === next.instanceId &&
    previous.liteMode === next.liteMode &&
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
    gap: 6,
    paddingHorizontal: 16,
    backgroundColor: colors.mapBackground,
  },
  fallbackPin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBg,
  },
  fallbackTitle: {
    maxWidth: '88%',
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  fallbackSubtitle: {
    maxWidth: '88%',
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSoft,
    textAlign: 'center',
  },
});
