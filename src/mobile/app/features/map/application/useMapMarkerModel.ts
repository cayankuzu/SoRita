import { useMemo } from 'react';

import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import type {
  ExistingPlaceSelection,
  MarkerFilterOption,
  PanelData,
} from '@/mobile/app/features/map/application/mapScreenTypes';
import {
  buildActiveEditorMarker,
  buildSelectedSearchMarker,
} from '@/mobile/app/features/map/application/mapScreenUtils';
import type { GeocodingSearchResult } from '@/mobile/app/platform/api/geocoding';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import {
  getMarkerAggregationKey,
  getMarkerColorByVisibility,
  getMarkerColorForPlaceAcrossLists,
  getMarkerVisibilityForPlaceAcrossLists,
  type MapMarkerItem,
} from '@/mobile/app/shared/utils/markerColors';

type PlaceEntry = { place: Place; list: PlaceList };
export type InteractiveMapMarker = MapMarkerItem & {
  markerKind: 'saved' | 'search' | 'editor';
  targetLocationKey?: string;
};

export function useOwnedMapPlaceIndex(
  lists: PlaceList[],
  selectedExistingPlace: ExistingPlaceSelection | null,
) {
  const allPlaces = useMemo(
    () => lists.flatMap((list) => list.places.map((place) => ({ place, list }))),
    [lists],
  );
  const placeEntriesByLocationKey = useMemo(() => {
    const groupedEntries = new Map<string, PlaceEntry[]>();

    allPlaces.forEach((entry) => {
      const markerKey = getMarkerAggregationKey(entry.place);
      const currentEntries = groupedEntries.get(markerKey);

      if (currentEntries) {
        currentEntries.push(entry);
      } else {
        groupedEntries.set(markerKey, [entry]);
      }
    });

    groupedEntries.forEach((entries, markerKey) => {
      groupedEntries.set(markerKey, sortPlaceEntriesByUpdatedAt(entries));
    });

    return groupedEntries;
  }, [allPlaces]);
  const selectedExistingEntries = useMemo(() => {
    if (!selectedExistingPlace) {
      return [];
    }

    return placeEntriesByLocationKey.get(selectedExistingPlace.markerKey) || [];
  }, [placeEntriesByLocationKey, selectedExistingPlace]);

  return {
    allPlaces,
    placeEntriesByLocationKey,
    selectedExistingEntries,
    selectedExistingEntry: selectedExistingEntries[0] || null,
  };
}

type UseMapMarkerModelParams = {
  activeEditorPanel: PanelData | null;
  allPlaces: PlaceEntry[];
  fallbackSavedMarkers?: InteractiveMapMarker[];
  lists: PlaceList[];
  markerFilter: MarkerFilterOption;
  placeEntriesByLocationKey: Map<string, PlaceEntry[]>;
  selectedExistingEntry: PlaceEntry | null;
  selectedExistingMarkerKey?: string | null;
  selectedSearchResult: GeocodingSearchResult | null;
};

