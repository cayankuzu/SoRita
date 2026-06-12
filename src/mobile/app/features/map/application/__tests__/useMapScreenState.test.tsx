import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';

const requestForegroundPermissionsAsyncMock = vi.fn();
const getCurrentPositionAsyncMock = vi.fn();
const reverseGeocodeAsyncMock = vi.fn();
const reverseGeocodeLocationMock = vi.fn();
const useVisibleDataQueryMock = vi.fn();
const useCreateListMutationMock = vi.fn();
const useUpdateListsMutationMock = vi.fn();
const useDeletePlaceMutationMock = vi.fn();
const useMapSearchControllerMock = vi.fn();
const useFocusRefreshMock = vi.fn();
const showToastMock = vi.fn();

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

describe('useMapScreenState', () => {
  beforeEach(() => {
    requestForegroundPermissionsAsyncMock.mockReset();
    getCurrentPositionAsyncMock.mockReset();
    reverseGeocodeAsyncMock.mockReset();
    reverseGeocodeLocationMock.mockReset();
    useVisibleDataQueryMock.mockReset();
    useCreateListMutationMock.mockReset();
    useUpdateListsMutationMock.mockReset();
    useDeletePlaceMutationMock.mockReset();
    useMapSearchControllerMock.mockReset();
    useFocusRefreshMock.mockReset();
    showToastMock.mockReset();

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

    expect(hook.result.current.lists).toEqual([]);

    act(() => {
      hook.result.current.minimizeEditor({
        step: 1,
        name: '',
        title: '',
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

    expect(updateListsAsync).not.toHaveBeenCalled();
    expect(createListAsync).not.toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith(expect.any(String), 'error');
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
    expect(hook.result.current.effectiveViewport).toEqual({
      latitude: 39.93,
      longitude: 32.85,
      zoom: 15,
    });

    act(() => {
      hook.result.current.closeSelectedExistingPlace();
    });
    expect(hook.result.current.selectedExistingEntry).toBeNull();
    expect(hook.result.current.effectiveViewport).toBeNull();

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
});
