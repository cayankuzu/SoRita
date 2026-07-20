import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import Svg, { Circle, Path } from 'react-native-svg';

import type { SharedMapProps } from '@/mobile/app/shared/components/maps/SharedMapTypes';
import {
  clusterMapMarkers,
  type MapMarkerCluster,
} from '@/mobile/app/shared/components/maps/mapMarkerClustering';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

const DEFAULT_LATITUDE = 39.9334;
const DEFAULT_LONGITUDE = 32.8597;
const DEFAULT_ZOOM_DELTA = 11.5;
const SINGLE_PLACE_DELTA = 0.012;
const FIT_EDGE_PADDING = {
  top: 48,
  right: 48,
  bottom: 48,
  left: 48,
};

function clampDelta(value: number) {
  return Math.min(Math.max(value, 0.0045), 80);
}

function withOpacity(color: string, opacity: number) {
  const normalized = color.replace('#', '');

  if (normalized.length !== 6) {
    return color;
  }

  const alpha = Math.round(Math.min(Math.max(opacity, 0), 1) * 255)
    .toString(16)
    .padStart(2, '0');

  return `#${normalized}${alpha}`;
}

function getPlacesSignature(places: SharedMapProps['places']) {
  return places
    .map(
      (place, index) =>
        `${index}:${place.name}:${place.lat.toFixed(6)}:${place.lng.toFixed(6)}:${place.markerColor ?? ''}`,
    )
    .join('|');
}

function getViewportSignature(viewport: SharedMapProps['viewport']) {
  return viewport
    ? `${viewport.latitude.toFixed(6)}:${viewport.longitude.toFixed(6)}:${viewport.zoom ?? ''}`
    : 'none';
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

function MapMarkerGlyph({
  clusterCount,
  color,
  highlighted,
}: {
  clusterCount: number;
  color: string;
  highlighted: boolean;
}) {
  if (clusterCount > 1) {
    return (
      <View
        pointerEvents="none"
        style={[
          styles.clusterMarker,
          { backgroundColor: color },
          highlighted ? styles.markerShellHighlighted : null,
        ]}
      >
        <Text allowFontScaling={false} style={styles.clusterMarkerText}>
          {clusterCount > 999 ? '999+' : clusterCount}
        </Text>
      </View>
    );
  }

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      style={[styles.markerShell, highlighted ? styles.markerShellHighlighted : null]}
    >
      {/* Keep the marker bounds tight so only the visible pin is tappable. */}
      <View
        pointerEvents="none"
        style={[
          styles.markerGraphicWrap,
          highlighted ? styles.markerGraphicWrapHighlighted : null,
        ]}
      >
        <Svg width={26} height={36} viewBox="6 6 28 42">
          <Path
            d="M20 48C20 48 7.5 33.85 7.5 21.1C7.5 13.78 13.42 7.85 20.74 7.85C28.06 7.85 33.99 13.78 33.99 21.1C33.99 33.85 20 48 20 48Z"
            fill={color}
            stroke={withOpacity(colors.text, highlighted ? 0.18 : 0.1)}
            strokeWidth={1.2}
          />
          <Circle cx={20.74} cy={20.9} r={6.6} fill={colors.surface} />
          <Circle cx={17.6} cy={16.6} r={2.7} fill="rgba(255,255,255,0.22)" />
        </Svg>
      </View>
    </View>
  );
}

