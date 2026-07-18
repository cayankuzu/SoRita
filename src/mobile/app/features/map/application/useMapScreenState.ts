import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';

import { useAppProgressBanner } from '@/mobile/app/app-shell/feedback/AppProgressBanner';
import { rootNavigationRef } from '@/mobile/app/app-shell/navigation/RootNavigator';
import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import {
  useCreateListMutation,
  useUpdateListsMutation,
} from '@/mobile/app/data/hooks/useListMutations';
import { useDeletePlaceMutation } from '@/mobile/app/data/hooks/usePlaceMutations';
import { useVisibleDataQuery } from '@/mobile/app/data/hooks/useVisibleDataQuery';
import type {
  ExistingPlaceSelection,
  MapViewport,
  MarkerFilterOption,
  MinimizedEditorState,
  MinimizedPlacePreviewState,
  PanelData,
} from '@/mobile/app/features/map/application/mapScreenTypes';
import {
  buildActiveEditorMarker,
  buildChangedListsForPlaceSave,
  buildSelectedSearchMarker,
  defaultViewport,
  findExistingPlaceMatchByCoordinates,
} from '@/mobile/app/features/map/application/mapScreenUtils';
import { useMapSearchController } from '@/mobile/app/features/map/application/useMapSearchController';
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
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import {
  getMarkerAggregationKey,
  getMarkerColorByVisibility,
  getMarkerColorForPlaceAcrossLists,
  getMarkerVisibilityForPlaceAcrossLists,
  type MapMarkerItem,
} from '@/mobile/app/shared/utils/markerColors';
import { isAbortError } from '@/mobile/app/shared/utils/abort';

type UseMapScreenStateParams = {
  user: { id: string; name: string } | null;
};

type InteractiveMapMarker = MapMarkerItem & {
  markerKind: 'saved' | 'search' | 'editor';
  targetLocationKey?: string;
};

type PendingPlaceSaveRequest = {
  draft: PlaceEditorDraft | null;
  placeData: Omit<Place, 'id' | 'addedAt'>;
  sourcePlace: Place | null;
  targetListIds: string[];
};

const LOCATION_REQUEST_TIMEOUT_MS = 10000;

function createErrorWithCause(message: string, cause: unknown) {
  const nextError = new Error(message);
  (nextError as Error & { cause?: unknown }).cause = cause;
  return nextError;
}

async function getCurrentLocationWithTimeout() {
  return await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Location request timed out'));
      }, LOCATION_REQUEST_TIMEOUT_MS);
    }),
  ]);
}

