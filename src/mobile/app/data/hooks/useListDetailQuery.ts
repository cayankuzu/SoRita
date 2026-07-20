import {
  InfiniteData,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';

import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import {
  fetchListDetailHeader,
  fetchListPlacesPage,
  type ListDetailHeader,
  type ListPlacesCursor,
  type ListPlacesPage,
} from '@/mobile/app/data/repositories/listDetailRepository';

export const LIST_DETAIL_STALE_TIME_MS = 1000 * 60 * 5;

type UseListDetailQueryOptions = {
  enabled?: boolean;
};

export function useListDetailQuery(
  listId?: string | null,
  viewerId?: string | null,
  options: UseListDetailQueryOptions = {},
) {
  const enabled = options.enabled ?? true;
  const resolvedViewerId = viewerId || '__public__';
  const headerQuery = useQuery<
    ListDetailHeader | null,
    Error,
    ListDetailHeader | null,
    ReturnType<typeof queryKeys.list.header> | typeof queryKeys.list.all
  >({
    enabled: Boolean(listId) && enabled,
    queryKey: listId
      ? queryKeys.list.header(resolvedViewerId, listId)
      : queryKeys.list.all,
    queryFn: () => (listId ? fetchListDetailHeader(listId) : Promise.resolve(null)),
    staleTime: LIST_DETAIL_STALE_TIME_MS,
  });

  const placesQuery = useInfiniteQuery<
    ListPlacesPage,
    Error,
    InfiniteData<ListPlacesPage, ListPlacesCursor | null>,
    ReturnType<typeof queryKeys.list.places> | typeof queryKeys.list.all,
    ListPlacesCursor | null
  >({
    enabled: Boolean(listId) && enabled && headerQuery.data !== null,
    initialPageParam: null,
    queryKey: listId
      ? queryKeys.list.places(resolvedViewerId, listId)
      : queryKeys.list.all,
    queryFn: ({ pageParam }) =>
      listId
        ? fetchListPlacesPage({
            cursor: pageParam,
            listId,
            viewerId,
          })
        : Promise.resolve({ items: [] }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: LIST_DETAIL_STALE_TIME_MS,
  });

  return {
    error: headerQuery.error || placesQuery.error,
    fetchNextPage: placesQuery.fetchNextPage,
    hasNextPage: placesQuery.hasNextPage,
    header: headerQuery.data,
    isFetching: headerQuery.isFetching || placesQuery.isFetching,
    isFetchingNextPage: placesQuery.isFetchingNextPage,
    isLoading: headerQuery.isLoading || (Boolean(headerQuery.data) && placesQuery.isLoading),
    places: (placesQuery.data?.pages || []).flatMap((page) => page.items),
    refetch: async () => {
      const [headerResult, placesResult] = await Promise.allSettled([
        headerQuery.refetch(),
        placesQuery.refetch(),
      ]);

      return {
        header:
          headerResult.status === 'fulfilled'
            ? headerResult.value.data
            : headerQuery.data,
        places:
          placesResult.status === 'fulfilled'
            ? (placesResult.value.data?.pages || []).flatMap((page) => page.items)
            : (placesQuery.data?.pages || []).flatMap((page) => page.items),
      };
    },
  };
}
