import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook } from '@/mobile/app/test/hookTestUtils';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';

const fetchListDetailHeaderMock = vi.fn();
const fetchListPlacesPageMock = vi.fn();
const useInfiniteQueryMock = vi.fn();
const useQueryMock = vi.fn();

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useInfiniteQuery: useInfiniteQueryMock,
    useQuery: useQueryMock,
  };
});

vi.mock('@/mobile/app/data/repositories/listDetailRepository', () => ({
  fetchListDetailHeader: fetchListDetailHeaderMock,
  fetchListPlacesPage: fetchListPlacesPageMock,
}));

function createHeader(overrides: Record<string, unknown> = {}) {
  return {
    data: null,
    error: null,
    isFetching: false,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

function createPlaces(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    error: null,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetching: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

describe('useListDetailQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps both queries disabled and safely refetches without a list id', async () => {
    const placesError = new Error('places failed');
    const header = createHeader({ refetch: vi.fn().mockRejectedValue(new Error('header failed')) });
    const places = createPlaces({
      error: placesError,
      refetch: vi.fn().mockRejectedValue(placesError),
    });
    useQueryMock.mockReturnValue(header);
    useInfiniteQueryMock.mockReturnValue(places);
    const { useListDetailQuery } = await import('@/mobile/app/data/hooks/useListDetailQuery');
    const hook = renderHook(() => useListDetailQuery(undefined, undefined));
    const headerOptions = useQueryMock.mock.calls[0]![0];
    const placesOptions = useInfiniteQueryMock.mock.calls[0]![0];

    expect(headerOptions.enabled).toBe(false);
    expect(placesOptions.enabled).toBe(false);
    expect(headerOptions.queryKey).toBe(queryKeys.list.all);
    expect(placesOptions.queryKey).toBe(queryKeys.list.all);
    await expect(headerOptions.queryFn()).resolves.toBeNull();
    await expect(placesOptions.queryFn({ pageParam: null })).resolves.toEqual({ items: [] });
    expect(hook.result.current.error).toBe(placesError);

    await expect(hook.result.current.refetch()).resolves.toEqual({
      header: null,
      places: [],
    });
  });

  it('loads a list and returns fulfilled refetch data', async () => {
    const headerData = { id: 'list-1', name: 'List' };
    const place = { id: 'place-1', name: 'Place' };
    const header = createHeader({
      data: headerData,
      isFetching: true,
      refetch: vi.fn().mockResolvedValue({ data: headerData }),
    });
    const places = createPlaces({
      data: { pageParams: [null], pages: [{ items: [place] }] },
      isLoading: true,
      refetch: vi.fn().mockResolvedValue({ data: undefined }),
    });
    useQueryMock.mockReturnValue(header);
    useInfiniteQueryMock.mockReturnValue(places);
    fetchListDetailHeaderMock.mockResolvedValue(headerData);
    fetchListPlacesPageMock.mockResolvedValue({ items: [place] });
    const { useListDetailQuery } = await import('@/mobile/app/data/hooks/useListDetailQuery');
    const hook = renderHook(() => useListDetailQuery('list-1', 'viewer'));
    const headerOptions = useQueryMock.mock.calls[0]![0];
    const placesOptions = useInfiniteQueryMock.mock.calls[0]![0];

    expect(headerOptions.enabled).toBe(true);
    expect(placesOptions.enabled).toBe(true);
    await expect(headerOptions.queryFn()).resolves.toBe(headerData);
    await expect(placesOptions.queryFn({ pageParam: null })).resolves.toEqual({ items: [place] });
    expect(hook.result.current.isFetching).toBe(true);
    expect(hook.result.current.isLoading).toBe(true);
    expect(hook.result.current.places).toEqual([place]);

    await act(async () => {
      await expect(hook.result.current.refetch()).resolves.toEqual({
        header: headerData,
        places: [],
      });
    });
  });
});
