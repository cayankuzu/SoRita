import {
  InfiniteData,
  useInfiniteQuery,
} from '@tanstack/react-query';

import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import {
  fetchExplorePage,
  type ExploreCursor,
  type ExploreKind,
  type ExplorePage,
} from '@/mobile/app/data/repositories/exploreRepository';

export const EXPLORE_STALE_TIME_MS = 1000 * 60 * 5;

type UseExploreQueryOptions = {
  enabled?: boolean;
  kind?: ExploreKind;
};

export function useExploreQuery(
  userId?: string | null,
  query = '',
  options: UseExploreQueryOptions = {},
) {
  const enabled = options.enabled ?? true;
  const kind = options.kind ?? 'all';
  const normalizedQuery = query.trim().toLowerCase();

  return useInfiniteQuery<
    ExplorePage,
    Error,
    InfiniteData<ExplorePage, ExploreCursor | null>,
    ReturnType<typeof queryKeys.explore.page> | typeof queryKeys.explore.all,
    ExploreCursor | null
  >({
    enabled: Boolean(userId) && enabled,
    initialPageParam: null,
    queryKey: userId
      ? queryKeys.explore.page(userId, kind, normalizedQuery)
      : queryKeys.explore.all,
    queryFn: ({ pageParam, signal }) =>
      userId
        ? fetchExplorePage({
            abortSignal: signal,
            cursor: pageParam,
            kind,
            query: normalizedQuery,
            viewerId: userId,
          })
        : Promise.resolve({ listItems: [], placeItems: [], userItems: [] }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: EXPLORE_STALE_TIME_MS,
  });
}
