import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useExploreQuery } from '@/mobile/app/data/hooks/useExploreQuery';
import { useHomeFeedQuery } from '@/mobile/app/data/hooks/useHomeFeedQuery';
import { useListDetailQuery } from '@/mobile/app/data/hooks/useListDetailQuery';
import { MAP_MARKERS_STALE_TIME_MS, useMapMarkersQuery } from '@/mobile/app/data/hooks/useMapMarkersQuery';
import { useProfileReadModelQuery } from '@/mobile/app/data/hooks/useProfileReadModelQuery';

const {
  fetchExplorePageMock,
  fetchHomeFeedPageMock,
  fetchListDetailHeaderMock,
  fetchListPlacesPageMock,
  fetchOwnedMapMarkersMock,
  fetchProfileContentPageMock,
  fetchProfileSummaryMock,
  useInfiniteQueryMock,
  useQueryMock,
} = vi.hoisted(() => ({
  fetchExplorePageMock: vi.fn(),
  fetchHomeFeedPageMock: vi.fn(),
  fetchListDetailHeaderMock: vi.fn(),
  fetchListPlacesPageMock: vi.fn(),
  fetchOwnedMapMarkersMock: vi.fn(),
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

vi.mock('@/mobile/app/data/repositories/mapMarkersRepository', () => ({
  fetchOwnedMapMarkers: fetchOwnedMapMarkersMock,
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
    fetchOwnedMapMarkersMock.mockReset();
    fetchProfileContentPageMock.mockReset();
    fetchProfileSummaryMock.mockReset();
    useInfiniteQueryMock.mockReset();
    useQueryMock.mockReset();
  });

  it('builds the lightweight map marker query with an empty-user fallback', async () => {
    const options: Array<{
      enabled: boolean;
      queryFn: () => Promise<unknown>;
      queryKey: readonly unknown[];
      staleTime: number;
    }> = [];
    useQueryMock.mockImplementation((input) => {
      options.push(input);
      return createQueryResult();
    });
    fetchOwnedMapMarkersMock.mockResolvedValue([{ targetLocationKey: '41:29' }]);

    useMapMarkersQuery('viewer-1');
    expect(options[0]).toMatchObject({
      enabled: true,
      queryKey: ['map', 'markers', 'viewer-1'],
      staleTime: MAP_MARKERS_STALE_TIME_MS,
    });
    await expect(options[0]?.queryFn()).resolves.toEqual([{ targetLocationKey: '41:29' }]);
    expect(fetchOwnedMapMarkersMock).toHaveBeenCalledWith('viewer-1');

    useMapMarkersQuery(null);
    expect(options[1]).toMatchObject({ enabled: false, queryKey: ['map'] });
    await expect(options[1]?.queryFn()).resolves.toEqual([]);
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

  it('keeps profile queries disabled without both identities and returns empty query functions', async () => {
    const queryOptions: Array<Record<string, unknown> & { queryFn: (input?: { signal?: AbortSignal }) => Promise<unknown> }> = [];
    const infiniteOptions: QueryOptions[] = [];
    useQueryMock.mockImplementation((options) => {
      queryOptions.push(options);
      return createQueryResult();
    });
    useInfiniteQueryMock.mockImplementation((options: QueryOptions) => {
      infiniteOptions.push(options);
      return createInfiniteResult();
    });

    const missingTarget = useProfileReadModelQuery(null, 'viewer-1');
    expect(queryOptions[0]?.enabled).toBe(false);
    await expect(queryOptions[0]?.queryFn()).resolves.toBeNull();
    await expect(infiniteOptions[0]?.queryFn({ pageParam: null })).resolves.toEqual({ lists: [], places: [] });
    await expect(infiniteOptions[1]?.queryFn({ pageParam: null })).resolves.toEqual({ lists: [], places: [] });
    expect(missingTarget).toMatchObject({ hasNextPage: false, hasPartialDataError: false, isLoading: false });

    useProfileReadModelQuery('user-1', null, { enabled: false });
    expect(queryOptions[1]?.enabled).toBe(false);
    expect(infiniteOptions[2]?.enabled).toBe(false);
    expect(infiniteOptions[3]?.enabled).toBe(false);
  });

  it('loads only the active profile tab and forwards AbortSignal through every query', async () => {
    const queryOptions: Array<{ queryFn: (input?: { signal?: AbortSignal }) => Promise<unknown> }> = [];
    const infiniteOptions: QueryOptions[] = [];
    useQueryMock.mockImplementation((options) => {
      queryOptions.push(options);
      return createQueryResult({
        data: { canViewContent: true, user: { id: 'user-1' } },
        isFetching: true,
      });
    });
    useInfiniteQueryMock
      .mockImplementationOnce((options: QueryOptions) => {
        infiniteOptions.push(options);
        return createInfiniteResult({
          data: { pages: [{ lists: [{ id: 'list-1' }], places: [] }] },
          error: new Error('lists partial'),
          hasNextPage: true,
          isFetching: true,
          isFetchingNextPage: true,
          isLoading: true,
        });
      })
      .mockImplementationOnce((options: QueryOptions) => {
        infiniteOptions.push(options);
        return createInfiniteResult({
          data: { pages: [{ lists: [], places: [{ key: 'place-1' }] }] },
          error: new Error('places ignored'),
          hasNextPage: true,
          isFetching: true,
          isFetchingNextPage: true,
          isLoading: true,
        });
      });
    fetchProfileSummaryMock.mockResolvedValue({ canViewContent: true });
    fetchProfileContentPageMock.mockResolvedValue({ lists: [], places: [] });

    const signal = new AbortController().signal;
    const state = useProfileReadModelQuery('user-1', 'viewer-1', { activeTab: 'lists' });
    await queryOptions[0]?.queryFn({ signal });
    await queryOptions[0]?.queryFn();
    await infiniteOptions[0]?.queryFn({ pageParam: null, signal });
    await infiniteOptions[1]?.queryFn({ pageParam: null, signal });
    expect(fetchProfileSummaryMock).toHaveBeenNthCalledWith(1, 'user-1', signal);
    expect(fetchProfileSummaryMock).toHaveBeenNthCalledWith(2, 'user-1');
    expect(fetchProfileContentPageMock).toHaveBeenCalledWith(expect.objectContaining({ signal, tab: 'lists' }));
    expect(fetchProfileContentPageMock).toHaveBeenCalledWith(expect.objectContaining({ signal, tab: 'places' }));
    expect(infiniteOptions[0]?.enabled).toBe(true);
    expect(infiniteOptions[1]?.enabled).toBe(false);
    expect(state).toMatchObject({
      error: expect.any(Error), hasNextPage: true, hasPartialDataError: true,
      isFetching: true, isFetchingNextPage: true, isLoading: true,
    });
    await state.fetchNextPage();

    expect((state as unknown as { lists: unknown[] }).lists).toEqual([{ id: 'list-1' }]);
  });

  it('uses existing profile data when refetch cannot view content and preserves pages on rejected refetches', async () => {
    const existingSummary = { canViewContent: true, user: { id: 'user-1' } };
    useQueryMock.mockReturnValue(createQueryResult({
      data: existingSummary,
      error: new Error('summary stale'),
      refetch: vi.fn()
        .mockResolvedValueOnce({ data: { canViewContent: false, user: { id: 'user-1' } } })
        .mockResolvedValueOnce({ data: undefined }),
    }));
    useInfiniteQueryMock
      .mockReturnValueOnce(createInfiniteResult({
        data: { pages: [{ lists: [{ id: 'list-old' }], places: [] }] },
        refetch: vi.fn().mockRejectedValue(new Error('lists failed')),
      }))
      .mockReturnValueOnce(createInfiniteResult({
        data: { pages: [{ lists: [], places: [{ key: 'place-old' }] }] },
        refetch: vi.fn().mockRejectedValue(new Error('places failed')),
      }));

    const state = useProfileReadModelQuery('user-1', 'viewer-1', { activeTab: 'gallery' });
    await expect(state.refetch()).resolves.toEqual({
      lists: [{ id: 'list-old' }],
      places: [{ key: 'place-old' }],
      summary: { canViewContent: false, user: { id: 'user-1' } },
    });
    await expect(state.refetch()).resolves.toEqual({
      lists: [{ id: 'list-old' }],
      places: [{ key: 'place-old' }],
      summary: existingSummary,
    });
  });
});
