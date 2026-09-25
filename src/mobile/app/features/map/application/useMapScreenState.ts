import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  ExistingPlaceSelection,
  MapViewport,
  MarkerFilterOption,
  MinimizedPlacePreviewState,
  PanelData,
  PersistedMapScreenState,
} from '@/mobile/app/contracts/mapScreenState';
import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import { useCreateListMutation } from '@/mobile/app/data/hooks/useListMutations';
import { useDeletePlaceMutation } from '@/mobile/app/data/hooks/usePlaceMutations';
import {
  defaultViewport,
  findExistingPlaceMatchByCoordinates,
} from '@/mobile/app/features/map/application/mapScreenUtils';
import { useMapEditorSession } from '@/mobile/app/features/map/application/useMapEditorSession';
import {
  useMapMarkerModel,
  useOwnedMapPlaceIndex,
} from '@/mobile/app/features/map/application/useMapMarkerModel';
import { useMapPlaceSave } from '@/mobile/app/features/map/application/useMapPlaceSave';
import { useMapScreenPersistence } from '@/mobile/app/features/map/application/useMapScreenPersistence';
import { useMapSearchController } from '@/mobile/app/features/map/application/useMapSearchController';
import { useMapLocation } from '@/mobile/app/features/map/application/useMapLocation';
import { useMapScreenData } from '@/mobile/app/features/map/application/useMapScreenData';
import { reverseGeocodeLocation, type GeocodingSearchResult } from '@/mobile/app/platform/api/geocoding';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { getMarkerAggregationKey } from '@/mobile/app/shared/utils/markerColors';

type UseMapScreenStateParams = {
  user: { id: string; name: string } | null;
};

function createErrorWithCause(message: string, cause: unknown) {
  const nextError = new Error(message);
  (nextError as Error & { cause?: unknown }).cause = cause;
  return nextError;
}