function GoogleMapViewComponent({
  places,
  instanceId = 0,
  interactive = true,
  liteMode = false,
  highlightedIndex = null,
  focusIndex = null,
  focusTrigger = 0,
  focusBehavior = 'zoom',
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
  const previousPlacesSignature = useRef<string | null>(null);
  const previousViewportSignature = useRef<string | null>(null);
  const previousFocusSignature = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const placesSignature = useMemo(() => getPlacesSignature(places), [places]);
  const viewportSignature = useMemo(() => getViewportSignature(viewport), [viewport]);
  const mapKey = `${interactive ? 'interactive' : 'static'}:${liteMode ? 'lite' : 'full'}:${instanceId}`;
  const initialRegion = buildRegion(places, viewport);
  const [visibleRegion, setVisibleRegion] = useState<Region>(initialRegion);
  const visibleMarkerClusters = useMemo(
    () => clusterMapMarkers(places, visibleRegion),
    [places, visibleRegion],
  );

  useEffect(() => {
    setIsReady(false);
    previousPlacesSignature.current = null;
    previousViewportSignature.current = null;
    previousFocusSignature.current = null;
  }, [mapKey]);

  const commitMarkerPress = (index: number) => {
    const now = Date.now();
    const previousPress = lastHandledMarkerPress.current;

    if (previousPress && previousPress.index === index && now - previousPress.at < 400) {
      return;
    }

    lastHandledMarkerPress.current = { index, at: now };
    lastSelectionPressAt.current = now;
    onMarkerPress?.(index);
  };

  const commitClusterPress = (cluster: MapMarkerCluster) => {
    if (cluster.memberIndices.length === 1) {
      commitMarkerPress(cluster.memberIndices[0]);
      return;
    }

    lastSelectionPressAt.current = Date.now();
    mapRef.current?.fitToCoordinates(
      cluster.memberIndices.map((index) => ({
        latitude: places[index].lat,
        longitude: places[index].lng,
      })),
      {
        animated: true,
        edgePadding: FIT_EDGE_PADDING,
      },
    );
  };

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const activeFocusIndex = focusIndex ?? highlightedIndex;

    if (activeFocusIndex != null && places[activeFocusIndex]) {
      const focusSignature = `${activeFocusIndex}:${focusTrigger}:${highlightedIndex ?? 'none'}:${placesSignature}`;

      if (previousFocusSignature.current !== focusSignature && focusBehavior !== 'none') {
        const target = places[activeFocusIndex];
        const duration = focusTrigger === 0 ? 0 : 450;

        if (focusBehavior === 'center') {
          mapRef.current?.animateCamera(
            {
              center: {
                latitude: target.lat,
                longitude: target.lng,
              },
            },
            { duration },
          );
        } else {
          mapRef.current?.animateCamera(
            {
              center: {
                latitude: target.lat,
                longitude: target.lng,
              },
              zoom: 15,
            },
            { duration },
          );
        }
      }

      previousFocusSignature.current = focusSignature;
      previousPlacesSignature.current = placesSignature;
      previousViewportSignature.current = viewportSignature;
      return;
    }

    previousFocusSignature.current = null;

    if (viewport) {
      if (previousViewportSignature.current !== viewportSignature) {
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
      }

      previousViewportSignature.current = viewportSignature;
      previousPlacesSignature.current = placesSignature;
      return;
    }

    if (previousPlacesSignature.current === placesSignature) {
      return;
    }

    if (places.length === 1) {
      mapRef.current?.animateCamera(
        {
          center: {
            latitude: places[0].lat,
            longitude: places[0].lng,
          },
          zoom: 15,
        },
        { duration: 0 },
      );
    } else if (places.length > 1) {
      mapRef.current?.fitToCoordinates(
        places.map((place) => ({
          latitude: place.lat,
          longitude: place.lng,
        })),
        {
          animated: false,
          edgePadding: FIT_EDGE_PADDING,
        },
      );
    } else {
      mapRef.current?.animateCamera(
        {
          center: {
            latitude: DEFAULT_LATITUDE,
            longitude: DEFAULT_LONGITUDE,
          },
          zoom: 11,
        },
        { duration: 0 },
      );
    }

    previousPlacesSignature.current = placesSignature;
    previousViewportSignature.current = viewportSignature;
  }, [
    focusIndex,
    focusTrigger,
    highlightedIndex,
    isReady,
    places,
    placesSignature,
    focusBehavior,
    viewport,
    viewportSignature,
  ]);

  return (
    <View collapsable={false} style={styles.container}>
      <MapView
        collapsable={false}
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
        onRegionChangeComplete={setVisibleRegion}
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
          if (!interactive || (!onMapPress && !onMarkerPress)) {
            return;
          }

          if (Date.now() - lastSelectionPressAt.current < 250) {
            return;
          }

          onMapPress?.({
            lat: event.nativeEvent.coordinate.latitude,
            lng: event.nativeEvent.coordinate.longitude,
          });
        }}
      >
        {visibleMarkerClusters.map((cluster) => {
          const isHighlighted = cluster.memberIndices.some(
            (index) => highlightedIndex === index || focusIndex === index,
          );

          return (
            <Marker
              accessibilityLabel={
                cluster.memberIndices.length > 1
                  ? tr.map.clusterMarkerLabel(cluster.memberIndices.length)
                  : places[cluster.memberIndices[0]]?.name || tr.common.place
              }
              accessibilityRole="button"
              key={cluster.memberIndices.join(':')}
              coordinate={{ latitude: cluster.lat, longitude: cluster.lng }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
              zIndex={isHighlighted ? 2 : 1}
              onPress={(event) => {
                event.stopPropagation?.();
                commitClusterPress(cluster);
              }}
            >
              <MapMarkerGlyph
                clusterCount={cluster.memberIndices.length}
                color={cluster.markerColor || colors.secondary}
                highlighted={isHighlighted}
              />
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

function areGoogleMapViewPropsEqual(previous: SharedMapProps, next: SharedMapProps) {
  return (
    previous.interactive === next.interactive &&
    previous.liteMode === next.liteMode &&
    previous.highlightedIndex === next.highlightedIndex &&
    previous.focusIndex === next.focusIndex &&
    previous.focusTrigger === next.focusTrigger &&
    previous.showUserLocation === next.showUserLocation &&
    previous.onMapGesture === next.onMapGesture &&
    previous.onMarkerPress === next.onMarkerPress &&
    previous.onPoiPress === next.onPoiPress &&
    previous.onMapPress === next.onMapPress &&
    getViewportSignature(previous.viewport) === getViewportSignature(next.viewport) &&
    getPlacesSignature(previous.places) === getPlacesSignature(next.places)
  );
}

export const GoogleMapView = React.memo(
  GoogleMapViewComponent,
  areGoogleMapViewPropsEqual,
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.mapBackground,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  markerShell: {
    width: 26,
    height: 36,
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'visible',
  },
  markerShellHighlighted: {
    transform: [{ scale: 1.08 }],
  },
  markerGraphicWrap: {
    shadowColor: colors.text,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 6,
  },
  markerGraphicWrapHighlighted: {
    shadowColor: colors.text,
    shadowOpacity: 0.26,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 5,
    },
  },
  clusterMarker: {
    alignItems: 'center',
    borderColor: colors.surface,
    borderRadius: 22,
    borderWidth: 3,
    height: 44,
    justifyContent: 'center',
    minWidth: 44,
    paddingHorizontal: 6,
  },
  clusterMarkerText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '800',
  },
});
