import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';
import { colors } from '@/mobile/app/shared/theme/tokens';

const requestForegroundPermissionsAsyncMock = vi.fn();
const getCurrentPositionAsyncMock = vi.fn();
const reverseGeocodeAsyncMock = vi.fn();
const reverseGeocodeLocationMock = vi.fn();
const useVisibleDataQueryMock = vi.fn();
const useMapMarkersQueryMock = vi.fn();
const useCreateListMutationMock = vi.fn();
const useUpdateListsMutationMock = vi.fn();
const useDeletePlaceMutationMock = vi.fn();
const useMapSearchControllerMock = vi.fn();
const useFocusRefreshMock = vi.fn();
const showToastMock = vi.fn();
const beginProgressMock = vi.fn(() => ({
  setProgress: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
  end: vi.fn(),
}));
const getPersistedMapScreenStateMock = vi.fn();
const savePersistedMapScreenStateMock = vi.fn();
const rootIsReadyMock = vi.fn();
const rootNavigateMock = vi.fn();

vi.mock('expo-location', () => ({
  Accuracy: {
    Balanced: 'balanced',
  },
  getCurrentPositionAsync: getCurrentPositionAsyncMock,
  requestForegroundPermissionsAsync: requestForegroundPermissionsAsyncMock,
  reverseGeocodeAsync: reverseGeocodeAsyncMock,
}));

vi.mock('@/mobile/app/platform/api/geocoding', () => ({
  reverseGeocodeLocation: reverseGeocodeLocationMock,
}));

vi.mock('@/mobile/app/data/hooks/useVisibleDataQuery', () => ({
  useVisibleDataQuery: useVisibleDataQueryMock,
}));

vi.mock('@/mobile/app/data/hooks/useMapMarkersQuery', () => ({
  useMapMarkersQuery: useMapMarkersQueryMock,
}));

vi.mock('@/mobile/app/data/hooks/useListMutations', () => ({
  useCreateListMutation: useCreateListMutationMock,
  useUpdateListsMutation: useUpdateListsMutationMock,
}));

vi.mock('@/mobile/app/data/hooks/usePlaceMutations', () => ({
  useDeletePlaceMutation: useDeletePlaceMutationMock,
}));

vi.mock('@/mobile/app/features/map/application/useMapSearchController', () => ({
  useMapSearchController: useMapSearchControllerMock,
}));

vi.mock('@/mobile/app/shared/hooks/useFocusRefresh', () => ({
  useFocusRefresh: useFocusRefreshMock,
}));

vi.mock('@/mobile/app/platform/feedback/toast', () => ({
  showToast: showToastMock,
}));

vi.mock('@/mobile/app/app-shell/feedback/AppProgressBanner', () => ({
  useAppProgressBanner: () => ({
    beginProgress: beginProgressMock,
  }),
}));

vi.mock('@/mobile/app/app-shell/navigation/navigationRef', () => ({
  rootNavigationRef: {
    isReady: rootIsReadyMock,
    navigate: rootNavigateMock,
  },
}));

vi.mock('@/mobile/app/platform/storage/mapScreenState', () => ({
  getPersistedMapScreenState: getPersistedMapScreenStateMock,
  savePersistedMapScreenState: savePersistedMapScreenStateMock,
}));

