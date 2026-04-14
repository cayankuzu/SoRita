import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { env } from '@/mobile/app/platform/config/env';
import { AppMapView } from '@/mobile/app/shared/components/maps/AppMapView';
import type { MapMarkerItem } from '@/mobile/app/shared/utils/format';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type MiniMapPreviewProps = {
  places: MapMarkerItem[];
  height?: number;
  interactive?: boolean;
  liteMode?: boolean;
  onMapGesture?: () => void;
  onMarkerPress?: (index: number) => void;
  highlightedIndex?: number | null;
  focusIndex?: number | null;
  focusTrigger?: number;
};

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
  if (!env.googleMapsApiKey || places.length === 0) {
    return null;
  }

  const params = new URLSearchParams();
  params.set('size', `640x${Math.max(240, Math.round(height * 2.6))}`);
  params.set('scale', '2');
  params.set('maptype', 'roadmap');
  params.set('key', env.googleMapsApiKey);

  if (places.length === 1) {
    params.set('center', `${places[0].lat},${places[0].lng}`);
    params.set('zoom', '15');
  } else {
    params.set('visible', places.map((place) => `${place.lat},${place.lng}`).join('|'));
  }

  places.slice(0, 8).forEach((place) => {
    params.append(
      'markers',
      `color:${toStaticMapColor(place.markerColor)}|${place.lat},${place.lng}`,
    );
  });

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

export function MiniMapPreview({
  places,
  height = 148,
  interactive = false,
  liteMode,
  onMapGesture,
  onMarkerPress,
  highlightedIndex = null,
  focusIndex = null,
  focusTrigger = 0,
}: MiniMapPreviewProps) {
  const [staticPreviewFailed, setStaticPreviewFailed] = useState(false);
  const placesSignature = places
    .map(
      (place, index) =>
        `${index}:${place.name}:${place.lat.toFixed(6)}:${place.lng.toFixed(6)}:${place.markerColor ?? ''}`,
    )
    .join('|');
  const staticMapUrl = useMemo(() => buildStaticMapUrl(places, height), [height, placesSignature]);
  const shouldUseStaticPreview = !interactive && Boolean(staticMapUrl) && !staticPreviewFailed;

  useEffect(() => {
    setStaticPreviewFailed(false);
  }, [staticMapUrl, placesSignature]);

  return (
    <View pointerEvents={interactive ? 'auto' : 'none'} style={[styles.container, { height }]}>
      {shouldUseStaticPreview ? (
        <Image
          source={{ uri: staticMapUrl! }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          onError={() => setStaticPreviewFailed(true)}
        />
      ) : (
        <AppMapView
          key={`mini-map:${interactive ? 'interactive' : 'static'}:${placesSignature}:${height}`}
          places={places}
          interactive={interactive}
          liteMode={liteMode ?? !interactive}
          onMapGesture={onMapGesture}
          onMarkerPress={onMarkerPress}
          highlightedIndex={highlightedIndex}
          focusIndex={focusIndex}
          focusTrigger={focusTrigger}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: '#ebe7de',
  },
});