export function useMapScreenState({ user }: UseMapScreenStateParams) {
  const editor = useMapEditorSession();
  const {
    clearEditor,
    editorData,
    editorDraft,
    isEditorInteractionLocked,
    minimizedEditor,
    openEditor,
    reopenMinimizedEditor,
    restoreEditor,
    setEditorData,
  } = editor;
  const [minimizedExistingPlace, setMinimizedExistingPlace] = useState<MinimizedPlacePreviewState | null>(null);
  const [selectedExistingPlace, setSelectedExistingPlace] = useState<ExistingPlaceSelection | null>(null);
  const [selectedSearchResult, setSelectedSearchResult] = useState<GeocodingSearchResult | null>(null);
  const [manualViewport, setManualViewport] = useState<MapViewport | null>(null);
  const [markerFilter, setMarkerFilter] = useState<MarkerFilterOption>('all');
  const {
    isLocating,
    locate,
    locationErrorMessage,
    locationPermissionDenied,
    locationPermissionCanAskAgain,
    resolveAddress,
    setUserViewport,
    userViewport,
  } = useMapLocation();

  const userId = user?.id;
  const {
    areMarkersLoading,
    fullDataLoading,
    fullDataRequested,
    hasVisibleDataPartialError,
    lists,
    markerError,
    markerSnapshots,
    onRefresh,
    prepareFullData: prepareFullMapData,
    refreshing,
    retry: retryLists,
    visibleDataErrorMessage,
  } = useMapScreenData(userId);
  const createListMutation = useCreateListMutation();
  const deletePlaceMutation = useDeletePlaceMutation();

  const {
    allPlaces,
    placeEntriesByLocationKey,
    selectedExistingEntries,
    selectedExistingEntry,
  } = useOwnedMapPlaceIndex(lists, selectedExistingPlace);

  // The editor and what is selected on the map close together: after a save
  // or a delete, as when the reader closes the editor.
  const clearEditorAndSelection = useCallback(() => {
    setSelectedSearchResult(null);
    setManualViewport(null);
    clearEditor();
  }, [clearEditor]);

  const openEditorPanel = useCallback(
    (data: PanelData) => {
      if (isEditorInteractionLocked) {
        return;
      }

      prepareFullMapData();
      setSelectedExistingPlace(null);
      setMinimizedExistingPlace(null);
      openEditor(data);
    },
    [isEditorInteractionLocked, openEditor, prepareFullMapData],
  );

  const openExistingPlacePanel = useCallback(
    (target: { lat: number; lng: number }) => {
      if (isEditorInteractionLocked) {
        return;
      }

      prepareFullMapData();
      setSelectedSearchResult(null);
      clearEditor();
      setMinimizedExistingPlace(null);
      setSelectedExistingPlace({ markerKey: getMarkerAggregationKey(target) });
    },
    [clearEditor, isEditorInteractionLocked, prepareFullMapData],
  );

  const {
    clearSearch,
    handleMapCenterChange,
    handleSearchQueryChange,
    handleSearchResultPress,
    hasSearched,
    isSearching,
    runSearch,
    searchErrorMessage,
    searchFocusTrigger,
    searchQuery,
    searchResults,
  } = useMapSearchController({
    allPlaces,
    onSearchIntent: prepareFullMapData,
    openEditorPanel,
    openExistingPlacePanel,
    setManualViewport,
    selectedSearchResult,
    setSelectedSearchResult,
  });

  const activeEditorPanel = editorData ?? minimizedEditor?.panel ?? null;
  const {
    activeEditorMarkerIndex,
    filterHidesEveryPin,
    interactiveMapMarkers,
    mapPlaces,
    selectedExistingMarkerColor,
    selectedSearchMarkerIndex,
  } = useMapMarkerModel({
    activeEditorPanel,
    allPlaces,
    fallbackSavedMarkers: markerSnapshots,
    lists,
    markerFilter,
    placeEntriesByLocationKey,
    selectedExistingEntry,
    selectedExistingMarkerKey: selectedExistingPlace?.markerKey,
    selectedSearchResult,
  });

  const effectiveViewport = useMemo<MapViewport | null>(
    () => manualViewport ?? (mapPlaces.length === 0 ? userViewport ?? defaultViewport : null),
    [manualViewport, mapPlaces.length, userViewport],
  );

  useEffect(() => {
    if (
      selectedExistingPlace &&
      selectedExistingEntries.length === 0 &&
      fullDataRequested &&
      !fullDataLoading
    ) {
      setSelectedExistingPlace(null);
      setManualViewport(null);
    }
  }, [
    selectedExistingEntries.length,
    selectedExistingPlace,
    fullDataLoading,
    fullDataRequested,
  ]);

  const persistedState = useMemo<PersistedMapScreenState>(
    () => ({
      editorData,
      editorDraft,
      manualViewport,
      markerFilter,
      minimizedEditor,
      minimizedExistingPlace,
      selectedExistingPlace,
      selectedSearchResult,
      userViewport,
    }),
    [
      editorData,
      editorDraft,
      manualViewport,
      markerFilter,
      minimizedEditor,
      minimizedExistingPlace,
      selectedExistingPlace,
      selectedSearchResult,
      userViewport,
    ],
  );
  const restorePersistedState = useCallback(
    (persisted: PersistedMapScreenState) => {
      restoreEditor(persisted);
      setManualViewport(persisted.manualViewport);
      setMarkerFilter(persisted.markerFilter);
      setMinimizedExistingPlace(persisted.minimizedExistingPlace);
      setSelectedExistingPlace(persisted.selectedExistingPlace);
      setSelectedSearchResult(persisted.selectedSearchResult);

      if (!userViewport && persisted.userViewport) {
        setUserViewport(persisted.userViewport);
      }
    },
    [restoreEditor, setUserViewport, userViewport],
  );
  useMapScreenPersistence({ restore: restorePersistedState, state: persistedState, userId });

  const { beginEditorSave, handleSavePlace } = useMapPlaceSave({
    editor,
    lists,
    onSaved: clearEditorAndSelection,
    user,
  });

  // The address (and, for a point of interest, the name) of a tapped point;
  // the device geocoder answers when the service has no address.
  const lookUpPoint = useCallback(
    async (lat: number, lng: number) => {
      let name: string | undefined;
      let address: string | undefined;

      try {
        const reverseResult = await reverseGeocodeLocation(lat, lng);
        name = reverseResult.isPointOfInterest ? reverseResult.name : undefined;
        address = reverseResult.address;
      } catch {
        // The device geocoder below still gives an address.
      }

      return { address: address || (await resolveAddress(lat, lng)), name };
    },
    [resolveAddress],
  );

  // Fills in the editor once the point's details arrive, unless the reader
  // has moved on to another point.
  const fillEditorPoint = useCallback(
    (lat: number, lng: number, details: { address?: string; name?: string }) => {
      setEditorData((current) =>
        !current || current.lat !== lat || current.lng !== lng
          ? current
          : {
              ...current,
              name: details.name,
              address: details.address || tr.map.addressUnavailable,
            },
      );
    },
    [setEditorData],
  );

  const handleMapPress = useCallback(
    async ({ lat, lng }: { lat: number; lng: number }) => {
      if (isEditorInteractionLocked) {
        return;
      }

      setSelectedSearchResult(null);
      openEditorPanel({ lat, lng, name: undefined, address: tr.map.resolvingAddress });
      fillEditorPoint(lat, lng, await lookUpPoint(lat, lng));
    },
    [fillEditorPoint, isEditorInteractionLocked, lookUpPoint, openEditorPanel],
  );

  const handlePoiPress = useCallback(
    async ({ lat, lng, name }: { lat: number; lng: number; name: string; placeId: string }) => {
      if (isEditorInteractionLocked) {
        return;
      }

      const matchedPlace = findExistingPlaceMatchByCoordinates(allPlaces, lat, lng);

      if (matchedPlace) {
        openExistingPlacePanel(matchedPlace.place);
        return;
      }

      setSelectedSearchResult(null);
      setManualViewport({ latitude: lat, longitude: lng, zoom: 15 });
      openEditorPanel({ lat, lng, name, address: tr.map.resolvingAddress });
      const { address } = await lookUpPoint(lat, lng);
      fillEditorPoint(lat, lng, { address, name });
    },
    [
      allPlaces,
      fillEditorPoint,
      isEditorInteractionLocked,
      lookUpPoint,
      openEditorPanel,
      openExistingPlacePanel,
    ],
  );

  const handleDeletePlace = useCallback(async (placeId: string) => {
    try {
      await deletePlaceMutation.mutateAsync(placeId);
      clearEditorAndSelection();
      showToast(tr.map.placeDeleted, 'success');
    } catch (error) {
      const message = getUserFacingErrorMessage(error, tr.map.deletePlaceUnexpected);
      showToast(message, 'error');
      throw createErrorWithCause(message, error);
    }
  }, [clearEditorAndSelection, deletePlaceMutation]);

  const handleMarkerPress = useCallback(
    (index: number) => {
      prepareFullMapData();
      if (activeEditorMarkerIndex != null && index === activeEditorMarkerIndex && minimizedEditor) {
        reopenMinimizedEditor();
        return;
      }

      if (isEditorInteractionLocked) {
        return;
      }

      if (selectedSearchMarkerIndex != null && index === selectedSearchMarkerIndex && selectedSearchResult) {
        setManualViewport({
          latitude: selectedSearchResult.lat,
          longitude: selectedSearchResult.lng,
          zoom: 15,
        });
        openEditorPanel({
          lat: selectedSearchResult.lat,
          lng: selectedSearchResult.lng,
          name: selectedSearchResult.name,
          address: selectedSearchResult.address,
        });
        return;
      }

      const targetMarker = interactiveMapMarkers[index];

      if (targetMarker?.markerKind !== 'saved' || !targetMarker.targetLocationKey) {
        return;
      }

      setSelectedSearchResult(null);
      clearEditor();
      setMinimizedExistingPlace(null);
      setSelectedExistingPlace({ markerKey: targetMarker.targetLocationKey });
    },
    [
      activeEditorMarkerIndex,
      clearEditor,
      interactiveMapMarkers,
      isEditorInteractionLocked,
      minimizedEditor,
      openEditorPanel,
      prepareFullMapData,
      reopenMinimizedEditor,
      selectedSearchMarkerIndex,
      selectedSearchResult,
    ],
  );

  const handleLocateUser = useCallback(async () => {
    await locate({
      showToastOnError: true,
      onLocated: (viewport) => {
        setManualViewport({ ...viewport, zoom: 14.5 });
      },
    });
  }, [locate]);

  const closeEditor = useCallback(() => {
    if (isEditorInteractionLocked) {
      return;
    }

    clearEditorAndSelection();
    setMinimizedExistingPlace(null);
  }, [clearEditorAndSelection, isEditorInteractionLocked]);

  const minimizeSelectedExistingPlace = useCallback(() => {
    if (!selectedExistingPlace) {
      return;
    }

    setMinimizedExistingPlace(selectedExistingPlace);
    setSelectedExistingPlace(null);
  }, [selectedExistingPlace]);

  const reopenMinimizedExistingPlace = useCallback(() => {
    if (!minimizedExistingPlace) {
      return;
    }

    setSelectedExistingPlace(minimizedExistingPlace);
    setMinimizedExistingPlace(null);
  }, [minimizedExistingPlace]);

  const createPlaceCardForSelectedLocation = useCallback(() => {
    const selectedEntry = selectedExistingEntries[0];

    if (!selectedEntry) {
      return;
    }

    openEditorPanel({
      lat: selectedEntry.place.lat,
      lng: selectedEntry.place.lng,
      name: selectedEntry.place.name,
      address: selectedEntry.place.address,
    });
  }, [openEditorPanel, selectedExistingEntries]);

  const createList = useCallback(
    async (list: PlaceList) => {
      if (!user) {
        throw new Error(tr.settings.sessionMissing);
      }

      try {
        await createListMutation.mutateAsync({ ...list, userId: user.id });
      } catch (error) {
        throw createErrorWithCause(
          getUserFacingErrorMessage(error, tr.map.createListUnexpected),
          error,
        );
      }
    },
    [createListMutation, user],
  );

  const handleMarkerFilterChange = useCallback((nextFilter: MarkerFilterOption) => {
    setMarkerFilter((current) => (current === nextFilter ? current : nextFilter));
  }, []);

  return {
    activeEditorMarkerIndex,
    activeEditorPanel,
    clearSearch,
    handleMapCenterChange,
    closeEditor,
    closeSelectedExistingPlace: () => {
      setSelectedExistingPlace(null);
      setMinimizedExistingPlace(null);
    },
    createPlaceCardForSelectedLocation,
    createList,
    editorData,
    editorDraft,
    editorFocusTrigger: editor.editorFocusTrigger,
    effectiveViewport,
    beginEditorSave,
    handleDeletePlace,
    handleLocateUser,
    handleMapPress,
    handleMarkerPress,
    handlePoiPress,
    handleSavePlace,
    handleSearchQueryChange,
    handleSearchResultPress,
    filterHidesEveryPin,
    hasMapDataPartialError:
      hasVisibleDataPartialError ||
      Boolean(markerError && mapPlaces.length > 0),
    hasSearched,
    isSearching,
    isLocating,
    isMapInitialLoading:
      areMarkersLoading && mapPlaces.length === 0,
    isEditorInteractionLocked,
    lists,
    locationErrorMessage,
    locationPermissionDenied,
    locationPermissionCanAskAgain,
    markerFilter,
    mapPlaces,
    minimizedEditor,
    minimizedExistingPlace,
    minimizeEditor: editor.minimizeEditor,
    minimizeSelectedExistingPlace,
    onRefresh,
    refreshing,
    reopenMinimizedEditor,
    reopenMinimizedExistingPlace,
    retryLists,
    retryLocation: handleLocateUser,
    setMarkerFilter: handleMarkerFilterChange,
    unlockEditorAfterSaveFailure: editor.unlockEditorAfterSaveFailure,
    runSearch,
    searchErrorMessage,
    searchFocusTrigger,
    searchQuery,
    searchResults,
    selectedExistingEntries,
    selectedExistingEntry,
    selectedExistingMarkerColor,
    selectedSearchMarkerIndex,
    visibleDataErrorMessage,
  };
}