export function useMapMarkerModel({
  activeEditorPanel,
  allPlaces,
  fallbackSavedMarkers = [],
  lists,
  markerFilter,
  placeEntriesByLocationKey,
  selectedExistingEntry,
  selectedExistingMarkerKey,
  selectedSearchResult,
}: UseMapMarkerModelParams) {
  const savedMapMarkers = useMemo<InteractiveMapMarker[]>(
    () =>
      Array.from(placeEntriesByLocationKey.entries()).reduce<InteractiveMapMarker[]>(
        (markers, [markerKey, entries]) => {
          const primaryEntry = entries[0];

          if (!primaryEntry) {
            return markers;
          }

          const markerVisibility = getMarkerVisibilityForPlaceAcrossLists(
            primaryEntry.place,
            lists,
            primaryEntry.list.isPublic,
          );
          markers.push({
            lat: primaryEntry.place.lat,
            lng: primaryEntry.place.lng,
            name: primaryEntry.place.name,
            markerColor: getMarkerColorByVisibility(markerVisibility),
            markerVisibility,
            markerKind: 'saved',
            targetLocationKey: markerKey,
          });
          return markers;
        },
        [],
      ),
    [lists, placeEntriesByLocationKey],
  );
  const filteredSavedMapMarkers = useMemo(() => {
    const availableMarkers = savedMapMarkers.length > 0
      ? savedMapMarkers
      : fallbackSavedMarkers;

    if (markerFilter === 'none') {
      return [];
    }

    return markerFilter === 'all'
      ? availableMarkers
      : availableMarkers.filter((marker) => marker.markerVisibility === markerFilter);
  }, [fallbackSavedMarkers, markerFilter, savedMapMarkers]);
  const selectedSearchMarker = useMemo<InteractiveMapMarker | null>(() => {
    const marker = buildSelectedSearchMarker(selectedSearchResult, allPlaces, colors.markerDraft);
    return marker ? { ...marker, markerKind: 'search' } : null;
  }, [allPlaces, selectedSearchResult]);
  const activeEditorMatchesSearchMarker = useMemo(
    () =>
      Boolean(
        activeEditorPanel &&
          selectedSearchMarker &&
          Math.abs(activeEditorPanel.lat - selectedSearchMarker.lat) < 0.00001 &&
          Math.abs(activeEditorPanel.lng - selectedSearchMarker.lng) < 0.00001,
      ),
    [activeEditorPanel, selectedSearchMarker],
  );
  const activeEditorMarker = useMemo<InteractiveMapMarker | null>(() => {
    const marker = buildActiveEditorMarker(
      activeEditorPanel,
      activeEditorMatchesSearchMarker,
      colors.markerDraft,
      tr.placeEditor.minimizedNewTitle,
    );
    return marker ? { ...marker, markerKind: 'editor' } : null;
  }, [activeEditorMatchesSearchMarker, activeEditorPanel]);
  const interactiveMapMarkers = useMemo<InteractiveMapMarker[]>(
    () => [
      ...filteredSavedMapMarkers,
      ...(selectedSearchMarker ? [selectedSearchMarker] : []),
      ...(activeEditorMarker ? [activeEditorMarker] : []),
    ],
    [activeEditorMarker, filteredSavedMapMarkers, selectedSearchMarker],
  );
  const selectedSearchMarkerIndex = useMemo(() => {
    const index = interactiveMapMarkers.findIndex((marker) => marker.markerKind === 'search');
    return index >= 0 ? index : null;
  }, [interactiveMapMarkers]);
  const activeEditorMarkerIndex = useMemo(() => {
    const index = interactiveMapMarkers.findIndex((marker) => marker.markerKind === 'editor');

    if (index >= 0) {
      return index;
    }

    return activeEditorPanel && activeEditorMatchesSearchMarker
      ? selectedSearchMarkerIndex
      : null;
  }, [
    activeEditorMatchesSearchMarker,
    activeEditorPanel,
    interactiveMapMarkers,
    selectedSearchMarkerIndex,
  ]);
  const selectedExistingMarkerColor = useMemo(
    () => {
      if (selectedExistingEntry) {
        return getMarkerColorForPlaceAcrossLists(
            selectedExistingEntry.place,
            lists,
            selectedExistingEntry.list.isPublic,
          );
      }

      return fallbackSavedMarkers.find(
        (marker) => marker.targetLocationKey === selectedExistingMarkerKey,
      )?.markerColor;
    },
    [fallbackSavedMarkers, lists, selectedExistingEntry, selectedExistingMarkerKey],
  );

  return {
    activeEditorMarkerIndex,
    activeEditorMatchesSearchMarker,
    interactiveMapMarkers,
    mapPlaces: interactiveMapMarkers as MapMarkerItem[],
    selectedExistingMarkerColor,
    selectedSearchMarkerIndex,
  };
}

function sortPlaceEntriesByUpdatedAt(entries: PlaceEntry[]) {
  return [...entries].sort(
    (left, right) =>
      new Date(right.place.updatedAt || right.place.addedAt).getTime() -
      new Date(left.place.updatedAt || left.place.addedAt).getTime(),
  );
}
