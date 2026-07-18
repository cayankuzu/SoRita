import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useExploreQuery } from '@/mobile/app/data/hooks/useExploreQuery';
import { useHomeFeedQuery } from '@/mobile/app/data/hooks/useHomeFeedQuery';
import { useListDetailQuery } from '@/mobile/app/data/hooks/useListDetailQuery';
import { useProfileReadModelQuery } from '@/mobile/app/data/hooks/useProfileReadModelQuery';

const {
  fetchExplorePageMock,
  fetchHomeFeedPageMock,
  fetchListDetailHeaderMock,
  fetchListPlacesPageMock,
  fetchProfileContentPageMock,
  fetchProfileSummaryMock,
  useInfiniteQueryMock,
  useQueryMock,
} = vi.hoisted(() => ({
  fetchExplorePageMock: vi.fn(),
  fetchHomeFeedPageMock: vi.fn(),
  fetchListDetailHeaderMock: vi.fn(),
  fetchListPlacesPageMock: vi.fn(),
  fetchProfileContentPageMock: vi.fn(),
  fetchProfileSummaryMock: vi.fn(),
  useInfiniteQueryMock: vi.fn(),
  useQueryMock: vi.fn(),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  );

  return {
    ...actual,
    useInfiniteQuery: useInfiniteQueryMock,
    useQuery: useQueryMock,
  };
});

vi.mock('@/mobile/app/data/repositories/exploreRepository', () => ({
  fetchExplorePage: fetchExplorePageMock,
}));

vi.mock('@/mobile/app/data/repositories/homeFeedRepository', () => ({
  fetchHomeFeedPage: fetchHomeFeedPageMock,
}));

vi.mock('@/mobile/app/data/repositories/listDetailRepository', () => ({
  fetchListDetailHeader: fetchListDetailHeaderMock,
  fetchListPlacesPage: fetchListPlacesPageMock,
}));

vi.mock('@/mobile/app/data/repositories/profileRepository', () => ({
  fetchProfileContentPage: fetchProfileContentPageMock,
  fetchProfileSummary: fetchProfileSummaryMock,
}));

type QueryOptions = {
  enabled?: boolean;
  getNextPageParam?: (page: { nextCursor?: unknown }) => unknown;
  queryFn: (input: { pageParam: unknown; signal?: AbortSignal }) => Promise<unknown>;
  queryKey: readonly unknown[];
};

function createInfiniteResult(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    error: null,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetching: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: vi.fn(async () => ({ data: undefined })),
    ...overrides,
  };
}

function createQueryResult(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    error: null,
    isFetching: false,
    isLoading: false,
    refetch: vi.fn(async () => ({ data: undefined })),
    ...overrides,
  };
}

