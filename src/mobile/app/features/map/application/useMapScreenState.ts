import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Location from 'expo-location';

import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import {
  useCreateListMutation,
  useUpdateListsMutation,
} from '@/mobile/app/data/hooks/useListMutations';
import { useDeletePlaceMutation } from '@/mobile/app/data/hooks/usePlaceMutations';
import { useVisibleDataQuery } from '@/mobile/app/data/hooks/useVisibleDataQuery';
import type { ExistingPlaceSelection, MapViewport, MinimizedEditorState, PanelData } from '@/mobile/app/features/map/application/mapScreenTypes';
import {
  buildActiveEditorMarker,
  buildChangedListsForPlaceSave,
  buildSelectedSearchMarker,
  defaultViewport,
  findExistingPlaceMatch,
} from '@/mobile/app/features/map/application/mapScreenUtils';
import { useMapSearchController } from '@/mobile/app/features/map/application/useMapSearchController';
import type { PlaceEditorDraft } from '@/mobile/app/features/map/application/placeEditorDraft';
import { reverseGeocodeLocation, type GeocodingSearchResult } from '@/mobile/app/platform/api/geocoding';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { getListMarkerColor, type MapMarkerItem } from '@/mobile/app/shared/utils/format';

type UseMapScreenStateParams = {
  user: { id: string; name: string } | null;
};

const LOCATION_REQUEST_TIMEOUT_MS = 10000;

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

function triggerMutation<TInput>(
  mutation:
    | {
        mutate?: (
          input: TInput,
          options?: { onError?: (error: unknown) => void },
        ) => void;
        mutateAsync?: (input: TInput) => Promise<unknown>;
      },
  input: TInput,
  onError: (error: unknown) => void,
) {
  if (typeof mutation.mutate === 'function') {
    mutation.mutate(input, { onError });
    return;
  }

  if (typeof mutation.mutateAsync === 'function') {
    void mutation.mutateAsync(input).catch(onError);
  }
}

