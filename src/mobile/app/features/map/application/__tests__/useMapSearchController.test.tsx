import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';

const searchPlacesByTextMock = vi.fn();
const showToastMock = vi.fn();

vi.mock('@/mobile/app/platform/api/geocoding', () => ({
  searchPlacesByText: searchPlacesByTextMock,
}));

vi.mock('@/mobile/app/platform/feedback/toast', () => ({
  showToast: showToastMock,
}));

describe('useMapSearchController', () => {
  beforeEach(() => {
    searchPlacesByTextMock.mockReset();
    showToastMock.mockReset();
    vi.useRealTimers();
  });

  it('debounces search queries and opens existing places when matched', async () => {
    vi.useFakeTimers();
    searchPlacesByTextMock.mockResolvedValue([
      { lat: 39.9334, lng: 32.8597, name: 'Kahve Dunyasi', address: 'Ankara' },
    ]);
    const openEditorPanel = vi.fn();
    const openExistingPlacePanel = vi.fn();
    const setManualViewport = vi.fn();
    const setSelectedSearchResult = vi.fn();

    const hooks = await import('@/mobile/app/features/map/application/useMapSearchController');
    const hook = renderHook(() =>
      hooks.useMapSearchController({
        allPlaces: [
          {
            list: {
              id: 'list-1',
              userId: 'viewer',
              name: 'List',
              places: [],
              isPublic: true,
              createdAt: '2025-01-01T00:00:00.000Z',
              updatedAt: '2025-01-01T00:00:00.000Z',
            },
            place: {
              id: 'place-1',
              name: 'Kahve Dunyasi',
              lat: 39.9334,
              lng: 32.8597,
              addedAt: '2025-01-01T00:00:00.000Z',
            },
          },
        ],
        openEditorPanel,
        openExistingPlacePanel,
        selectedSearchResult: null,
        setManualViewport,
        setSelectedSearchResult,
      }),
    );

    act(() => {
      hook.result.current.handleSearchQueryChange('kahve');
    });

    await vi.advanceTimersByTimeAsync(451);

    await waitFor(() => {
      expect(hook.result.current.searchResults).toHaveLength(1);
    });

    act(() => {
      hook.result.current.handleSearchResultPress({
        placeId: 'search-1',
        lat: 39.9334,
        lng: 32.8597,
        name: 'Kahve Dunyasi',
        address: 'Ankara',
      });
    });

    expect(openExistingPlacePanel).toHaveBeenCalled();
    expect(openEditorPanel).not.toHaveBeenCalled();
  });

  it('opens the editor for a new place and surfaces explicit search errors', async () => {
    vi.useFakeTimers();
    searchPlacesByTextMock.mockRejectedValue(new Error('network'));
    const openEditorPanel = vi.fn();
    const openExistingPlacePanel = vi.fn();
    const setManualViewport = vi.fn();
    const setSelectedSearchResult = vi.fn();

    const hooks = await import('@/mobile/app/features/map/application/useMapSearchController');
    const hook = renderHook(() =>
      hooks.useMapSearchController({
        allPlaces: [],
        openEditorPanel,
        openExistingPlacePanel,
        selectedSearchResult: null,
        setManualViewport,
        setSelectedSearchResult,
      }),
    );

    act(() => {
      hook.result.current.handleSearchQueryChange('ankara');
    });
    await vi.advanceTimersByTimeAsync(451);
    await waitFor(() => {
      expect(hook.result.current.hasSearched).toBe(true);
    });

    act(() => {
      hook.result.current.runSearch();
    });
    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalled();
    });

    act(() => {
      hook.result.current.handleSearchResultPress({
        placeId: 'search-2',
        lat: 39.92,
        lng: 32.85,
        name: 'New Cafe',
        address: 'Ankara',
      });
    });

    expect(setManualViewport).toHaveBeenCalledWith({
      latitude: 39.92,
      longitude: 32.85,
      zoom: 14.5,
    });
    expect(setSelectedSearchResult).toHaveBeenCalled();
    expect(openEditorPanel).toHaveBeenCalled();
  });

  it('clears the manual viewport together with search state', async () => {
    const openEditorPanel = vi.fn();
    const openExistingPlacePanel = vi.fn();
    const setManualViewport = vi.fn();
    const setSelectedSearchResult = vi.fn();

    const hooks = await import('@/mobile/app/features/map/application/useMapSearchController');
    const hook = renderHook(() =>
      hooks.useMapSearchController({
        allPlaces: [],
        openEditorPanel,
        openExistingPlacePanel,
        selectedSearchResult: {
          placeId: 'search-1',
          lat: 39.92,
          lng: 32.85,
          name: 'Cafe',
          address: 'Ankara',
        },
        setManualViewport,
        setSelectedSearchResult,
      }),
    );

    act(() => {
      hook.result.current.clearSearch();
    });

    expect(setManualViewport).toHaveBeenCalledWith(null);
    expect(setSelectedSearchResult).toHaveBeenCalledWith(null);
    expect(hook.result.current.searchQuery).toBe('');
  });
});
