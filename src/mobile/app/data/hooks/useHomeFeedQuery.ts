import {
  InfiniteData,
  useInfiniteQuery,
} from '@tanstack/react-query';

import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import {
  fetchHomeFeedPage,
  type HomeFeedCursor,
  type HomeFeedPage,
} from '@/mobile/app/data/repositories/homeFeedRepository';

export const HOME_FEED_ALGORITHM_VERSION = 'server-v1';
export const HOME_FEED_STALE_TIME_MS = 1000 * 60 * 5;

type UseHomeFeedQueryOptions = {
  enabled?: boolean;
};

export function useHomeFeedQuery(
  userId?: string | null,
  options: UseHomeFeedQueryOptions = {},
) {
  const enabled = options.enabled ?? true;

  return useInfiniteQuery<
    HomeFeedPage,
    Error,
    InfiniteData<HomeFeedPage, HomeFeedCursor | null>,
    ReturnType<typeof queryKeys.feed.page> | typeof queryKeys.feed.all,
    HomeFeedCursor | null
  >({
    enabled: Boolean(userId) && enabled,
    initialPageParam: null,
    queryKey: userId
      ? queryKeys.feed.page(userId, HOME_FEED_ALGORITHM_VERSION)
      : queryKeys.feed.all,
    queryFn: ({ pageParam, signal }) =>
      userId
        ? fetchHomeFeedPage({
            cursor: pageParam,
            signal,
            viewerId: userId,
          })
        : Promise.resolve({ items: [] }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: HOME_FEED_STALE_TIME_MS,
  });
}
