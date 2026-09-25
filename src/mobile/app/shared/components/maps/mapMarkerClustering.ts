import type { Region } from 'react-native-maps';

import type { MapMarkerItem } from '@/mobile/app/shared/utils/markerColors';
import { tr } from '@/mobile/app/shared/i18n/tr';

export const MAX_RENDERED_MAP_MARKERS = 100;

export type MapMarkerCluster = {
  lat: number;
  lng: number;
  markerColor?: string;
  memberIndices: number[];
  name: string;
};

function isInsideRegion(place: MapMarkerItem, region: Region) {
  const latitudeRadius = region.latitudeDelta * 0.55;
  const longitudeRadius = region.longitudeDelta * 0.55;

  return (
    Math.abs(place.lat - region.latitude) <= latitudeRadius &&
    Math.abs(place.lng - region.longitude) <= longitudeRadius
  );
}

function toSingleMarker(place: MapMarkerItem, index: number): MapMarkerCluster {
  return {
    lat: place.lat,
    lng: place.lng,
    markerColor: place.markerColor,
    memberIndices: [index],
    name: place.name,
  };
}

// Zoomed out past a district, pins a few streets apart draw on top of each
// other: three Istanbul places read as one pin that only the top one of could
// be tapped. From that zoom out, a 12-cell grid (about 30dp a cell on a phone)
// merges them into one counted marker, which zooms in when tapped. Closer in,
// every place keeps its own pin.
const PROXIMITY_CLUSTER_LATITUDE_DELTA = 0.05;
const PROXIMITY_GRID_SIDE = 12;

/**
 * Bounds native marker work to a fixed budget and keeps nearby pins from
 * stacking. Dense viewports are reduced to a deterministic 10x10 grid,
 * zoomed-out viewports to a 12x12 one; close-up viewports keep one marker per
 * place.
 */
export function clusterMapMarkers(
  places: MapMarkerItem[],
  region: Region,
  maxMarkers = MAX_RENDERED_MAP_MARKERS,
): MapMarkerCluster[] {
  if (maxMarkers < 1) {
    return [];
  }

  const visibleEntries = places
    .map((place, index) => ({ index, place }))
    .filter(({ place }) => isInsideRegion(place, region));
  const overBudget = visibleEntries.length > maxMarkers;

  if (!overBudget && region.latitudeDelta < PROXIMITY_CLUSTER_LATITUDE_DELTA) {
    return visibleEntries.map(({ index, place }) => toSingleMarker(place, index));
  }

  const gridSide = overBudget
    ? Math.max(1, Math.floor(Math.sqrt(maxMarkers)))
    : PROXIMITY_GRID_SIDE;
  const latitudeMin = region.latitude - region.latitudeDelta / 2;
  const longitudeMin = region.longitude - region.longitudeDelta / 2;
  const latitudeStep = region.latitudeDelta / gridSide;
  const longitudeStep = region.longitudeDelta / gridSide;
  const buckets = new Map<string, Array<{ index: number; place: MapMarkerItem }>>();

  for (const entry of visibleEntries) {
    const row = Math.min(
      gridSide - 1,
      Math.max(0, Math.floor((entry.place.lat - latitudeMin) / latitudeStep)),
    );
    const column = Math.min(
      gridSide - 1,
      Math.max(0, Math.floor((entry.place.lng - longitudeMin) / longitudeStep)),
    );
    const key = `${row}:${column}`;
    const bucket = buckets.get(key) || [];

    bucket.push(entry);
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values())
    .map((bucket): MapMarkerCluster => ({
      lat: bucket.reduce((sum, entry) => sum + entry.place.lat, 0) / bucket.length,
      lng: bucket.reduce((sum, entry) => sum + entry.place.lng, 0) / bucket.length,
      markerColor: bucket[0].place.markerColor,
      memberIndices: bucket.map((entry) => entry.index),
      name: bucket.length === 1 ? bucket[0].place.name : tr.map.clusterMarkerLabel(bucket.length),
    }))
    .sort((left, right) => left.memberIndices[0] - right.memberIndices[0]);
}
