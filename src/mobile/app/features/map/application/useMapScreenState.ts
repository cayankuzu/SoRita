import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAppProgressBanner } from '@/mobile/app/app-shell/feedback/AppProgressBanner';
import { rootNavigationRef } from '@/mobile/app/app-shell/navigation/navigationRef';
import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import {
  useCreateListMutation,
  useUpdateListsMutation,
} from '@/mobile/app/data/hooks/useListMutations';
import { useDeletePlaceMutation } from '@/mobile/app/data/hooks/usePlaceMutations';
import type {
  ExistingPlaceSelection,
  MapViewport,
  MarkerFilterOption,
  MinimizedEditorState,
  MinimizedPlacePreviewState,
  PanelData,
} from '@/mobile/app/features/map/application/mapScreenTypes';
import {
  buildChangedListsForPlaceSave,
  defaultViewport,
  findExistingPlaceMatchByCoordinates,
} from '@/mobile/app/features/map/application/mapScreenUtils';
import {
  useMapMarkerModel,
  useOwnedMapPlaceIndex,
} from '@/mobile/app/features/map/application/useMapMarkerModel';
import { useMapSearchController } from '@/mobile/app/features/map/application/useMapSearchController';
import { useMapLocation } from '@/mobile/app/features/map/application/useMapLocation';
import { useMapScreenData } from '@/mobile/app/features/map/application/useMapScreenData';
import type { PlaceEditorDraft } from '@/mobile/app/features/map/application/placeEditorDraft';
import type {
  PlaceEditorSaveOptions,
  PlaceEditorSaveSessionConfig,
} from '@/mobile/app/features/map/application/placeEditorSaveTypes';
import { reverseGeocodeLocation, type GeocodingSearchResult } from '@/mobile/app/platform/api/geocoding';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import {
  getPersistedMapScreenState,
  savePersistedMapScreenState,
} from '@/mobile/app/platform/storage/mapScreenState';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { getMarkerAggregationKey } from '@/mobile/app/shared/utils/markerColors';
import { isAbortError } from '@/mobile/app/shared/utils/abort';

type UseMapScreenStateParams = {
  user: { id: string; name: string } | null;
};

type PendingPlaceSaveRequest = {
  draft: PlaceEditorDraft | null;
  placeData: Omit<Place, 'id' | 'addedAt'>;
  sourcePlace: Place | null;
  targetListIds: string[];
};

function createErrorWithCause(message: string, cause: unknown) {
  const nextError = new Error(message);
  (nextError as Error & { cause?: unknown }).cause = cause;
  return nextError;
}

