import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook } from '@/mobile/app/test/hookTestUtils';
import { colors } from '@/mobile/app/shared/theme/tokens';

const useVisibleDataQueryMock = vi.fn();
const useListDetailQueryMock = vi.fn();
const useReportListMutationMock = vi.fn();
const useDeletePlaceMutationMock = vi.fn();
const useFocusRefreshMock = vi.fn();

vi.mock('@/mobile/app/data/hooks/useListDetailQuery', () => ({
  useListDetailQuery: useListDetailQueryMock,
}));

vi.mock('@/mobile/app/data/hooks/useVisibleDataQuery', () => ({
  useVisibleDataQuery: useVisibleDataQueryMock,
}));

vi.mock('@/mobile/app/data/hooks/useListMutations', () => ({
  useReportListMutation: useReportListMutationMock,
}));

vi.mock('@/mobile/app/data/hooks/usePlaceMutations', () => ({
  useDeletePlaceMutation: useDeletePlaceMutationMock,
}));

vi.mock('@/mobile/app/shared/hooks/useFocusRefresh', () => ({
  useFocusRefresh: useFocusRefreshMock,
}));

describe('useListDetailScreenState', () => {
  beforeEach(() => {
    useVisibleDataQueryMock.mockReset();
    useListDetailQueryMock.mockReset();
    useReportListMutationMock.mockReset();
    useDeletePlaceMutationMock.mockReset();
    useFocusRefreshMock.mockReset();
  });

  it('resolves list detail state and delegates mutations', async () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);
    const readModelRefetchMock = vi.fn().mockResolvedValue(undefined);
    const reportListAsync = vi.fn().mockResolvedValue(undefined);
    const deletePlaceAsync = vi.fn().mockResolvedValue(undefined);
    const user = {
      id: 'viewer',
      email: 'viewer@example.com',
      name: 'Viewer',
      username: 'viewer',
    };
    const list = {
      id: 'list-1',
      userId: 'owner-1',
      name: 'Favorites',
      isPublic: true,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      places: [{ id: 'place-1', name: 'Cafe', lat: 1, lng: 2, addedAt: '2025-01-01T00:00:00.000Z' }],
    };
    const privateList = {
      id: 'list-2',
      userId: 'owner-1',
      name: 'Private',
      isPublic: false,
      createdAt: '2025-01-02T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
      places: [{ id: 'place-2', name: 'Cafe', lat: 1, lng: 2, addedAt: '2025-01-02T00:00:00.000Z' }],
    };

    useListDetailQueryMock.mockReturnValue({
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      header: {
        list: {
          ...list,
          places: undefined,
        },
        owner: { id: 'owner-1', email: 'owner@example.com', name: 'Owner', username: 'owner' },
      },
      isFetchingNextPage: false,
      isLoading: false,
      places: list.places,
      refetch: readModelRefetchMock,
    });
    useVisibleDataQueryMock.mockReturnValue({
      data: {
        users: [user, { id: 'owner-1', email: 'owner@example.com', name: 'Owner', username: 'owner' }],
        lists: [list, privateList],
      },
      refetch: refetchMock,
    });
    useReportListMutationMock.mockReturnValue({ mutateAsync: reportListAsync });
    useDeletePlaceMutationMock.mockReturnValue({ mutateAsync: deletePlaceAsync });
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/lists/application/useListDetailScreenState');
    const hook = renderHook(() => hooks.useListDetailScreenState({ listId: 'list-1', user }));

    expect(hook.result.current.list?.id).toBe('list-1');
    expect(hook.result.current.owner?.id).toBe('owner-1');
    expect(hook.result.current.isOwner).toBe(false);
    expect(hook.result.current.canReportList).toBe(true);
    expect(hook.result.current.mapPlaces).toHaveLength(1);
    expect(hook.result.current.mapPlaces[0]?.markerColor).toBe(colors.secondary);
    expect(hook.result.current.placeMarkerColorsById.get('place-1')).toBe(colors.secondary);

    await hook.result.current.deletePlace('place-1');
    await hook.result.current.reportList('spam');

    expect(deletePlaceAsync).toHaveBeenCalledWith('place-1');
    expect(reportListAsync).toHaveBeenCalledWith({
      details: undefined,
      reporterUserId: 'viewer',
      listId: 'list-1',
      reason: 'spam',
    });

    await hook.result.current.onRefresh();
    expect(readModelRefetchMock).toHaveBeenCalled();
  });

  it('uses paginated read-model details and preserves partial content on errors', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    const fetchNextPage = vi.fn().mockResolvedValue(undefined);
    const reportListAsync = vi.fn().mockResolvedValue(undefined);
    const user = {
      id: 'viewer', email: 'viewer@example.com', name: 'Viewer', username: 'viewer',
    };
    const list = {
      id: 'list-1', userId: user.id, name: 'Mine', isPublic: false,
      createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-02T00:00:00.000Z',
    };
    const place = {
      id: 'place-1', name: 'Cafe', lat: 1, lng: 2,
      addedAt: '2025-01-01T00:00:00.000Z',
    };

    useListDetailQueryMock.mockReturnValue({
      error: new Error('Network request failed'), fetchNextPage, hasNextPage: true,
      header: { list, owner: user }, isFetchingNextPage: true, isLoading: false,
      places: [place], refetch,
    });
    useVisibleDataQueryMock.mockReturnValue({
      data: undefined, error: null, fetchNextPage: undefined, hasNextPage: false,
      hasPartialDataError: false, isFetchingNextPage: false, isLoading: false,
      refetch: vi.fn(),
    });
    useReportListMutationMock.mockReturnValue({ mutateAsync: reportListAsync });
    useDeletePlaceMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: true,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/lists/application/useListDetailScreenState');
    const hook = renderHook(() => hooks.useListDetailScreenState({ listId: list.id, user }));

    expect(hook.result.current.list).toMatchObject({ id: list.id, places: [place] });
    expect(hook.result.current.owner?.id).toBe(user.id);
    expect(hook.result.current.isOwner).toBe(true);
    expect(hook.result.current.canReportList).toBe(false);
    expect(hook.result.current.displayPlaces).toEqual([place]);
    expect(hook.result.current.mapPlaces).toHaveLength(1);
    expect(hook.result.current.fetchNextPage).toBe(fetchNextPage);
    expect(hook.result.current.hasNextPage).toBe(true);
    expect(hook.result.current.isFetchingNextPage).toBe(true);
    expect(hook.result.current.hasPartialDataError).toBe(true);
    expect(hook.result.current.isInitialLoading).toBe(false);
    expect(hook.result.current.errorMessage).not.toBeNull();
    expect(hook.result.current.refreshing).toBe(true);

    await hook.result.current.retry();
    await hook.result.current.reportList('other', 'details');
    expect(refetch).toHaveBeenCalledOnce();
    expect(reportListAsync).toHaveBeenCalledWith({
      reporterUserId: user.id, listId: list.id, reason: 'other', details: 'details',
    });
  });

  it('handles missing canonical lists and initial loading safely', async () => {
    useListDetailQueryMock.mockReturnValue({
      error: { missingReadModel: true }, fetchNextPage: undefined, hasNextPage: false,
      header: null, isFetchingNextPage: false, isLoading: false, places: [],
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    useVisibleDataQueryMock.mockReturnValue({
      data: { users: [], lists: [] }, error: null, fetchNextPage: vi.fn(),
      hasNextPage: true, hasPartialDataError: true, isFetchingNextPage: true,
      isLoading: true, refetch: vi.fn().mockResolvedValue(undefined),
    });
    useReportListMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    useDeletePlaceMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/lists/application/useListDetailScreenState');
    const missingHook = renderHook(() =>
      hooks.useListDetailScreenState({ listId: 'missing', user: null }),
    );

    expect(missingHook.result.current.list).toBeNull();
    expect(missingHook.result.current.owner).toBeNull();
    expect(missingHook.result.current.displayPlaces).toEqual([]);
    expect(missingHook.result.current.mapPlaces).toEqual([]);
    expect(missingHook.result.current.placeMarkerColorsById.size).toBe(0);
    expect(missingHook.result.current.isOwner).toBe(false);
    expect(missingHook.result.current.canReportList).toBe(false);
    expect(missingHook.result.current.hasPartialDataError).toBe(false);
    await expect(missingHook.result.current.reportList('spam')).rejects.toThrow();

    useListDetailQueryMock.mockReturnValue({
      error: null, fetchNextPage: undefined, hasNextPage: false, header: null,
      isFetchingNextPage: false, isLoading: true, places: [],
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    const loadingHook = renderHook(() =>
      hooks.useListDetailScreenState({ listId: 'loading', user: null }),
    );
    expect(loadingHook.result.current.isInitialLoading).toBe(true);
    expect(loadingHook.result.current.hasPartialDataError).toBe(false);
  });
});
