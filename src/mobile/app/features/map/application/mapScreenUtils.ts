import { createUuid } from '@/shared/utils/id';

import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import type { MapMarkerItem } from '@/mobile/app/shared/utils/format';

import type { MapPlaceEntry, PanelData, MapViewport } from './mapScreenTypes';

export const LIVE_SEARCH_MIN_LENGTH = 2;
export const LIVE_SEARCH_DEBOUNCE_MS = 450;

export const defaultViewport: MapViewport = {
  latitude: 39.9334,
  longitude: 32.8597,
  zoom: 5.6,
};

export function normalizePlaceLabel(value?: string) {
  return value?.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
}

export function isEquivalentPlace(
  left: Pick<Place, 'id' | 'name' | 'lat' | 'lng'>,
  right: Pick<Place, 'id' | 'name' | 'lat' | 'lng'>,
) {
  if (left.id === right.id) {
    return true;
  }

  return (
    Math.abs(left.lat - right.lat) < 0.00001 &&
    Math.abs(left.lng - right.lng) < 0.00001 &&
    normalizePlaceLabel(left.name) === normalizePlaceLabel(right.name)
  );
}

export function findExistingPlaceMatch(
  allPlaces: MapPlaceEntry[],
  latitude: number,
  longitude: number,
  rawName?: string,
) {
  const normalizedName = normalizePlaceLabel(rawName);
  let nearestCoordinateMatch: { place: Place; list: PlaceList; distance: number } | null = null;
  let nearestNamedMatch: { place: Place; list: PlaceList; distance: number } | null = null;

  allPlaces.forEach((entry) => {
    const distance = Math.hypot(entry.place.lat - latitude, entry.place.lng - longitude);

    if (distance <= 0.00012 && (!nearestCoordinateMatch || distance < nearestCoordinateMatch.distance)) {
      nearestCoordinateMatch = { ...entry, distance };
    }

    if (normalizedName && normalizePlaceLabel(entry.place.name) === normalizedName && distance <= 0.001) {
      if (!nearestNamedMatch || distance < nearestNamedMatch.distance) {
        nearestNamedMatch = { ...entry, distance };
      }
    }
  });

  return nearestCoordinateMatch ?? nearestNamedMatch;
}

export function buildSelectedSearchMarker(
  selectedSearchResult: { lat: number; lng: number; name: string } | null,
  allPlaces: MapPlaceEntry[],
  markerColor: string,
) {
  if (!selectedSearchResult) {
    return null;
  }

  const alreadyExists = allPlaces.some(
    ({ place }) =>
      Math.abs(place.lat - selectedSearchResult.lat) < 0.00001 &&
      Math.abs(place.lng - selectedSearchResult.lng) < 0.00001,
  );

  if (alreadyExists) {
    return null;
  }

  return {
    lat: selectedSearchResult.lat,
    lng: selectedSearchResult.lng,
    name: selectedSearchResult.name,
    markerColor,
  } satisfies MapMarkerItem;
}

export function buildActiveEditorMarker(
  activeEditorPanel: PanelData | null,
  activeEditorMatchesSearchMarker: boolean,
  markerColor: string,
  fallbackName: string,
) {
  if (!activeEditorPanel || activeEditorMatchesSearchMarker) {
    return null;
  }

  return {
    lat: activeEditorPanel.lat,
    lng: activeEditorPanel.lng,
    name: activeEditorPanel.name || activeEditorPanel.existingPlace?.name || fallbackName,
    markerColor,
  } satisfies MapMarkerItem;
}

export function buildChangedListsForPlaceSave(params: {
  lists: PlaceList[];
  selectedListIds: string[];
  sourcePlace: Place | null;
  placeData: Omit<Place, 'id' | 'addedAt'>;
  user: { id: string; name: string };
}) {
  const { lists, selectedListIds, sourcePlace, placeData, user } = params;
  const nextUpdatedAt = new Date().toISOString();
  const defaultAddedAt = sourcePlace?.addedAt || new Date().toISOString();
  const defaultAddedBy = sourcePlace?.addedBy || { userId: user.id, userName: user.name };
  const changedLists: PlaceList[] = [];

  lists.forEach((list) => {
    const shouldContainPlace = selectedListIds.includes(list.id);
    const matchedPlaceIndex = list.places.findIndex((place) =>
      sourcePlace
        ? isEquivalentPlace(place, sourcePlace)
        : isEquivalentPlace(place, { ...placeData, id: 'draft-place' }),
    );

    if (!shouldContainPlace && !(sourcePlace && matchedPlaceIndex >= 0)) {
      return;
    }

    let nextPlaces = list.places;

    if (shouldContainPlace) {
      const matchedPlace = matchedPlaceIndex >= 0 ? list.places[matchedPlaceIndex] : null;
      const nextPlace: Place = {
        ...placeData,
        id: matchedPlace?.id || createUuid(),
        addedAt: matchedPlace?.addedAt || defaultAddedAt,
        updatedAt: nextUpdatedAt,
        addedBy: matchedPlace?.addedBy || defaultAddedBy,
      };

      nextPlaces =
        matchedPlaceIndex >= 0
          ? list.places.map((place, index) => (index === matchedPlaceIndex ? nextPlace : place))
          : [...list.places, nextPlace];
    } else if (matchedPlaceIndex >= 0) {
      nextPlaces = list.places.filter((_, index) => index !== matchedPlaceIndex);
    }

    changedLists.push({
      ...list,
      places: nextPlaces,
      updatedAt: nextUpdatedAt,
    });
  });

  return changedLists;
}
