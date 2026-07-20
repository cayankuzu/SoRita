import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook } from '@/mobile/app/test/hookTestUtils';

const useHomeFeedQueryMock = vi.fn();
const useFocusRefreshMock = vi.fn();

vi.mock('@/mobile/app/data/hooks/useHomeFeedQuery', () => ({
  useHomeFeedQuery: useHomeFeedQueryMock,
}));

vi.mock('@/mobile/app/shared/hooks/useFocusRefresh', () => ({
  useFocusRefresh: useFocusRefreshMock,
}));

function createFeedQuery(overrides: Record<string, unknown> = {}) {
  return {
    data: { pages: [{ items: [] }] },
    error: null,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchedAfterMount: true,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('useHomeFeedScreenState', () => {
  beforeEach(() => {
    useHomeFeedQueryMock.mockReset();
    useFocusRefreshMock.mockImplementation((action: () => Promise<void>) => ({
      refreshing: false,
      onRefresh: action,
    }));
  });

  it('uses the canonical feed, removes duplicate keys, and preserves stale data on error', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    const first = { key: 'feed-1', listId: 'list-1' };
    const second = { key: 'feed-2', listId: 'list-2' };
    useHomeFeedQueryMock.mockReturnValue(createFeedQuery({
      data: { pages: [{ items: [first, second] }, { items: [first] }] },
      error: new Error('Request timed out after 8000ms'),
      refetch,
    }));
    const viewer = {
      email: 'viewer@example.com',
      following: ['followed'],
      id: 'viewer',
      name: 'Viewer',
      username: 'viewer',
    };

    const hooks = await import('@/mobile/app/features/home/application/useHomeFeedScreenState');
    const hook = renderHook(() => hooks.useHomeFeedScreenState({ user: viewer }));

    expect(hook.result.current.feedItems.map((item) => item.key)).toEqual([
      'feed-1',
      'feed-2',
    ]);
    expect(hook.result.current.followingCount).toBe(1);
    expect(hook.result.current.hasPartialDataError).toBe(true);
    await hook.result.current.onRefresh();
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('handles anonymous feed access without refetching', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    useHomeFeedQueryMock.mockReturnValue(createFeedQuery({ data: undefined, refetch }));

    const hooks = await import('@/mobile/app/features/home/application/useHomeFeedScreenState');
    const hook = renderHook(() => hooks.useHomeFeedScreenState({ user: null }));

    expect(hook.result.current.freshUser).toBeNull();
    expect(hook.result.current.feedItems).toEqual([]);
    await hook.result.current.onRefresh();
    expect(refetch).not.toHaveBeenCalled();
  });
});
