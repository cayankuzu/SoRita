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

vi.mock('@/mobile/app/data/query/readModelErrors', () => ({
  isMissingReadModelError: (error: { missingReadModel?: boolean } | null | undefined) =>
    Boolean(error?.missingReadModel),
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
      error: { missingReadModel: true },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      header: null,
      isFetchingNextPage: false,
      isLoading: false,
      places: [],
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
    expect(hook.result.current.mapPlaces[0]?.markerColor).toBe(colors.primary);
    expect(hook.result.current.placeMarkerColorsById.get('place-1')).toBe(colors.primary);

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
    expect(refetchMock).toHaveBeenCalled();
  });
});