function sortPlaceEntriesByUpdatedAt(entries: Array<{ place: Place; list: PlaceList }>) {
  return [...entries].sort(
    (left, right) =>
      new Date(right.place.updatedAt || right.place.addedAt).getTime() -
      new Date(left.place.updatedAt || left.place.addedAt).getTime(),
  );
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
  const [userViewport, setUserViewport] = useState<MapViewport | null>(null);
  const [markerFilter, setMarkerFilter] = useState<MarkerFilterOption>('all');
  const [editorFocusTrigger, setEditorFocusTrigger] = useState(0);
  const [isLocating, setIsLocating] = useState(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [locationErrorMessage, setLocationErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    minimizedEditorRef.current = minimizedEditor;
  }, [minimizedEditor]);

  const userId = user?.id;
  const visibleDataQuery = useVisibleDataQuery(userId, {
    listPageSize: 100,
    ownerId: userId || undefined,
  });
  const createListMutation = useCreateListMutation();
  const updateListsMutation = useUpdateListsMutation();
  const deletePlaceMutation = useDeletePlaceMutation();
  const { refetch } = visibleDataQuery;
  const visibleLists = visibleDataQuery.data?.lists || [];
  const visibleDataErrorMessage = visibleDataQuery.error
    ? getUserFacingErrorMessage(
        visibleDataQuery.error,
        tr.map.dataErrorDescription,
      )
    : null;

  const loadLists = useCallback(async () => {
    if (!userId) {
      return;
    }

    await refetch();
  }, [refetch, userId]);

  const refreshVisibleData = useCallback(async () => {
    await loadLists();
  }, [loadLists]);

  const { refreshing, onRefresh } = useFocusRefresh(refreshVisibleData, {
    refreshOnFocus: false,
    skipInitialFocus: true,
  });

  const lists = useMemo(
    () => (userId ? visibleLists.filter((list) => list.userId === userId) : []),
    [userId, visibleLists],
  );

  const allPlaces = useMemo(
    () =>
      lists.flatMap((list) =>
        list.places.map((place) => ({
          place,
          list,
        })),
      ),
    [lists],
  );

  const placeEntriesByLocationKey = useMemo(() => {
    const groupedEntries = new Map<string, Array<{ place: Place; list: PlaceList }>>();

    allPlaces.forEach((entry) => {
      const markerKey = getMarkerAggregationKey(entry.place);
      const currentEntries = groupedEntries.get(markerKey);

      if (currentEntries) {
        currentEntries.push(entry);
        return;
      }

      groupedEntries.set(markerKey, [entry]);
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

  const selectedExistingEntry = selectedExistingEntries[0] || null;

  const openEditorPanel = useCallback((data: PanelData) => {
    if (isEditorInteractionLocked) {
      return;
    }

    setSelectedExistingPlace(null);
    setMinimizedExistingPlace(null);
    setMinimizedEditor(null);
    setEditorDraft(null);
    setIsEditorInteractionLocked(false);
    setEditorData(data);
    setEditorFocusTrigger((current) => current + 1);
  }, [isEditorInteractionLocked]);

  const openExistingPlacePanel = useCallback((target: { lat: number; lng: number }) => {
    if (isEditorInteractionLocked) {
      return;
    }

    setSelectedSearchResult(null);
    setEditorData(null);
    setEditorDraft(null);
    setIsEditorInteractionLocked(false);
    setMinimizedEditor(null);
    setMinimizedExistingPlace(null);
    setSelectedExistingPlace({
      markerKey: getMarkerAggregationKey(target),
    });
  }, [isEditorInteractionLocked]);

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
    openEditorPanel,
    openExistingPlacePanel,
    setManualViewport,
    selectedSearchResult,
    setSelectedSearchResult,
  });

  const savedMapMarkers = useMemo<InteractiveMapMarker[]>(() => {
    return Array.from(placeEntriesByLocationKey.entries()).reduce<InteractiveMapMarker[]>(
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
    );
  }, [lists, placeEntriesByLocationKey]);

  const filteredSavedMapMarkers = useMemo(() => {
    if (markerFilter === 'none') {
      return [];
    }

    if (markerFilter === 'all') {
      return savedMapMarkers;
    }

    return savedMapMarkers.filter((marker) => marker.markerVisibility === markerFilter);
  }, [markerFilter, savedMapMarkers]);

  const selectedSearchMarker = useMemo<InteractiveMapMarker | null>(() => {
    const marker = buildSelectedSearchMarker(selectedSearchResult, allPlaces, colors.markerDraft);

    if (!marker) {
      return null;
    }

    return {
      ...marker,
      markerKind: 'search',
    };
  }, [allPlaces, selectedSearchResult]);

  const activeEditorPanel = editorData ?? minimizedEditor?.panel ?? null;
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

    if (!marker) {
      return null;
    }

    return {
      ...marker,
      markerKind: 'editor',
    };
  }, [activeEditorMatchesSearchMarker, activeEditorPanel]);

  const interactiveMapMarkers = useMemo<InteractiveMapMarker[]>(
    () => [
      ...filteredSavedMapMarkers,
      ...(selectedSearchMarker ? [selectedSearchMarker] : []),
      ...(activeEditorMarker ? [activeEditorMarker] : []),
    ],
    [activeEditorMarker, filteredSavedMapMarkers, selectedSearchMarker],
  );

  const mapPlaces = useMemo<MapMarkerItem[]>(
    () => interactiveMapMarkers,
    [interactiveMapMarkers],
  );

  const selectedExistingMarkerColor = useMemo(
    () =>
      selectedExistingEntry
        ? getMarkerColorForPlaceAcrossLists(
            selectedExistingEntry.place,
            lists,
            selectedExistingEntry.list.isPublic,
          )
        : undefined,
    [lists, selectedExistingEntry],
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

    return activeEditorPanel != null && activeEditorMatchesSearchMarker
      ? selectedSearchMarkerIndex
      : null;
  }, [
    activeEditorMatchesSearchMarker,
    activeEditorPanel,
    interactiveMapMarkers,
    selectedSearchMarkerIndex,
  ]);

  const effectiveViewport = useMemo<MapViewport | null>(
    () => manualViewport ?? (mapPlaces.length === 0 ? userViewport ?? defaultViewport : null),
    [manualViewport, mapPlaces.length, userViewport],
  );

  const loadUserViewport = useCallback(
    async (options?: { showToastOnError?: boolean; syncManualViewport?: boolean }) => {
      setIsLocating(true);
      setLocationErrorMessage(null);

      try {
        const permission = await Location.requestForegroundPermissionsAsync();

        if (permission.status !== 'granted') {
          setLocationPermissionDenied(true);
          const deniedMessage = tr.map.locationPermissionRequired;
          setLocationErrorMessage(deniedMessage);

          if (options?.showToastOnError) {
            showToast(deniedMessage, 'error');
          }
          return;
        }

        setLocationPermissionDenied(false);
        const current = await getCurrentLocationWithTimeout();
        setUserViewport({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          zoom: 13.5,
        });
        if (options?.syncManualViewport) {
          setManualViewport({
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
            zoom: 14.5,
          });
        }
      } catch (error) {
        const message = getUserFacingErrorMessage(
          error,
          tr.map.locationRetryDescription,
        );
        setLocationErrorMessage(message);

        if (options?.showToastOnError) {
          showToast(message, 'error');
        }
      } finally {
        setIsLocating(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadUserViewport().catch((err) => { logger.debug('map', 'Failed to load user viewport', err); });
  }, [loadUserViewport]);

  useEffect(() => {
    if (
      selectedExistingPlace &&
      selectedExistingEntries.length === 0 &&
      !visibleDataQuery.isLoading &&
      !visibleDataQuery.isFetching
    ) {
      setSelectedExistingPlace(null);
      setManualViewport(null);
    }
  }, [
    selectedExistingEntries.length,
    selectedExistingPlace,
    visibleDataQuery.isFetching,
    visibleDataQuery.isLoading,
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
  }, [userId, userViewport]);

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

  const resolveAddress = useCallback(async (latitude: number, longitude: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      const first = results[0];
      if (!first) {
        return undefined;
      }

      return [
        [first.street, first.streetNumber].filter(Boolean).join(' '),
        first.district,
        first.city,
      ]
        .filter(Boolean)
        .join(', ');
    } catch {
      return undefined;
    }
  }, []);

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
      isEditorInteractionLocked,
      selectedSearchMarkerIndex,
      selectedSearchResult,
    ],
  );

  const handleLocateUser = useCallback(async () => {
    await loadUserViewport({ showToastOnError: true, syncManualViewport: true });
  }, [loadUserViewport]);

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
    hasMapDataPartialError: visibleDataQuery.hasPartialDataError,
    hasSearched,
    isSearching,
    isLocating,
    isEditorInteractionLocked,
    lists,
    locationErrorMessage,
    locationPermissionDenied,
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
    retryLists: refreshVisibleData,
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
