import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import { MapPin } from 'lucide-react-native';

import type { SharedMapProps } from '@/mobile/app/shared/components/maps/SharedMapTypes';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { SkeletonPlaceholder } from '@/mobile/app/shared/components/ui/SkeletonPlaceholder';
import { t } from '@/mobile/app/shared/i18n';
import { runAfterNextPaint } from '@/mobile/app/shared/utils/interaction';
import type { MapMarkerItem } from '@/mobile/app/shared/utils/markerColors';
import {
  DEFAULT_MINI_MAP_PREVIEW_HEIGHT,
  buildStaticMapUrl,
  getStaticMapPreviewWidth,
} from '@/mobile/app/shared/utils/staticMapPreview';
import { colors, fontWeight, iconSize, radius, spacing, typography } from '@/mobile/app/shared/theme/tokens';

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

function DeferredGoogleMapView(props: SharedMapProps) {
  const { GoogleMapView } = require('@/mobile/app/shared/components/maps/GoogleMapView') as
    typeof import('@/mobile/app/shared/components/maps/GoogleMapView');
  return <GoogleMapView {...props} />;
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
        <MapPin color={colors.primary} size={iconSize.sm} />
      </View>
      <AppText numberOfLines={1} style={styles.fallbackTitle}>
        {title}
      </AppText>
      <AppText numberOfLines={1} style={styles.fallbackSubtitle}>
        {t.map.previewUnavailable}
      </AppText>
    </View>
  );
}

function MiniMapLoadingFallback() {
  return (
    <SkeletonPlaceholder
      width="100%"
      borderRadius={0}
      style={StyleSheet.absoluteFillObject as ViewStyle}
    />
  );
}

function MiniMapPreviewComponent({
  places,
  height = DEFAULT_MINI_MAP_PREVIEW_HEIGHT,
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
  const [staticPreviewLoaded, setStaticPreviewLoaded] = useState(false);
  const [focusRecoveryInstanceId, setFocusRecoveryInstanceId] = useState(0);
  const wasInteractiveMapVisibleRef = React.useRef(false);
  const placesSignature = buildPlacesSignature(places);
  // The card asks Google for a picture and then paints it with `cover`, so any
  // gap between the requested size and the painted box is cropped off the
  // edges - which is where Google puts its attribution. The same component is
  // also used inside discovery tiles that are less than half this wide, so no
  // viewport formula can be right everywhere. Ask for the box that was
  // actually laid out; the formula is only the guess made before that is known.
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const handleContainerLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setMeasuredWidth((current) => (current === nextWidth ? current : nextWidth));
  }, []);
  const previewWidth = measuredWidth || getStaticMapPreviewWidth(viewportWidth);
  const staticMapUrl = useMemo(
    () => buildStaticMapUrl(places, height, previewWidth),
    [height, places, previewWidth],
  );
  const shouldRenderInteractiveMap = interactive && isFocused;
  const shouldRenderNativePreview = shouldRenderInteractiveMap;
  const canLoadStaticPreview = loadStaticPreview && Boolean(staticMapUrl);
  const staticPreviewUri =
    !shouldRenderInteractiveMap && canLoadStaticPreview && staticPreviewReady && !staticPreviewFailed
      ? staticMapUrl
      : null;
  const effectiveInstanceId = instanceId * 1000 + focusRecoveryInstanceId;

  useEffect(() => {
    setStaticPreviewFailed(false);
    setStaticPreviewLoaded(false);
  }, [staticMapUrl, placesSignature]);

  useEffect(() => {
    if (shouldRenderInteractiveMap || !canLoadStaticPreview) {
      setStaticPreviewReady(false);
      return;
    }

    const cancelDeferredPreview = runAfterNextPaint(() => {
      setStaticPreviewReady(true);
    });

    return cancelDeferredPreview;
  }, [canLoadStaticPreview, shouldRenderInteractiveMap, staticMapUrl]);

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
    // A map that is still arriving is not a map that failed: show motion, not an apology.
    const isAwaitingPreview = Boolean(staticMapUrl) && !staticPreviewFailed && !staticPreviewLoaded;

    return (
      <View
        onLayout={handleContainerLayout}
        pointerEvents="none"
        style={[styles.container, { height }]}
      >
        <View collapsable={false} style={StyleSheet.absoluteFillObject}>
          <AppImage
            uri={staticPreviewUri}
            style={StyleSheet.absoluteFillObject}
            accessibilityLabel={t.map.previewAccessibilityLabel}
            fallback={
              isAwaitingPreview ? <MiniMapLoadingFallback /> : <MiniMapFallback places={places} />
            }
            backgroundColor={colors.mapBackground}
            showLoader={false}
            onError={() => setStaticPreviewFailed(true)}
            onLoad={() => setStaticPreviewLoaded(true)}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      onLayout={handleContainerLayout}
      pointerEvents={interactive ? 'auto' : 'none'}
      style={[styles.container, { height }]}
    >
      <View collapsable={false} style={StyleSheet.absoluteFillObject}>
        <DeferredGoogleMapView
          instanceId={effectiveInstanceId}
          places={places}
          interactive={interactive}
          liteMode={liteMode ?? !interactive}
          quietBasemap
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
    // Google prints "Map data ©…" 2-3dp from the bottom-right corner; a 16dp
    // corner clipped its last characters, and the attribution must stay legible.
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.mapBackground,
  },
  fallbackContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.mapBackground,
  },
  fallbackPin: {
    width: 30,
    height: 30,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBg,
  },
  fallbackTitle: {
    maxWidth: '88%',
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.text,
    textAlign: 'center',
  },
  fallbackSubtitle: {
    maxWidth: '88%',
    ...typography.metadataText,
    color: colors.textSoft,
    textAlign: 'center',
  },
});
