import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook } from '@/mobile/app/test/hookTestUtils';

const useVisibleDataQueryMock = vi.fn();
const useHomeFeedQueryMock = vi.fn();
const useFocusRefreshMock = vi.fn();

vi.mock('@/mobile/app/data/hooks/useHomeFeedQuery', () => ({
  useHomeFeedQuery: useHomeFeedQueryMock,
}));

vi.mock('@/mobile/app/data/hooks/useVisibleDataQuery', () => ({
  useVisibleDataQuery: useVisibleDataQueryMock,
}));

vi.mock('@/mobile/app/data/query/readModelErrors', () => ({
  isMissingReadModelError: (error: { missingReadModel?: boolean } | null | undefined) =>
    Boolean(error?.missingReadModel),
}));

vi.mock('@/mobile/app/shared/hooks/useFocusRefresh', () => ({
  useFocusRefresh: useFocusRefreshMock,
}));

describe('useHomeFeedScreenState', () => {
  beforeEach(() => {
    useVisibleDataQueryMock.mockReset();
    useHomeFeedQueryMock.mockReset();
    useFocusRefreshMock.mockReset();
  });

  it('builds a feed from the current user and followed users', async () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);
    const serverRefetchMock = vi.fn().mockResolvedValue(undefined);
    const viewer = {
      id: 'viewer',
      email: 'viewer@example.com',
      name: 'Viewer',
      username: 'viewer',
      following: ['followed'],
    };

    useHomeFeedQueryMock.mockReturnValue({
      data: undefined,
      error: { missingReadModel: true },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: serverRefetchMock,
    });
    useVisibleDataQueryMock.mockReturnValue({
      data: {
        users: [
          viewer,
          { id: 'followed', email: 'followed@example.com', name: 'Followed', username: 'followed' },
          { id: 'stranger', email: 'stranger@example.com', name: 'Stranger', username: 'stranger' },
        ],
        lists: [
          {
            id: 'list-own',
            userId: 'viewer',
            name: 'Own',
            isPublic: false,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-02T00:00:00.000Z',
            places: [{ id: 'place-own', name: 'Own place', lat: 1, lng: 1, addedAt: '2025-01-01T00:00:00.000Z' }],
          },
          {
            id: 'list-followed',
            userId: 'followed',
            name: 'Followed list',
            isPublic: true,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-03T00:00:00.000Z',
            places: [{ id: 'place-followed', name: 'Followed place', lat: 2, lng: 2, addedAt: '2025-01-02T00:00:00.000Z' }],
          },
          {
            id: 'list-stranger',
            userId: 'stranger',
            name: 'Stranger list',
            isPublic: true,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-04T00:00:00.000Z',
            places: [{ id: 'place-stranger', name: 'Stranger place', lat: 3, lng: 3, addedAt: '2025-01-03T00:00:00.000Z' }],
          },
        ],
      },
      error: new Error('Request timed out after 8000ms'),
      hasPartialDataError: true,
      refetch: refetchMock,
    });

    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/home/application/useHomeFeedScreenState');
    const hook = renderHook(() => hooks.useHomeFeedScreenState({ user: viewer }));

    expect(hook.result.current.freshUser?.id).toBe('viewer');
    expect(hook.result.current.followingCount).toBe(1);
    expect(hook.result.current.feedItems.map((item) => item.listId)).toEqual([
      'list-followed',
      'list-own',
      ]);
      expect(hook.result.current.errorMessage).toBe(
        'Bağlantı geç yanıt veriyor. Lütfen tekrar dene.',
      );
      expect(hook.result.current.hasPartialDataError).toBe(true);

    await hook.result.current.onRefresh();
    await hook.result.current.retry();
    expect(refetchMock).toHaveBeenCalled();
  });

  it('handles anonymous feed access without refetching', async () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);

    useHomeFeedQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    useVisibleDataQueryMock.mockReturnValue({
      data: {
        users: [],
        lists: [
          {
            id: 'list-own',
            userId: 'viewer',
            name: 'Own',
            isPublic: false,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-02T00:00:00.000Z',
            places: [],
          },
        ],
      },
      error: null,
      hasPartialDataError: false,
      refetch: refetchMock,
    });

    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));

    const hooks = await import('@/mobile/app/features/home/application/useHomeFeedScreenState');
    const hook = renderHook(() => hooks.useHomeFeedScreenState({ user: null }));

    expect(hook.result.current.freshUser).toBeNull();
    expect(hook.result.current.followingCount).toBe(0);
    expect(hook.result.current.feedItems).toEqual([]);
    expect(hook.result.current.errorMessage).toBeNull();

    await hook.result.current.onRefresh();
    expect(refetchMock).not.toHaveBeenCalled();
  });
});