export function useMapScreenState({ user }: UseMapScreenStateParams) {
  const { beginProgress } = useAppProgressBanner();
  const hasRestoredPersistedStateRef = useRef(false);
  const activeSaveAbortControllerRef = useRef<AbortController | null>(null);
  const activeSaveDraftRef = useRef<PlaceEditorDraft | null>(null);
  const activeSaveSourcePlaceRef = useRef<Place | null>(null);
  const minimizedEditorRef = useRef<MinimizedEditorState | null>(null);
  const pendingPlaceSaveRequestRef = useRef<PendingPlaceSaveRequest | null>(null);
  const [editorData, setEditorData] = useState<PanelData | null>(null);
  const [editorDraft, setEditorDraft] = useState<PlaceEditorDraft | null>(null);
  const [isEditorInteractionLocked, setIsEditorInteractionLocked] = useState(false);
  const [minimizedEditor, setMinimizedEditor] = useState<MinimizedEditorState | null>(null);
  const [minimizedExistingPlace, setMinimizedExistingPlace] = useState<MinimizedPlacePreviewState | null>(null);
  const [selectedExistingPlace, setSelectedExistingPlace] = useState<ExistingPlaceSelection | null>(null);
  const [selectedSearchResult, setSelectedSearchResult] = useState<GeocodingSearchResult | null>(null);
  const [manualViewport, setManualViewport] = useState<MapViewport | null>(null);
  const [markerFilter, setMarkerFilter] = useState<MarkerFilterOption>('all');
  const [editorFocusTrigger, setEditorFocusTrigger] = useState(0);
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

  useEffect(() => {
    minimizedEditorRef.current = minimizedEditor;
  }, [minimizedEditor]);

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
    prepareFullData,
    refreshing,
    retry: retryLists,
    visibleDataErrorMessage,
  } = useMapScreenData(userId);
  const createListMutation = useCreateListMutation();
  const updateListsMutation = useUpdateListsMutation();
  const deletePlaceMutation = useDeletePlaceMutation();
  const prepareFullMapData = prepareFullData;

  const {
    allPlaces,
    placeEntriesByLocationKey,
    selectedExistingEntries,
    selectedExistingEntry,
  } = useOwnedMapPlaceIndex(lists, selectedExistingPlace);

  const openEditorPanel = useCallback(
    (data: PanelData) => {
      if (isEditorInteractionLocked) {
        return;
      }

      prepareFullMapData();
      setSelectedExistingPlace(null);
      setMinimizedExistingPlace(null);
      setMinimizedEditor(null);
      setEditorDraft(null);
      setIsEditorInteractionLocked(false);
      setEditorData(data);
      setEditorFocusTrigger((current) => current + 1);
    },
    [isEditorInteractionLocked, prepareFullMapData],
  );

  const openExistingPlacePanel = useCallback(
    (target: { lat: number; lng: number }) => {
      if (isEditorInteractionLocked) {
        return;
      }

      prepareFullMapData();
      setSelectedSearchResult(null);
      setEditorData(null);
      setEditorDraft(null);
      setIsEditorInteractionLocked(false);
      setMinimizedEditor(null);
      setMinimizedExistingPlace(null);
      setSelectedExistingPlace({
        markerKey: getMarkerAggregationKey(target),
      });
    },
    [isEditorInteractionLocked, prepareFullMapData],
  );

  const resetManualViewport = useCallback(() => {
    setManualViewport(null);
  }, []);

  const {
    clearSearch,
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

  useEffect(() => {
    if (!userId || hasRestoredPersistedStateRef.current) {
      return;
    }

    let active = true;

    void getPersistedMapScreenState(userId)
      .then((persistedState) => {
        if (!active || !persistedState) {
          hasRestoredPersistedStateRef.current = true;
          return;
        }

        setEditorData(persistedState.editorData);
        setEditorDraft(persistedState.editorDraft);
        setManualViewport(persistedState.manualViewport);
        setMarkerFilter(persistedState.markerFilter);
        setMinimizedEditor(persistedState.minimizedEditor);
        setMinimizedExistingPlace(persistedState.minimizedExistingPlace);
        setSelectedExistingPlace(persistedState.selectedExistingPlace);
        setSelectedSearchResult(persistedState.selectedSearchResult);

        if (!userViewport && persistedState.userViewport) {
          setUserViewport(persistedState.userViewport);
        }

        hasRestoredPersistedStateRef.current = true;
      })
      .catch((error) => {
        logger.warn('map', 'Failed to restore persisted map screen state', error);
        hasRestoredPersistedStateRef.current = true;
      });

    return () => {
      active = false;
    };
  }, [setUserViewport, userId, userViewport]);

  useEffect(() => {
    if (!userId || !hasRestoredPersistedStateRef.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void savePersistedMapScreenState(userId, {
        editorData,
        editorDraft,
        manualViewport,
        markerFilter,
        minimizedEditor,
        minimizedExistingPlace,
        selectedExistingPlace,
        selectedSearchResult,
        userViewport,
      }).catch((error) => {
        logger.warn('map', 'Failed to persist map screen state', error);
      });
    }, 180);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    editorData,
    editorDraft,
    manualViewport,
    markerFilter,
    minimizedEditor,
    minimizedExistingPlace,
    selectedExistingPlace,
    selectedSearchResult,
    userId,
    userViewport,
  ]);

  const updateEditorData = useCallback((updater: (current: PanelData | null) => PanelData | null) => {
    setEditorData((current) => updater(current));
  }, []);

  const openPendingSaveTarget = useCallback(() => {
    if (rootNavigationRef.isReady()) {
      rootNavigationRef.navigate('MainTabs', { screen: 'Map' });
    }

    const nextMinimizedEditor = minimizedEditorRef.current;

    if (!nextMinimizedEditor) {
      return;
    }

    setEditorData(nextMinimizedEditor.panel);
    setMinimizedEditor(null);
    setEditorFocusTrigger((current) => current + 1);
  }, []);

  const cancelActiveSave = useCallback(() => {
    activeSaveAbortControllerRef.current?.abort();
    activeSaveAbortControllerRef.current = null;
    pendingPlaceSaveRequestRef.current = null;
    setIsEditorInteractionLocked(false);
  }, []);

  const performPlaceSave = useCallback(
    async (
      request: PendingPlaceSaveRequest,
      options?: PlaceEditorSaveOptions,
    ) => {
      if (!user) {
        return;
      }

      const selectedListIds = Array.from(new Set(request.targetListIds));
      const changedLists = buildChangedListsForPlaceSave({
        lists,
        selectedListIds,
        sourcePlace: request.sourcePlace,
        placeData: request.placeData,
        user,
      });

      pendingPlaceSaveRequestRef.current = request;

      try {
        await updateListsMutation.mutateAsync({
          abortSignal: options?.abortSignal,
          lists: changedLists,
          onProgress: options?.onProgress,
          previousLists: lists,
        });
        setSelectedSearchResult(null);
        setManualViewport(null);
        setEditorData(null);
        setEditorDraft(null);
        setIsEditorInteractionLocked(false);
        setMinimizedEditor(null);
        activeSaveAbortControllerRef.current = null;
        activeSaveDraftRef.current = null;
        activeSaveSourcePlaceRef.current = null;
        pendingPlaceSaveRequestRef.current = null;
        showToast(tr.map.placeSaved, 'success');
      } catch (error) {
        setIsEditorInteractionLocked(false);
        activeSaveAbortControllerRef.current = null;

        if (isAbortError(error)) {
          throw error;
        }

        throw error;
      }
    },
    [lists, updateListsMutation, user],
  );

  const retryPendingSave = useCallback(() => {
    const pendingRequest = pendingPlaceSaveRequestRef.current;

    if (!pendingRequest) {
      return;
    }

    const abortController = new AbortController();
    activeSaveAbortControllerRef.current = abortController;
    setIsEditorInteractionLocked(true);

    const progressSession = beginProgress({
      detail: tr.placeEditor.saveProgressLists(
        new Set(pendingRequest.targetListIds).size,
      ),
      onCancel: cancelActiveSave,
      onOpen: openPendingSaveTarget,
    });

    void performPlaceSave(pendingRequest, {
      abortSignal: abortController.signal,
      onProgress: progressSession.setProgress,
    })
      .then(() => {
        progressSession.complete();
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return;
        }

        progressSession.fail({
          onCancel: cancelActiveSave,
          onOpen: openPendingSaveTarget,
          onRetry: retryPendingSave,
        });
        showToast(getUserFacingErrorMessage(error, tr.map.savePlaceUnexpected), 'error');
      })
      .finally(() => {
        progressSession.end();
      });
  }, [beginProgress, cancelActiveSave, openPendingSaveTarget, performPlaceSave]);

  const handleMapPress = useCallback(
    async ({ lat, lng }: { lat: number; lng: number }) => {
      if (isEditorInteractionLocked) {
        return;
      }

      setSelectedSearchResult(null);

      openEditorPanel({
        lat,
        lng,
        name: undefined,
        address: tr.map.resolvingAddress,
      });

      let resolvedName: string | undefined;
      let resolvedAddress: string | undefined;

      try {
        const reverseResult = await reverseGeocodeLocation(lat, lng);
        resolvedName = reverseResult.isPointOfInterest ? reverseResult.name : undefined;
        resolvedAddress = reverseResult.address;
      } catch {
        resolvedName = undefined;
        resolvedAddress = undefined;
      }

      if (!resolvedAddress) {
        resolvedAddress = await resolveAddress(lat, lng);
      }

      setEditorData((current) => {
        if (!current || current.lat !== lat || current.lng !== lng) {
          return current;
        }

        return {
          ...current,
          name: resolvedName,
          address: resolvedAddress || tr.map.addressUnavailable,
        };
      });
    },
    [isEditorInteractionLocked, openEditorPanel, resolveAddress],
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
      setManualViewport({
        latitude: lat,
        longitude: lng,
        zoom: 15,
      });
      openEditorPanel({
        lat,
        lng,
        name,
        address: tr.map.resolvingAddress,
      });

      let resolvedAddress: string | undefined;

      try {
        const reverseResult = await reverseGeocodeLocation(lat, lng);
        resolvedAddress = reverseResult.address;
      } catch {
        resolvedAddress = undefined;
      }

      if (!resolvedAddress) {
        resolvedAddress = await resolveAddress(lat, lng);
      }

      updateEditorData((current) => {
        if (!current || current.lat !== lat || current.lng !== lng) {
          return current;
        }

        return {
          ...current,
          name: name || current.name,
          address: resolvedAddress || tr.map.addressUnavailable,
        };
      });
    },
    [
      allPlaces,
      isEditorInteractionLocked,
      openEditorPanel,
      openExistingPlacePanel,
      resolveAddress,
      updateEditorData,
    ],
  );

  const beginEditorSave = useCallback(
    (draft: PlaceEditorDraft): PlaceEditorSaveSessionConfig => {
      if (!editorData) {
        return {
          onBannerCancel: cancelActiveSave,
          onBannerOpen: openPendingSaveTarget,
          onBannerRetry: retryPendingSave,
        };
      }

      const abortController = new AbortController();
      activeSaveAbortControllerRef.current = abortController;
      activeSaveDraftRef.current = draft;
      activeSaveSourcePlaceRef.current = editorData.existingPlace || null;
      pendingPlaceSaveRequestRef.current = null;
      setEditorDraft(draft);
      setMinimizedEditor({ panel: editorData, draft });
      setEditorData(null);
      setIsEditorInteractionLocked(true);
      setEditorFocusTrigger((current) => current + 1);

      return {
        abortSignal: abortController.signal,
        onBannerCancel: cancelActiveSave,
        onBannerOpen: openPendingSaveTarget,
        onBannerRetry: retryPendingSave,
      };
    },
    [cancelActiveSave, editorData, openPendingSaveTarget, retryPendingSave],
  );

  const unlockEditorAfterSaveFailure = useCallback((draft?: PlaceEditorDraft) => {
    setIsEditorInteractionLocked(false);

    if (!draft) {
      return;
    }

    setEditorDraft(draft);
    if (editorData) {
      return;
    }

    const panel = minimizedEditor?.panel;

    if (!panel) {
      return;
    }

    setMinimizedEditor({
      panel,
      draft,
    });
  }, [editorData, minimizedEditor]);

  const handleSavePlace = useCallback(
    async (
      placeData: Omit<Place, 'id' | 'addedAt'>,
      targetListIds: string[],
      options?: PlaceEditorSaveOptions,
    ) => {
      await performPlaceSave(
        {
          draft: activeSaveDraftRef.current,
          placeData,
          sourcePlace: activeSaveSourcePlaceRef.current,
          targetListIds,
        },
        options,
      );
    },
    [performPlaceSave],
  );

  const handleDeletePlace = useCallback(async (placeId: string) => {
    try {
      await deletePlaceMutation.mutateAsync(placeId);
      setSelectedSearchResult(null);
      setManualViewport(null);
      setEditorData(null);
      setEditorDraft(null);
      setIsEditorInteractionLocked(false);
      setMinimizedEditor(null);
      showToast(tr.map.placeDeleted, 'success');
    } catch (error) {
      showToast(
        getUserFacingErrorMessage(error, tr.map.deletePlaceUnexpected),
        'error',
      );
    }
  }, [deletePlaceMutation]);

  const handleMarkerPress = useCallback(
    (index: number) => {
      prepareFullMapData();
      if (activeEditorMarkerIndex != null && index === activeEditorMarkerIndex && minimizedEditor) {
        setEditorData(minimizedEditor.panel);
        setMinimizedEditor(null);
        setEditorFocusTrigger((current) => current + 1);
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

      if (!targetMarker) {
        return;
      }

      if (targetMarker.markerKind !== 'saved' || !targetMarker.targetLocationKey) {
        return;
      }

      setSelectedSearchResult(null);
      setEditorData(null);
      setEditorDraft(null);
      setIsEditorInteractionLocked(false);
      setMinimizedEditor(null);
      setMinimizedExistingPlace(null);
      setSelectedExistingPlace({
        markerKey: targetMarker.targetLocationKey,
      });
    },
    [
      activeEditorMarkerIndex,
      interactiveMapMarkers,
      minimizedEditor,
      openEditorPanel,
      prepareFullMapData,
      isEditorInteractionLocked,
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

    setSelectedSearchResult(null);
    resetManualViewport();
    setEditorData(null);
    setEditorDraft(null);
    setIsEditorInteractionLocked(false);
    setMinimizedEditor(null);
    setMinimizedExistingPlace(null);
  }, [isEditorInteractionLocked, resetManualViewport]);

  const minimizeEditor = useCallback(
    (draft: PlaceEditorDraft) => {
      if (!editorData) {
        return;
      }

      setEditorDraft(draft);
      setMinimizedEditor({ panel: editorData, draft });
      setEditorData(null);
      setEditorFocusTrigger((current) => current + 1);
    },
    [editorData],
  );

  const reopenMinimizedEditor = useCallback(() => {
    if (!minimizedEditor) {
      return;
    }

    setEditorData(minimizedEditor.panel);
    setMinimizedEditor(null);
    setEditorFocusTrigger((current) => current + 1);
  }, [minimizedEditor]);

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
    closeEditor,
    closeSelectedExistingPlace: () => {
      setSelectedExistingPlace(null);
      setMinimizedExistingPlace(null);
    },
    createPlaceCardForSelectedLocation,
    createList,
    editorData,
    editorDraft,
    editorFocusTrigger,
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
    minimizeEditor,
    minimizeSelectedExistingPlace,
    onRefresh,
    refreshing,
    reopenMinimizedEditor,
    reopenMinimizedExistingPlace,
    retryLists,
    retryLocation: handleLocateUser,
    setMarkerFilter: handleMarkerFilterChange,
    unlockEditorAfterSaveFailure,
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