describe('useMapScreenState', () => {
  beforeEach(() => {
    requestForegroundPermissionsAsyncMock.mockReset();
    getCurrentPositionAsyncMock.mockReset();
    reverseGeocodeAsyncMock.mockReset();
    reverseGeocodeLocationMock.mockReset();
    useVisibleDataQueryMock.mockReset();
    useMapMarkersQueryMock.mockReset();
    useCreateListMutationMock.mockReset();
    useUpdateListsMutationMock.mockReset();
    useDeletePlaceMutationMock.mockReset();
    useMapSearchControllerMock.mockReset();
    useFocusRefreshMock.mockReset();
    showToastMock.mockReset();
    beginProgressMock.mockClear();
    getPersistedMapScreenStateMock.mockReset();
    savePersistedMapScreenStateMock.mockReset();
    rootIsReadyMock.mockReset();
    rootNavigateMock.mockReset();

    useMapMarkersQueryMock.mockReturnValue({
      data: [],
      error: null,
      isLoading: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    });

    getPersistedMapScreenStateMock.mockResolvedValue(null);
    savePersistedMapScreenStateMock.mockResolvedValue(undefined);
    rootIsReadyMock.mockReturnValue(false);

    requestForegroundPermissionsAsyncMock.mockResolvedValue({ status: 'granted' });
    getCurrentPositionAsyncMock.mockResolvedValue({
      coords: {
        latitude: 39.92,
        longitude: 32.85,
      },
    });
    reverseGeocodeAsyncMock.mockResolvedValue([
      {
        street: 'Ataturk Blv',
        streetNumber: '10',
        district: 'Cankaya',
        city: 'Ankara',
      },
    ]);
    reverseGeocodeLocationMock.mockResolvedValue({
      address: 'Ataturk Blv 10, Cankaya, Ankara',
      isPointOfInterest: true,
      name: 'Kahve Dunyasi',
    });
  });

  it('manages editor state, map interactions, and place persistence', async () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);
    const updateListsAsync = vi.fn().mockResolvedValue(undefined);
    const createListAsync = vi.fn().mockResolvedValue(undefined);
    const deletePlaceAsync = vi.fn().mockResolvedValue(undefined);
    const searchControllerState = {
      clearSearch: vi.fn(),
      handleSearchQueryChange: vi.fn(),
      handleSearchResultPress: vi.fn(),
      hasSearched: false,
      isSearching: false,
      runSearch: vi.fn(),
      searchFocusTrigger: 1,
      searchQuery: 'kahve',
      searchResults: [],
    };

    useVisibleDataQueryMock.mockReturnValue({
      data: {
        lists: [
          {
            id: 'list-1',
            userId: 'viewer',
            name: 'Favorites',
            places: [
              {
                id: 'place-1',
                name: 'Cafe',
                lat: 39.93,
                lng: 32.85,
                addedAt: '2025-01-01T00:00:00.000Z',
              },
            ],
            isPublic: true,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      },
      refetch: refetchMock,
    });
    useCreateListMutationMock.mockReturnValue({ mutateAsync: createListAsync });
    useUpdateListsMutationMock.mockReturnValue({ mutateAsync: updateListsAsync });
    useDeletePlaceMutationMock.mockReturnValue({ mutateAsync: deletePlaceAsync });
    useMapSearchControllerMock.mockReturnValue(searchControllerState);
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/map/application/useMapScreenState');
    const hook = renderHook(() =>
      hooks.useMapScreenState({
        user: {
          id: 'viewer',
          name: 'Viewer',
        },
      }),
    );

    await waitFor(() => {
      expect(hook.result.current.lists).toHaveLength(1);
    });

    await act(async () => {
      await hook.result.current.onRefresh();
      await hook.result.current.handleMapPress({ lat: 39.9334, lng: 32.8597 });
    });

    await waitFor(() => {
      expect(hook.result.current.editorData?.name).toBe('Kahve Dunyasi');
      expect(hook.result.current.editorData?.address).toContain('Ataturk');
    });

    act(() => {
      hook.result.current.minimizeEditor({
        step: 1,
        name: 'Draft',
        title: '',
        menuUrl: '',
        address: '',
        notes: '',
        selectedCategories: ['other'],
        rating: 0,
        studentFriendly: false,
        priceMin: '',
        priceMax: '',
        selectedLists: ['list-1'],
        photos: [],
        bestTimes: [],
        atmosphere: [],
        features: [],
        newListName: '',
        newListDescription: '',
        newListCoverImage: '',
        newListPublic: true,
        showNewListForm: false,
      });
      hook.result.current.reopenMinimizedEditor();
    });

    await act(async () => {
      await hook.result.current.handleSavePlace(
        {
          name: 'Saved Place',
          lat: 39.9334,
          lng: 32.8597,
        },
        ['list-1', 'list-1'],
      );
      await hook.result.current.handleDeletePlace('place-1');
      await hook.result.current.createList({
        id: 'list-2',
        userId: '',
        name: 'Weekend',
        places: [],
        isPublic: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      });
      await hook.result.current.handleLocateUser();
    });

    expect(refetchMock).toHaveBeenCalled();
    expect(updateListsAsync).toHaveBeenCalled();
    expect(deletePlaceAsync).toHaveBeenCalledWith('place-1');
    expect(createListAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'viewer',
        name: 'Weekend',
      }),
    );
    expect(hook.result.current.effectiveViewport).toEqual({
      latitude: 39.92,
      longitude: 32.85,
      zoom: 14.5,
    });
    expect(showToastMock).toHaveBeenCalled();
  });

  it('handles null-user and denied location permission branches safely', async () => {
    const updateListsAsync = vi.fn().mockResolvedValue(undefined);
    const createListAsync = vi.fn().mockResolvedValue(undefined);
    const deletePlaceAsync = vi.fn().mockResolvedValue(undefined);

    requestForegroundPermissionsAsyncMock.mockResolvedValue({ status: 'denied' });
    useVisibleDataQueryMock.mockReturnValue({
      data: {
        lists: [
          {
            id: 'list-1',
            userId: 'other-user',
            name: 'Public',
            places: [],
            isPublic: true,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      },
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    useCreateListMutationMock.mockReturnValue({ mutateAsync: createListAsync });
    useUpdateListsMutationMock.mockReturnValue({ mutateAsync: updateListsAsync });
    useDeletePlaceMutationMock.mockReturnValue({ mutateAsync: deletePlaceAsync });
    useMapSearchControllerMock.mockReturnValue({
      clearSearch: vi.fn(),
      handleSearchQueryChange: vi.fn(),
      handleSearchResultPress: vi.fn(),
      hasSearched: false,
      isSearching: false,
      runSearch: vi.fn(),
      searchFocusTrigger: 0,
      searchQuery: '',
      searchResults: [],
    });
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/map/application/useMapScreenState');
    const hook = renderHook(() => hooks.useMapScreenState({ user: null }));
    const { tr } = await import('@/mobile/app/shared/i18n/tr');

    expect(hook.result.current.lists).toEqual([]);

    act(() => {
      hook.result.current.minimizeEditor({
        step: 1,
        name: '',
        title: '',
        menuUrl: '',
        address: '',
        notes: '',
        selectedCategories: [],
        rating: 0,
        studentFriendly: false,
        priceMin: '',
        priceMax: '',
        selectedLists: [],
        photos: [],
        bestTimes: [],
        atmosphere: [],
        features: [],
        newListName: '',
        newListDescription: '',
        newListCoverImage: '',
        newListPublic: true,
        showNewListForm: false,
      });
      hook.result.current.reopenMinimizedEditor();
      hook.result.current.closeEditor();
      hook.result.current.closeSelectedExistingPlace();
    });

    await act(async () => {
      await hook.result.current.handleSavePlace({ lat: 1, lng: 2, name: 'No user' }, ['list-1']);
      await expect(hook.result.current.createList({
        id: 'list-2',
        userId: '',
        name: 'Weekend',
        places: [],
        isPublic: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      })).rejects.toThrow(tr.settings.sessionMissing);
      await hook.result.current.handleLocateUser();
    });

    expect(updateListsAsync).not.toHaveBeenCalled();
    expect(createListAsync).not.toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('rethrows list creation errors so the caller can show a single toast', async () => {
    const createListAsync = vi.fn().mockRejectedValue(new Error('RLS blocked'));

    useVisibleDataQueryMock.mockReturnValue({
      data: { lists: [] },
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    useCreateListMutationMock.mockReturnValue({ mutateAsync: createListAsync });
    useUpdateListsMutationMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) });
    useDeletePlaceMutationMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) });
    useMapSearchControllerMock.mockReturnValue({
      clearSearch: vi.fn(),
      handleSearchQueryChange: vi.fn(),
      handleSearchResultPress: vi.fn(),
      hasSearched: false,
      isSearching: false,
      runSearch: vi.fn(),
      searchFocusTrigger: 0,
      searchQuery: '',
      searchResults: [],
    });
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/map/application/useMapScreenState');
    const hook = renderHook(() =>
      hooks.useMapScreenState({
        user: {
          id: 'viewer',
          name: 'Viewer',
        },
      }),
    );

    await expect(
      hook.result.current.createList({
        id: 'list-2',
        userId: '',
        name: 'Weekend',
        places: [],
        isPublic: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      }),
    ).rejects.toThrow('RLS blocked');

    expect(showToastMock).not.toHaveBeenCalled();
  });

  it('keeps a minimized draft and unlocks the editor when place save fails', async () => {
    const updateListsAsync = vi.fn().mockRejectedValue(new Error('rate limited'));

    useVisibleDataQueryMock.mockReturnValue({
      data: {
        lists: [
          {
            id: 'list-1',
            userId: 'viewer',
            name: 'Favorites',
            places: [],
            isPublic: true,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      },
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    useCreateListMutationMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) });
    useUpdateListsMutationMock.mockReturnValue({ mutateAsync: updateListsAsync });
    useDeletePlaceMutationMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) });
    useMapSearchControllerMock.mockReturnValue({
      clearSearch: vi.fn(),
      handleSearchQueryChange: vi.fn(),
      handleSearchResultPress: vi.fn(),
      hasSearched: false,
      isSearching: false,
      runSearch: vi.fn(),
      searchFocusTrigger: 0,
      searchQuery: '',
      searchResults: [],
    });
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/map/application/useMapScreenState');
    const hook = renderHook(() =>
      hooks.useMapScreenState({
        user: {
          id: 'viewer',
          name: 'Viewer',
        },
      }),
    );

    await act(async () => {
      await hook.result.current.handleMapPress({ lat: 39.9334, lng: 32.8597 });
    });

    const draft = {
      step: 2,
      name: 'Draft place',
      title: '',
      menuUrl: '',
      address: 'Test address',
      notes: '',
      selectedCategories: [],
      rating: 0,
      studentFriendly: false,
      priceMin: '',
      priceMax: '',
      selectedLists: ['list-1'],
      photos: [],
      bestTimes: [],
      atmosphere: [],
      features: [],
      newListName: '',
      newListDescription: '',
      newListCoverImage: '',
      newListPublic: true,
      showNewListForm: false,
    };

    act(() => {
      hook.result.current.beginEditorSave(draft);
    });

    expect(hook.result.current.isEditorInteractionLocked).toBe(true);
    expect(hook.result.current.editorData).toBeNull();
    expect(hook.result.current.minimizedEditor?.draft).toEqual(draft);

    act(() => {
      hook.result.current.reopenMinimizedEditor();
    });

    expect(hook.result.current.editorData).not.toBeNull();

    act(() => {
      hook.result.current.minimizeEditor(draft);
    });

    expect(hook.result.current.editorData).toBeNull();
    expect(hook.result.current.minimizedEditor?.draft).toEqual(draft);

    act(() => {
      hook.result.current.reopenMinimizedEditor();
    });

    let saveError: unknown;

    await act(async () => {
      try {
        await hook.result.current.handleSavePlace(
          {
            lat: 39.9334,
            lng: 32.8597,
            name: 'Draft place',
          },
          ['list-1'],
        );
      } catch (error) {
        saveError = error;
      }
    });

    expect(saveError).toBeInstanceOf(Error);
    expect((saveError as Error).message).toBe('rate limited');
    
    act(() => {
      hook.result.current.unlockEditorAfterSaveFailure(draft);
    });

    expect(hook.result.current.isEditorInteractionLocked).toBe(false);
    expect(hook.result.current.editorData).not.toBeNull();

    act(() => {
      hook.result.current.minimizeEditor(draft);
    });

    expect(hook.result.current.minimizedEditor?.draft).toEqual(draft);

    act(() => {
      hook.result.current.reopenMinimizedEditor();
    });

    expect(hook.result.current.editorData).not.toBeNull();
  });

  it('falls back from geocoding failures and supports POI matching, markers, and selection cleanup', async () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);
    const controller = {
      clearSearch: vi.fn(),
      handleSearchQueryChange: vi.fn(),
      handleSearchResultPress: vi.fn(),
      hasSearched: true,
      isSearching: false,
      runSearch: vi.fn(),
      searchFocusTrigger: 2,
      searchQuery: 'poi',
      searchResults: [],
    };
    let controllerArgs:
      | {
          setSelectedSearchResult: (value: {
            address?: string;
            lat: number;
            lng: number;
            name: string;
            placeId: string;
          } | null) => void;
        }
      | undefined;

    useVisibleDataQueryMock.mockReturnValue({
      data: {
        lists: [
          {
            id: 'list-1',
            userId: 'viewer',
            name: 'Favorites',
            places: [
              {
                id: 'place-1',
                name: 'Existing Cafe',
                lat: 39.93,
                lng: 32.85,
                addedAt: '2025-01-01T00:00:00.000Z',
              },
            ],
            isPublic: true,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      },
      refetch: refetchMock,
    });
    useCreateListMutationMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) });
    useUpdateListsMutationMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) });
    useDeletePlaceMutationMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) });
    useMapSearchControllerMock.mockImplementation((args) => {
      controllerArgs = args;
      return controller;
    });
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/map/application/useMapScreenState');
    const hook = renderHook(() =>
      hooks.useMapScreenState({
        user: {
          id: 'viewer',
          name: 'Viewer',
        },
      }),
    );

    reverseGeocodeLocationMock.mockRejectedValueOnce(new Error('reverse failed'));
    reverseGeocodeAsyncMock.mockRejectedValueOnce(new Error('native failed'));
    await act(async () => {
      await hook.result.current.handleMapPress({ lat: 10, lng: 11 });
    });
    await waitFor(() => {
      expect(hook.result.current.editorData?.address).toBeTruthy();
    });

    await act(async () => {
      await hook.result.current.handlePoiPress({
        lat: 39.93,
        lng: 32.85,
        name: 'Existing Cafe',
        placeId: 'poi-1',
      });
    });
    expect(hook.result.current.selectedExistingEntry?.place.id).toBe('place-1');
    expect(hook.result.current.effectiveViewport).toBeNull();

    act(() => {
      hook.result.current.minimizeSelectedExistingPlace();
    });
    expect(hook.result.current.selectedExistingEntry).toBeNull();
    expect(hook.result.current.minimizedExistingPlace).toEqual({
      markerKey: '39.93000:32.85000',
    });

    act(() => {
      hook.result.current.reopenMinimizedExistingPlace();
    });
    expect(hook.result.current.selectedExistingEntry?.place.id).toBe('place-1');

    act(() => {
      hook.result.current.closeSelectedExistingPlace();
    });
    expect(hook.result.current.selectedExistingEntry).toBeNull();
    expect(hook.result.current.effectiveViewport).toBeNull();

    act(() => {
      hook.result.current.handleMarkerPress(0);
    });
    expect(hook.result.current.selectedExistingEntry?.place.id).toBe('place-1');

    act(() => {
      hook.result.current.closeSelectedExistingPlace();
    });
    expect(hook.result.current.selectedExistingEntry).toBeNull();

    reverseGeocodeLocationMock.mockRejectedValueOnce(new Error('reverse failed'));
    reverseGeocodeAsyncMock.mockResolvedValueOnce([]);
    await act(async () => {
      await hook.result.current.handlePoiPress({
        lat: 50,
        lng: 60,
        name: 'New Cafe',
        placeId: 'poi-2',
      });
    });
    expect(hook.result.current.editorData?.address).toBeTruthy();

    act(() => {
      hook.result.current.closeEditor();
    });

    await act(async () => {
      await hook.result.current.handleMapPress({
        lat: 39.93,
        lng: 32.85,
      });
    });
    await waitFor(() => {
      expect(hook.result.current.selectedExistingEntry).toBeNull();
      expect(hook.result.current.editorData?.name).toBe('Kahve Dunyasi');
      expect(hook.result.current.editorData?.address).toContain('Ataturk');
    });

    act(() => {
      controllerArgs?.setSelectedSearchResult({
        address: 'Search Address',
        lat: 70,
        lng: 80,
        name: 'Search Result',
        placeId: 'search-1',
      });
    });
    await waitFor(() => {
      expect(hook.result.current.selectedSearchMarkerIndex).not.toBeNull();
    });
    expect(
      hook.result.current.mapPlaces[hook.result.current.selectedSearchMarkerIndex as number]
        ?.markerColor,
    ).toBe(colors.markerDraft);

    await act(async () => {
      hook.result.current.handleMarkerPress(hook.result.current.selectedSearchMarkerIndex as number);
    });
    expect(hook.result.current.editorData?.name).toBe('Search Result');
    expect(hook.result.current.selectedSearchMarkerIndex).not.toBeNull();

    act(() => {
      hook.result.current.minimizeEditor({
        step: 1,
        name: 'Draft',
        title: '',
        menuUrl: '',
        address: '',
        notes: '',
        selectedCategories: ['other'],
        rating: 0,
        studentFriendly: false,
        priceMin: '',
        priceMax: '',
        selectedLists: ['list-1'],
        photos: [],
        bestTimes: [],
        atmosphere: [],
        features: [],
        newListName: '',
        newListDescription: '',
        newListCoverImage: '',
        newListPublic: true,
        showNewListForm: false,
      });
    });
    expect(hook.result.current.activeEditorMarkerIndex).not.toBeNull();
    expect(
      hook.result.current.mapPlaces[hook.result.current.activeEditorMarkerIndex as number]
        ?.markerColor,
    ).toBe(colors.markerDraft);

    act(() => {
      hook.result.current.handleMarkerPress(hook.result.current.activeEditorMarkerIndex as number);
      hook.result.current.handleMarkerPress(999);
    });
    expect(hook.result.current.editorData).not.toBeNull();

    useVisibleDataQueryMock.mockReturnValue({
      data: { lists: [] },
      refetch: refetchMock,
    });
    act(() => {
      hook.result.current.closeEditor();
    });
    expect(hook.result.current.selectedSearchMarkerIndex).toBeNull();
    hook.rerender();
    await waitFor(() => {
      expect(hook.result.current.selectedExistingEntry).toBeNull();
    });
  });

  it('aggregates shared places into one blue marker and filters by visibility', async () => {
    useVisibleDataQueryMock.mockReturnValue({
      data: {
        lists: [
          {
            id: 'list-public',
            userId: 'viewer',
            name: 'Public list',
            places: [
              {
                id: 'place-public',
                name: 'Shared Cafe',
                lat: 39.93,
                lng: 32.85,
                addedAt: '2025-01-01T00:00:00.000Z',
              },
            ],
            isPublic: true,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'list-private',
            userId: 'viewer',
            name: 'Private list',
            places: [
              {
                id: 'place-private',
                name: 'Shared Cafe',
                lat: 39.93,
                lng: 32.85,
                addedAt: '2025-01-02T00:00:00.000Z',
              },
            ],
            isPublic: false,
            createdAt: '2025-01-02T00:00:00.000Z',
            updatedAt: '2025-01-02T00:00:00.000Z',
          },
        ],
      },
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    useCreateListMutationMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) });
    useUpdateListsMutationMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) });
    useDeletePlaceMutationMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) });
    useMapSearchControllerMock.mockReturnValue({
      clearSearch: vi.fn(),
      handleSearchQueryChange: vi.fn(),
      handleSearchResultPress: vi.fn(),
      hasSearched: false,
      isSearching: false,
      runSearch: vi.fn(),
      searchFocusTrigger: 0,
      searchQuery: '',
      searchResults: [],
    });
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/map/application/useMapScreenState');
    const hook = renderHook(() =>
      hooks.useMapScreenState({
        user: {
          id: 'viewer',
          name: 'Viewer',
        },
      }),
    );

    await waitFor(() => {
      expect(hook.result.current.mapPlaces).toHaveLength(1);
    });

    expect(hook.result.current.mapPlaces[0]?.markerColor).toBe(colors.primary);
    expect(hook.result.current.mapPlaces[0]?.markerVisibility).toBe('mixed');

    act(() => {
      hook.result.current.setMarkerFilter('public');
    });
    expect(hook.result.current.mapPlaces).toHaveLength(0);

    act(() => {
      hook.result.current.setMarkerFilter('mixed');
    });
    expect(hook.result.current.mapPlaces).toHaveLength(1);

    act(() => {
      hook.result.current.setMarkerFilter('none');
    });
    expect(hook.result.current.mapPlaces).toHaveLength(0);
  });

  it('restores durable map state and guards search, save, filter, and location edge paths', async () => {
    const updateListsAsync = vi.fn().mockResolvedValue(undefined);
    const controller = {
      clearSearch: vi.fn(), handleSearchQueryChange: vi.fn(), handleSearchResultPress: vi.fn(),
      hasSearched: true, isSearching: false, runSearch: vi.fn(), searchErrorMessage: null,
      searchFocusTrigger: 3, searchQuery: 'search', searchResults: [],
    };
    let controllerArgs: {
      setSelectedSearchResult: (value: {
        address?: string; lat: number; lng: number; name: string; placeId: string;
      } | null) => void;
    } | undefined;
    const place = {
      id: 'place-1', name: 'Saved cafe', lat: 40, lng: 30,
      addedAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-02T00:00:00.000Z',
    };
    useVisibleDataQueryMock.mockReturnValue({
      data: {
        lists: [{
          id: 'list-1', userId: 'viewer', name: 'Saved', places: [place], isPublic: true,
          createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-02T00:00:00.000Z',
        }],
      },
      error: new Error('Network request failed'), isFetching: false, isLoading: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    useCreateListMutationMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) });
    useUpdateListsMutationMock.mockReturnValue({ mutateAsync: updateListsAsync });
    useDeletePlaceMutationMock.mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new Error('delete failed')),
    });
    useMapSearchControllerMock.mockImplementation((args) => {
      controllerArgs = args;
      return controller;
    });
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: true,
      onRefresh: action,
    }));
    getPersistedMapScreenStateMock.mockResolvedValue({
      editorData: null, editorDraft: null,
      manualViewport: { latitude: 10, longitude: 20, zoom: 7 },
      markerFilter: 'none', minimizedEditor: null, minimizedExistingPlace: null,
      selectedExistingPlace: null, selectedSearchResult: null,
      userViewport: { latitude: 11, longitude: 21, zoom: 8 },
    });
    rootIsReadyMock.mockReturnValue(true);

    const hooks = await import('@/mobile/app/features/map/application/useMapScreenState');
    const hook = renderHook(() =>
      hooks.useMapScreenState({ user: { id: 'viewer', name: 'Viewer' } }),
    );

    await waitFor(() => {
      expect(hook.result.current.markerFilter).toBe('none');
      expect(hook.result.current.effectiveViewport).toEqual({ latitude: 10, longitude: 20, zoom: 7 });
    });
    expect(hook.result.current.visibleDataErrorMessage).not.toBeNull();
    expect(hook.result.current.mapPlaces).toEqual([]);

    act(() => {
      hook.result.current.setMarkerFilter('all');
      hook.result.current.setMarkerFilter('all');
    });
    expect(hook.result.current.mapPlaces).toHaveLength(1);

    act(() => {
      controllerArgs?.setSelectedSearchResult({
        address: 'Search address', lat: 41, lng: 29, name: 'Search place', placeId: 'search-1',
      });
    });
    const searchIndex = hook.result.current.selectedSearchMarkerIndex;
    expect(searchIndex).not.toBeNull();
    act(() => {
      hook.result.current.handleMarkerPress(searchIndex!);
    });
    expect(hook.result.current.editorData).toMatchObject({ name: 'Search place' });

    act(() => {
      hook.result.current.closeEditor();
      hook.result.current.handleMarkerPress(999);
      hook.result.current.minimizeSelectedExistingPlace();
      hook.result.current.reopenMinimizedExistingPlace();
      hook.result.current.reopenMinimizedEditor();
      hook.result.current.createPlaceCardForSelectedLocation();
    });

    const draft = {
      step: 1, name: 'Draft', title: '', menuUrl: '', address: '', notes: '',
      selectedCategories: [], rating: 0, studentFriendly: false, priceMin: '', priceMax: '',
      selectedLists: ['list-1'], photos: [], bestTimes: [], atmosphere: [], features: [],
      newListName: '', newListDescription: '', newListCoverImage: '', newListPublic: true,
      showNewListForm: false,
    };
    let emptySaveSession: ReturnType<typeof hook.result.current.beginEditorSave>;
    act(() => {
      emptySaveSession = hook.result.current.beginEditorSave(draft);
    });
    act(() => {
      emptySaveSession.onBannerOpen?.();
      emptySaveSession.onBannerRetry?.();
      emptySaveSession.onBannerCancel?.();
      hook.result.current.unlockEditorAfterSaveFailure();
      hook.result.current.unlockEditorAfterSaveFailure(draft);
    });
    expect(rootNavigateMock).toHaveBeenCalledWith('MainTabs', { screen: 'Map' });

    reverseGeocodeLocationMock.mockRejectedValueOnce(new Error('provider failed'));
    reverseGeocodeAsyncMock.mockResolvedValueOnce([]);
    await act(async () => {
      await hook.result.current.handleMapPress({ lat: 42, lng: 28 });
    });
    expect(hook.result.current.editorData).toMatchObject({ lat: 42, lng: 28 });

    act(() => {
      hook.result.current.minimizeEditor(draft);
      hook.result.current.reopenMinimizedEditor();
    });
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    updateListsAsync.mockRejectedValueOnce(abortError);
    let saveSession: ReturnType<typeof hook.result.current.beginEditorSave>;
    act(() => {
      saveSession = hook.result.current.beginEditorSave(draft);
    });

    await act(async () => {
      await expect(hook.result.current.handleSavePlace(
        { name: 'Draft', lat: 42, lng: 28 }, ['list-1'],
        { abortSignal: saveSession.abortSignal },
      )).rejects.toThrow('aborted');
    });
    act(() => {
      saveSession.onBannerRetry?.();
    });
    await waitFor(() => {
      expect(updateListsAsync).toHaveBeenCalledTimes(2);
    });

    getCurrentPositionAsyncMock.mockRejectedValueOnce(new Error('gps unavailable'));
    await act(async () => {
      await hook.result.current.handleLocateUser();
      await hook.result.current.handleDeletePlace('place-1');
    });
    expect(showToastMock).toHaveBeenCalledWith(expect.any(String), 'error');

    await waitFor(() => {
      expect(savePersistedMapScreenStateMock).toHaveBeenCalled();
    });
  });
});
