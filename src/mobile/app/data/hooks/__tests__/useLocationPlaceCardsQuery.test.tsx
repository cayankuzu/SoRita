import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import type {
  LocationPlaceCardEntry,
  LocationPlaceCardsPage,
} from '@/mobile/app/data/repositories/locationPlaceCardsRepository';
import { renderHook } from '@/mobile/app/test/hookTestUtils';

const fetchLocationPlaceCardsPageMock = vi.fn();
const useInfiniteQueryMock = vi.fn();

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useInfiniteQuery: useInfiniteQueryMock };
});

vi.mock('@/mobile/app/data/repositories/locationPlaceCardsRepository', () => ({
  fetchLocationPlaceCardsPage: fetchLocationPlaceCardsPageMock,
}));

describe('useLocationPlaceCardsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses public query identity and safe empty defaults before data arrives', async () => {
    useInfiniteQueryMock.mockReturnValue({ data: undefined, isLoading: true });
    const { useLocationPlaceCardsQuery } = await import(
      '@/mobile/app/data/hooks/useLocationPlaceCardsQuery'
    );
    const hook = renderHook(() =>
      useLocationPlaceCardsQuery({ lat: 41.01, lng: 29.02, viewerId: null }),
    );
    const options = useInfiniteQueryMock.mock.calls[0]![0];

    expect(options.queryKey).toEqual(
      queryKeys.map.locationCards('__public__', 41.01, 29.02, undefined, undefined),
    );
    expect(hook.result.current.entries).toEqual([]);
    expect(hook.result.current.markerVisibility).toBe('public');
    expect(hook.result.current.totalCount).toBe(0);

    const cursor = { id: 'place-1', updatedAt: '2026-08-17T12:00:00.000Z' };
    fetchLocationPlaceCardsPageMock.mockResolvedValue({ items: [] });
    await options.queryFn({ pageParam: cursor });
    expect(fetchLocationPlaceCardsPageMock).toHaveBeenCalledWith({
      cursor,
      lat: 41.01,
      lng: 29.02,
      viewerId: null,
    });
    expect(options.getNextPageParam({ nextCursor: cursor })).toBe(cursor);
  });

  it('flattens pages and exposes the first page metadata for a signed-in viewer', async () => {
    const firstEntry = { place: { id: 'place-1' } } as LocationPlaceCardEntry;
    const secondEntry = { place: { id: 'place-2' } } as LocationPlaceCardEntry;
    const pages = [
      { items: [firstEntry], markerVisibility: 'private', totalCount: 2 },
      { items: [secondEntry], markerVisibility: 'public', totalCount: 2 },
    ] satisfies LocationPlaceCardsPage[];
    useInfiniteQueryMock.mockReturnValue({
      data: { pageParams: [null, null], pages },
      isLoading: false,
    });
    const { useLocationPlaceCardsQuery } = await import(
      '@/mobile/app/data/hooks/useLocationPlaceCardsQuery'
    );
    const hook = renderHook(() =>
      useLocationPlaceCardsQuery({
        lat: 41.01,
        lng: 29.02,
        ownerId: 'owner-1',
        placeName: 'Kafe',
        viewerId: 'viewer-1',
      }),
    );

    expect(useInfiniteQueryMock.mock.calls[0]![0].queryKey).toEqual(
      queryKeys.map.locationCards('viewer-1', 41.01, 29.02, 'owner-1', 'Kafe'),
    );
    expect(hook.result.current.entries).toEqual([firstEntry, secondEntry]);
    expect(hook.result.current.markerVisibility).toBe('private');
    expect(hook.result.current.totalCount).toBe(2);
  });
});