export function useMapScreenState({ user }: UseMapScreenStateParams) {
  const [editorData, setEditorData] = useState<PanelData | null>(null);
  const [editorDraft, setEditorDraft] = useState<PlaceEditorDraft | null>(null);
  const [minimizedEditor, setMinimizedEditor] = useState<MinimizedEditorState | null>(null);
  const [selectedExistingPlace, setSelectedExistingPlace] = useState<ExistingPlaceSelection | null>(null);
  const [selectedSearchResult, setSelectedSearchResult] = useState<GeocodingSearchResult | null>(null);
  const [manualViewport, setManualViewport] = useState<MapViewport | null>(null);
  const [userViewport, setUserViewport] = useState<MapViewport | null>(null);
  const [editorFocusTrigger, setEditorFocusTrigger] = useState(0);
  const [isLocating, setIsLocating] = useState(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [locationErrorMessage, setLocationErrorMessage] = useState<string | null>(null);

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
        'Harita verileri su an yuklenemiyor. Lutfen tekrar dene.',
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

  const { refreshing, onRefresh } = useFocusRefresh(refreshVisibleData);

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

  const selectedExistingEntry = useMemo(() => {
    if (!selectedExistingPlace) {
      return null;
    }

    const list = lists.find((item) => item.id === selectedExistingPlace.listId);
    const place = list?.places.find((item) => item.id === selectedExistingPlace.placeId);

    return list && place ? { list, place } : null;
  }, [lists, selectedExistingPlace]);

  const openEditorPanel = useCallback((data: PanelData) => {
    setSelectedExistingPlace(null);
    setMinimizedEditor(null);
    setEditorDraft(null);
    setEditorData(data);
    setEditorFocusTrigger((current) => current + 1);
  }, []);

  const openExistingPlacePanel = useCallback((target: { place: Place; list: PlaceList }) => {
    setSelectedSearchResult(null);
    setEditorData(null);
    setEditorDraft(null);
    setMinimizedEditor(null);
    setManualViewport({
      latitude: target.place.lat,
      longitude: target.place.lng,
      zoom: 15,
    });
    setSelectedExistingPlace({
      listId: target.list.id,
      placeId: target.place.id,
    });
  }, []);

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

  const selectedSearchMarker = useMemo<MapMarkerItem | null>(
    () => buildSelectedSearchMarker(selectedSearchResult, allPlaces, colors.primary),
    [allPlaces, selectedSearchResult],
  );

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

  const activeEditorMarker = useMemo<MapMarkerItem | null>(
    () =>
      buildActiveEditorMarker(
        activeEditorPanel,
        activeEditorMatchesSearchMarker,
        colors.primaryDark,
        tr.placeEditor.minimizedNewTitle,
      ),
    [activeEditorMatchesSearchMarker, activeEditorPanel],
  );

  const mapPlaces = useMemo<MapMarkerItem[]>(
    () => [
      ...allPlaces.map(({ place, list }) => ({
        lat: place.lat,
        lng: place.lng,
        name: place.name,
        markerColor: getListMarkerColor(list.isPublic),
      })),
      ...(selectedSearchMarker ? [selectedSearchMarker] : []),
      ...(activeEditorMarker ? [activeEditorMarker] : []),
    ],
    [activeEditorMarker, allPlaces, selectedSearchMarker],
  );

  const selectedSearchMarkerIndex = selectedSearchMarker ? allPlaces.length : null;
  const activeEditorMarkerIndex =
    activeEditorPanel != null
      ? activeEditorMatchesSearchMarker
        ? selectedSearchMarkerIndex
        : allPlaces.length + (selectedSearchMarker ? 1 : 0)
      : null;

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
          'Konum alinamadi. Lutfen tekrar dene.',
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
    void loadUserViewport().catch(() => undefined);
  }, [loadUserViewport]);

  useEffect(() => {
    if (selectedExistingPlace && !selectedExistingEntry) {
      setSelectedExistingPlace(null);
      setManualViewport(null);
    }
  }, [selectedExistingEntry, selectedExistingPlace]);

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

  const handleMapPress = useCallback(
    async ({ lat, lng }: { lat: number; lng: number }) => {
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
    [openEditorPanel, resolveAddress],
  );

  const handlePoiPress = useCallback(
    async ({ lat, lng, name }: { lat: number; lng: number; name: string; placeId: string }) => {
      const matchedPlace = findExistingPlaceMatch(allPlaces, lat, lng, name);

      if (matchedPlace) {
        openExistingPlacePanel(matchedPlace);
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
    [allPlaces, openEditorPanel, openExistingPlacePanel, resolveAddress, updateEditorData],
  );

  const handleSavePlace = useCallback(
    async (placeData: Omit<Place, 'id' | 'addedAt'>, targetListIds: string[]) => {
      if (!user) {
        return;
      }

      const selectedListIds = Array.from(new Set(targetListIds));
      const sourcePlace = editorData?.existingPlace || null;
      const changedLists = buildChangedListsForPlaceSave({
        lists,
        selectedListIds,
        sourcePlace,
        placeData,
        user,
      });

      triggerMutation(updateListsMutation, changedLists, (error) => {
        showToast(
          getUserFacingErrorMessage(error, 'Mekan kaydedilirken bir sorun olustu.'),
          'error',
        );
      });

      setSelectedSearchResult(null);
      setManualViewport(null);
      setEditorData(null);
      setEditorDraft(null);
      setMinimizedEditor(null);
      showToast(tr.map.placeSaved, 'success');
    },
    [editorData?.existingPlace, lists, updateListsMutation, user],
  );

  const handleDeletePlace = useCallback(async (placeId: string) => {
    triggerMutation(deletePlaceMutation, placeId, (error) => {
      showToast(
        getUserFacingErrorMessage(error, 'Mekan silinirken bir sorun olustu.'),
        'error',
      );
    });

    setSelectedSearchResult(null);
    setManualViewport(null);
    setEditorData(null);
    setEditorDraft(null);
    setMinimizedEditor(null);
    showToast(tr.map.placeDeleted, 'success');
  }, [deletePlaceMutation]);

  const handleMarkerPress = useCallback(
    (index: number) => {
      if (activeEditorMarkerIndex != null && index === activeEditorMarkerIndex && minimizedEditor) {
        setEditorData(minimizedEditor.panel);
        setMinimizedEditor(null);
        setEditorFocusTrigger((current) => current + 1);
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

      const target = allPlaces[index];

      if (!target) {
        return;
      }

      openExistingPlacePanel(target);
    },
    [
      activeEditorMarkerIndex,
      allPlaces,
      minimizedEditor,
      openEditorPanel,
      openExistingPlacePanel,
      selectedSearchMarkerIndex,
      selectedSearchResult,
    ],
  );

  const handleLocateUser = useCallback(async () => {
    await loadUserViewport({ showToastOnError: true, syncManualViewport: true });
  }, [loadUserViewport]);

  const closeEditor = useCallback(() => {
    setSelectedSearchResult(null);
    resetManualViewport();
    setEditorData(null);
    setEditorDraft(null);
    setMinimizedEditor(null);
  }, [resetManualViewport]);

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

  const createList = useCallback(
    async (list: PlaceList) => {
      if (!user) {
        return;
      }

      triggerMutation(createListMutation, { ...list, userId: user.id }, (error) => {
        showToast(
          getUserFacingErrorMessage(error, 'Liste olusturulurken bir sorun olustu.'),
          'error',
        );
      });
    },
    [createListMutation, user],
  );

  return {
    activeEditorMarkerIndex,
    activeEditorPanel,
    clearSearch,
    closeEditor,
    closeSelectedExistingPlace: () => {
      setSelectedExistingPlace(null);
      resetManualViewport();
    },
    createList,
    editorData,
    editorDraft,
    editorFocusTrigger,
    effectiveViewport,
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
    lists,
    locationErrorMessage,
    locationPermissionDenied,
    mapPlaces,
    minimizedEditor,
    minimizeEditor,
    onRefresh,
    refreshing,
    reopenMinimizedEditor,
    retryLists: refreshVisibleData,
    retryLocation: handleLocateUser,
    runSearch,
    searchErrorMessage,
    searchFocusTrigger,
    searchQuery,
    searchResults,
    selectedExistingEntry,
    selectedSearchMarkerIndex,
    visibleDataErrorMessage,
  };
}