describe('read model query hooks', () => {
  beforeEach(() => {
    fetchExplorePageMock.mockReset();
    fetchHomeFeedPageMock.mockReset();
    fetchListDetailHeaderMock.mockReset();
    fetchListPlacesPageMock.mockReset();
    fetchProfileContentPageMock.mockReset();
    fetchProfileSummaryMock.mockReset();
    useInfiniteQueryMock.mockReset();
    useQueryMock.mockReset();
  });

  it('normalizes explore query input and falls back without a user', async () => {
    const capturedOptions: QueryOptions[] = [];
    useInfiniteQueryMock.mockImplementation((options: QueryOptions) => {
      capturedOptions.push(options);
      return createInfiniteResult();
    });
    fetchExplorePageMock.mockResolvedValue({ listItems: [], placeItems: [], userItems: [] });

    useExploreQuery('viewer-1', '  Coffee  ', { kind: 'places' });

    expect(capturedOptions[0]).toMatchObject({
      enabled: true,
      initialPageParam: null,
      staleTime: 300000,
    });
    await capturedOptions[0]?.queryFn({
      pageParam: { id: 'cursor-1', rank: 3 },
      signal: new AbortController().signal,
    });
    expect(fetchExplorePageMock).toHaveBeenCalledWith({
      abortSignal: expect.any(AbortSignal),
      cursor: { id: 'cursor-1', rank: 3 },
      kind: 'places',
      query: 'coffee',
      viewerId: 'viewer-1',
    });
    expect(capturedOptions[0]?.getNextPageParam?.({ nextCursor: { id: 'next', rank: 2 } })).toEqual({
      id: 'next',
      rank: 2,
    });

    useExploreQuery(null);
    await expect(capturedOptions[1]?.queryFn({ pageParam: null })).resolves.toEqual({
      listItems: [],
      placeItems: [],
      userItems: [],
    });
    expect(capturedOptions[1]?.enabled).toBe(false);
  });

  it('builds home feed query options and empty-user fallback', async () => {
    const capturedOptions: QueryOptions[] = [];
    useInfiniteQueryMock.mockImplementation((options: QueryOptions) => {
      capturedOptions.push(options);
      return createInfiniteResult();
    });
    fetchHomeFeedPageMock.mockResolvedValue({ items: [] });

    useHomeFeedQuery('viewer-1');
    await capturedOptions[0]?.queryFn({
      pageParam: { id: 'feed-1', publishedAt: '2026-07-15T10:00:00.000Z' },
    });

    expect(fetchHomeFeedPageMock).toHaveBeenCalledWith({
      cursor: { id: 'feed-1', publishedAt: '2026-07-15T10:00:00.000Z' },
      viewerId: 'viewer-1',
    });

    useHomeFeedQuery(undefined, { enabled: false });
    await expect(capturedOptions[1]?.queryFn({ pageParam: null })).resolves.toEqual({
      items: [],
    });
    expect(capturedOptions[1]?.enabled).toBe(false);
  });

  it('combines list detail header and places query state', async () => {
    const headerRefetch = vi.fn(async () => ({ data: { list: { id: 'list-1' } } }));
    const placesRefetch = vi.fn(async () => ({
      data: {
        pages: [{ items: [{ id: 'place-2' }] }],
      },
    }));
    const capturedInfiniteOptions: QueryOptions[] = [];
    const capturedQueryOptions: Array<{
      queryFn: () => Promise<unknown>;
      enabled?: boolean;
    }> = [];

    useQueryMock.mockImplementation((options) => {
      capturedQueryOptions.push(options);
      return createQueryResult({
        data: { list: { id: 'list-1' } },
        refetch: headerRefetch,
      });
    });
    useInfiniteQueryMock.mockImplementation((options: QueryOptions) => {
      capturedInfiniteOptions.push(options);
      return createInfiniteResult({
        data: {
          pages: [{ items: [{ id: 'place-1' }] }],
        },
        hasNextPage: true,
        refetch: placesRefetch,
      });
    });
    fetchListDetailHeaderMock.mockResolvedValue({ list: { id: 'list-1' } });
    fetchListPlacesPageMock.mockResolvedValue({ items: [] });

    const state = useListDetailQuery('list-1', 'viewer-1');

    expect(state.header).toEqual({ list: { id: 'list-1' } });
    expect(state.places).toEqual([{ id: 'place-1' }]);
    await expect(capturedQueryOptions[0]?.queryFn()).resolves.toEqual({ list: { id: 'list-1' } });
    await capturedInfiniteOptions[0]?.queryFn({ pageParam: { id: 'place-1', addedAt: 'now' } });
    expect(fetchListPlacesPageMock).toHaveBeenCalledWith({
      cursor: { id: 'place-1', addedAt: 'now' },
      listId: 'list-1',
      viewerId: 'viewer-1',
    });
    await expect(state.refetch()).resolves.toEqual({
      header: { list: { id: 'list-1' } },
      places: [{ id: 'place-2' }],
    });

    useListDetailQuery(null);
    await expect(capturedQueryOptions[1]?.queryFn()).resolves.toBeNull();
    await expect(capturedInfiniteOptions[1]?.queryFn({ pageParam: null })).resolves.toEqual({
      items: [],
    });
  });

  it('combines profile summary and content query state', async () => {
    const summaryRefetch = vi.fn(async () => ({
      data: {
        canViewContent: true,
        user: { id: 'user-1' },
      },
    }));
    const listsRefetch = vi.fn(async () => ({ data: { pages: [{ lists: [{ id: 'list-2' }] }] } }));
    const placesRefetch = vi.fn(async () => ({
      data: { pages: [{ places: [{ key: 'list-1:place-2' }] }] },
    }));
    const fetchNextPageMock = vi.fn();
    const capturedInfiniteOptions: QueryOptions[] = [];
    const capturedQueryOptions: Array<{
      queryFn: () => Promise<unknown>;
      enabled?: boolean;
    }> = [];

    useQueryMock.mockImplementation((options) => {
      capturedQueryOptions.push(options);
      return createQueryResult({
        data: {
          canViewContent: true,
          user: { id: 'user-1' },
        },
        refetch: summaryRefetch,
      });
    });
    useInfiniteQueryMock
      .mockImplementationOnce((options: QueryOptions) => {
        capturedInfiniteOptions.push(options);
        return createInfiniteResult({
          data: { pages: [{ lists: [{ id: 'list-1' }], places: [] }] },
          fetchNextPage: fetchNextPageMock,
          hasNextPage: true,
          refetch: listsRefetch,
        });
      })
      .mockImplementationOnce((options: QueryOptions) => {
        capturedInfiniteOptions.push(options);
        return createInfiniteResult({
          data: { pages: [{ lists: [], places: [{ key: 'list-1:place-1' }] }] },
          hasNextPage: false,
          refetch: placesRefetch,
        });
      });
    fetchProfileSummaryMock.mockResolvedValue({ canViewContent: true, user: { id: 'user-1' } });
    fetchProfileContentPageMock.mockResolvedValue({ lists: [], places: [] });

    const state = useProfileReadModelQuery('user-1', 'viewer-1');

    expect(state.summary).toMatchObject({ canViewContent: true });
    expect(state.lists).toEqual([{ id: 'list-1' }]);
    expect(state.places).toEqual([{ key: 'list-1:place-1' }]);
    await expect(capturedQueryOptions[0]?.queryFn()).resolves.toEqual({
      canViewContent: true,
      user: { id: 'user-1' },
    });
    await capturedInfiniteOptions[0]?.queryFn({ pageParam: { id: 'list-1', sortAt: 'now' } });
    expect(fetchProfileContentPageMock).toHaveBeenCalledWith({
      cursor: { id: 'list-1', sortAt: 'now' },
      tab: 'lists',
      userId: 'user-1',
      viewerId: 'viewer-1',
    });

    await state.fetchNextPage();
    expect(fetchNextPageMock).toHaveBeenCalledTimes(1);
    await expect(state.refetch()).resolves.toEqual({
      lists: [{ id: 'list-2' }],
      places: [{ key: 'list-1:place-2' }],
      summary: {
        canViewContent: true,
        user: { id: 'user-1' },
      },
    });
  });
});
