import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

import type { SharedMapProps } from '@/mobile/app/shared/components/maps/SharedMapTypes';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

const DEFAULT_LATITUDE = 39.9334;
const DEFAULT_LONGITUDE = 32.8597;
const DEFAULT_ZOOM_DELTA = 11.5;
const SINGLE_PLACE_DELTA = 0.012;

function clampDelta(value: number) {
  return Math.min(Math.max(value, 0.0045), 80);
}

function buildRegion(places: SharedMapProps['places'], viewport: SharedMapProps['viewport']): Region {
  if (viewport) {
    const delta = viewport.zoom ? Math.max(0.0045, 16 / Math.max(viewport.zoom, 1)) : 0.018;

    return {
      latitude: viewport.latitude,
      longitude: viewport.longitude,
      latitudeDelta: clampDelta(delta),
      longitudeDelta: clampDelta(delta),
    };
  }

  if (places.length === 1) {
    return {
      latitude: places[0].lat,
      longitude: places[0].lng,
      latitudeDelta: SINGLE_PLACE_DELTA,
      longitudeDelta: SINGLE_PLACE_DELTA,
    };
  }

  if (places.length > 1) {
    const latitudes = places.map((place) => place.lat);
    const longitudes = places.map((place) => place.lng);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: clampDelta((maxLat - minLat) * 1.65 || SINGLE_PLACE_DELTA),
      longitudeDelta: clampDelta((maxLng - minLng) * 1.65 || SINGLE_PLACE_DELTA),
    };
  }

  return {
    latitude: DEFAULT_LATITUDE,
    longitude: DEFAULT_LONGITUDE,
    latitudeDelta: DEFAULT_ZOOM_DELTA,
    longitudeDelta: DEFAULT_ZOOM_DELTA,
  };
}

export function GoogleMapView({
  places,
  interactive = true,
  liteMode = false,
  highlightedIndex = null,
  focusIndex = null,
  focusTrigger = 0,
  viewport = null,
  showUserLocation = false,
  onMapGesture,
  onMarkerPress,
  onPoiPress,
  onMapPress,
}: SharedMapProps) {
  const mapRef = useRef<MapView>(null);
  const lastSelectionPressAt = useRef(0);
  const lastHandledMarkerPress = useRef<{ index: number; at: number } | null>(null);
  const previousFocusTrigger = useRef<number | null>(null);
  const previousHighlightedIndex = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const placesSignature = places
    .map(
      (place, index) =>
        `${index}:${place.name}:${place.lat.toFixed(6)}:${place.lng.toFixed(6)}:${place.markerColor ?? ''}`,
    )
    .join('|');
  const viewportSignature = viewport
    ? `${viewport.latitude.toFixed(6)}:${viewport.longitude.toFixed(6)}:${viewport.zoom ?? ''}`
    : 'none';
  const mapKey = `${interactive ? 'interactive' : 'static'}:${liteMode ? 'lite' : 'full'}:${placesSignature}:${viewportSignature}`;
  const initialRegion = buildRegion(places, viewport);

  useEffect(() => {
    setIsReady(false);
    previousFocusTrigger.current = null;
    previousHighlightedIndex.current = null;
  }, [mapKey]);

  const handleMarkerPress = (index: number) => {
    const now = Date.now();
    const previousPress = lastHandledMarkerPress.current;

    if (previousPress && previousPress.index === index && now - previousPress.at < 400) {
      return;
    }

    lastHandledMarkerPress.current = { index, at: now };
    lastSelectionPressAt.current = now;
    onMarkerPress?.(index);
  };

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const activeFocusIndex = focusIndex ?? highlightedIndex;

    if (activeFocusIndex != null && places[activeFocusIndex]) {
      const shouldAnimate =
        previousFocusTrigger.current !== focusTrigger ||
        previousHighlightedIndex.current !== highlightedIndex;

      if (shouldAnimate) {
        const target = places[activeFocusIndex];
        mapRef.current?.animateCamera(
          {
            center: {
              latitude: target.lat,
              longitude: target.lng,
            },
            zoom: 15,
          },
          {
            duration: focusTrigger === 0 ? 0 : 450,
          },
        );
        previousFocusTrigger.current = focusTrigger;
        previousHighlightedIndex.current = highlightedIndex;
      }

      return;
    }

    if (viewport) {
      mapRef.current?.animateCamera(
        {
          center: {
            latitude: viewport.latitude,
            longitude: viewport.longitude,
          },
          zoom: viewport.zoom ?? 13.5,
        },
        { duration: 450 },
      );
      return;
    }
  }, [focusIndex, focusTrigger, highlightedIndex, isReady, places, viewport]);

  return (
    <View style={styles.container}>
      <MapView
        key={mapKey}
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        liteMode={liteMode}
        cacheEnabled={!interactive}
        mapType="standard"
        initialRegion={initialRegion}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        poiClickEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        onPanDrag={() => {
          if (!interactive) {
            return;
          }

          onMapGesture?.();
        }}
        onMapReady={() => setIsReady(true)}
        onPoiClick={(event) => {
          if (!interactive || !onPoiPress) {
            return;
          }

          lastSelectionPressAt.current = Date.now();
          onPoiPress({
            lat: event.nativeEvent.coordinate.latitude,
            lng: event.nativeEvent.coordinate.longitude,
            name: event.nativeEvent.name,
            placeId: event.nativeEvent.placeId,
          });
        }}
        onPress={(event) => {
          if (!interactive || !onMapPress) {
            return;
          }

          if (Date.now() - lastSelectionPressAt.current < 250) {
            return;
          }

          onMapPress({
            lat: event.nativeEvent.coordinate.latitude,
            lng: event.nativeEvent.coordinate.longitude,
          });
        }}
      >
        {places.map((place, index) => {
          return (
            <Marker
              key={`${place.name}-${place.lat}-${place.lng}-${index}`}
              coordinate={{ latitude: place.lat, longitude: place.lng }}
              title={place.name}
              pinColor={place.markerColor || colors.secondary}
              zIndex={highlightedIndex === index || focusIndex === index ? 2 : 1}
              onSelect={() => {
                handleMarkerPress(index);
              }}
              onPress={(event) => {
                event.stopPropagation?.();
                handleMarkerPress(index);
              }}
            />
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: '#ebe7de',
  },
  map: {
    flex: 1,
  },
});
