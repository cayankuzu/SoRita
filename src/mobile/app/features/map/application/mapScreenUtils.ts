import { createUuid } from '@/shared/utils/id';

import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import { normalizeOptionalMultilineText } from '@/mobile/app/shared/validation/contentLimits';
import type { MapMarkerItem } from '@/mobile/app/shared/utils/markerColors';
import { normalizeSearchText } from '@/mobile/app/shared/utils/textSort';

import type { MapPlaceEntry, PanelData, MapViewport } from './mapScreenTypes';

export const LIVE_SEARCH_MIN_LENGTH = 2;
export const LIVE_SEARCH_DEBOUNCE_MS = 450;
export const EXISTING_PLACE_MAP_PRESS_MAX_DISTANCE = 0.000004;

export function getMapOverlayLayout(sceneHeight: number, searchChromeHeight: number) {
  const controlBottom = 12;
  const searchTop = 10;
  const isShort = sceneHeight > 0 && sceneHeight < 560;
  const resultsBottom = isShort ? controlBottom + 56 : undefined;
  const resultsTop = isShort ? undefined : searchTop + searchChromeHeight + 6;
  const availableResultsHeight = isShort
    ? sceneHeight - (resultsBottom || 0) - 88
    : sceneHeight - (resultsTop || searchTop) - 72;

  return {
    controlBottom,
    isShort,
    resultsBottom,
    resultsMaxHeight: Math.min(324, Math.max(112, availableResultsHeight)),
    resultsTop,
    searchTop,
  };
}

export const defaultViewport: MapViewport = {
  latitude: 39.9334,
  longitude: 32.8597,
  zoom: 5.6,
};

export function normalizePlaceLabel(value?: string) {
  return normalizeSearchText(value) || undefined;
}

export function isEquivalentPlace(
  left: Pick<Place, 'id' | 'name' | 'lat' | 'lng'>,
  right: Pick<Place, 'id' | 'name' | 'lat' | 'lng'>,
) {
  if (left.id && right.id) {
    return left.id === right.id;
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
): { place: Place; list: PlaceList; distance: number } | null {
  const normalizedName = normalizePlaceLabel(rawName);
  let nearestNamedMatch: { place: Place; list: PlaceList; distance: number } | null = null;

  if (!normalizedName) {
    return null;
  }

  allPlaces.forEach((entry) => {
    const distance = Math.hypot(entry.place.lat - latitude, entry.place.lng - longitude);

    if (normalizePlaceLabel(entry.place.name) === normalizedName && distance <= 0.000025) {
      if (!nearestNamedMatch || distance < nearestNamedMatch.distance) {
        nearestNamedMatch = { ...entry, distance };
      }
    }
  });

  return nearestNamedMatch;
}

export function findExistingPlaceMatchByCoordinates(
  allPlaces: MapPlaceEntry[],
  latitude: number,
  longitude: number,
  maxDistance = 0.000018,
): { place: Place; list: PlaceList; distance: number } | null {
  let nearestMatch: { place: Place; list: PlaceList; distance: number } | null = null;

  allPlaces.forEach((entry) => {
    const distance = Math.hypot(entry.place.lat - latitude, entry.place.lng - longitude);

    if (distance <= maxDistance) {
      if (!nearestMatch || distance < nearestMatch.distance) {
        nearestMatch = { ...entry, distance };
      }
    }
  });

  return nearestMatch;
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
  const normalizedPlaceData: Omit<Place, 'id' | 'addedAt'> = {
    ...placeData,
    address: placeData.address?.trim() || undefined,
    notes: normalizeOptionalMultilineText(placeData.notes),
    title: normalizeOptionalMultilineText(placeData.title),
  };
  const changedLists: PlaceList[] = [];

  lists.forEach((list) => {
    const shouldContainPlace = selectedListIds.includes(list.id);
    const matchedPlaceIndex = sourcePlace
      ? list.places.findIndex((place) => isEquivalentPlace(place, sourcePlace))
      : -1;

    if (!shouldContainPlace && !(sourcePlace && matchedPlaceIndex >= 0)) {
      return;
    }

    let nextPlaces = list.places;
    const listMembershipChanged =
      (matchedPlaceIndex >= 0 && !shouldContainPlace) ||
      (matchedPlaceIndex < 0 && shouldContainPlace);

    if (shouldContainPlace) {
      const matchedPlace = matchedPlaceIndex >= 0 ? list.places[matchedPlaceIndex] : null;
      const nextPlace: Place = {
        ...normalizedPlaceData,
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
      updatedAt: listMembershipChanged ? nextUpdatedAt : list.updatedAt,
    });
  });

  return changedLists;
}
