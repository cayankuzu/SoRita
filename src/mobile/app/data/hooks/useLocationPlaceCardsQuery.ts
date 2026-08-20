import { InfiniteData, useInfiniteQuery } from '@tanstack/react-query';

import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import {
  fetchLocationPlaceCardsPage,
  type LocationPlaceCardsCursor,
  type LocationPlaceCardsPage,
} from '@/mobile/app/data/repositories/locationPlaceCardsRepository';

const LOCATION_CARDS_STALE_TIME_MS = 1000 * 60 * 5;

export function useLocationPlaceCardsQuery(params: {
  lat: number;
  lng: number;
  ownerId?: string | null;
  placeName?: string | null;
  viewerId?: string | null;
}) {
  const viewerId = params.viewerId || '__public__';
  const query = useInfiniteQuery<
    LocationPlaceCardsPage,
    Error,
    InfiniteData<LocationPlaceCardsPage, LocationPlaceCardsCursor | null>,
    ReturnType<typeof queryKeys.map.locationCards>,
    LocationPlaceCardsCursor | null
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      fetchLocationPlaceCardsPage({ ...params, cursor: pageParam }),
    queryKey: queryKeys.map.locationCards(
      viewerId,
      params.lat,
      params.lng,
      params.ownerId,
      params.placeName,
    ),
    staleTime: LOCATION_CARDS_STALE_TIME_MS,
  });
  const pages = query.data?.pages || [];

  return {
    ...query,
    entries: pages.flatMap((page) => page.items),
    markerVisibility: pages[0]?.markerVisibility || 'public',
    totalCount: pages[0]?.totalCount || 0,
  };
}
