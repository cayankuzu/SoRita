import {
  InfiniteData,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';

import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import {
  fetchProfileContentPage,
  fetchProfileSummary,
  type ProfileContentCursor,
  type ProfileContentPage,
  type ProfileSummary,
} from '@/mobile/app/data/repositories/profileRepository';

const PROFILE_READ_MODEL_STALE_TIME_MS = 1000 * 60 * 5;

type UseProfileReadModelQueryOptions = {
  enabled?: boolean;
};

export function useProfileReadModelQuery(
  targetUserId?: string | null,
  viewerId?: string | null,
  options: UseProfileReadModelQueryOptions = {},
) {
  const enabled = options.enabled ?? true;
  const resolvedViewerId = viewerId || '__anonymous__';
  const summaryQuery = useQuery<
    ProfileSummary | null,
    Error,
    ProfileSummary | null,
    ReturnType<typeof queryKeys.profile.summary> | typeof queryKeys.profile.all
  >({
    enabled: Boolean(targetUserId && viewerId) && enabled,
    queryKey: targetUserId
      ? queryKeys.profile.summary(resolvedViewerId, targetUserId)
      : queryKeys.profile.all,
    queryFn: () => (targetUserId ? fetchProfileSummary(targetUserId) : Promise.resolve(null)),
    staleTime: PROFILE_READ_MODEL_STALE_TIME_MS,
  });

  const contentEnabled =
    Boolean(targetUserId && viewerId) &&
    enabled &&
    summaryQuery.data?.canViewContent === true;

  const listsQuery = useInfiniteQuery<
    ProfileContentPage,
    Error,
    InfiniteData<ProfileContentPage, ProfileContentCursor | null>,
    ReturnType<typeof queryKeys.profile.content> | typeof queryKeys.profile.all,
    ProfileContentCursor | null
  >({
    enabled: contentEnabled,
    initialPageParam: null,
    queryKey: targetUserId
      ? queryKeys.profile.content(resolvedViewerId, targetUserId, 'lists')
      : queryKeys.profile.all,
    queryFn: ({ pageParam }) =>
      targetUserId
        ? fetchProfileContentPage({
            cursor: pageParam,
            tab: 'lists',
            userId: targetUserId,
            viewerId,
          })
        : Promise.resolve({ lists: [], places: [] }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: PROFILE_READ_MODEL_STALE_TIME_MS,
  });

  const placesQuery = useInfiniteQuery<
    ProfileContentPage,
    Error,
    InfiniteData<ProfileContentPage, ProfileContentCursor | null>,
    ReturnType<typeof queryKeys.profile.content> | typeof queryKeys.profile.all,
    ProfileContentCursor | null
  >({
    enabled: contentEnabled,
    initialPageParam: null,
    queryKey: targetUserId
      ? queryKeys.profile.content(resolvedViewerId, targetUserId, 'places')
      : queryKeys.profile.all,
    queryFn: ({ pageParam }) =>
      targetUserId
        ? fetchProfileContentPage({
            cursor: pageParam,
            tab: 'places',
            userId: targetUserId,
            viewerId,
          })
        : Promise.resolve({ lists: [], places: [] }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: PROFILE_READ_MODEL_STALE_TIME_MS,
  });

  const lists = (listsQuery.data?.pages || []).flatMap((page) => page.lists);
  const places = (placesQuery.data?.pages || []).flatMap((page) => page.places);

  return {
    error: summaryQuery.error || listsQuery.error || placesQuery.error,
    fetchNextPage: async () => {
      await Promise.allSettled([
        listsQuery.hasNextPage ? listsQuery.fetchNextPage() : Promise.resolve(),
        placesQuery.hasNextPage ? placesQuery.fetchNextPage() : Promise.resolve(),
      ]);
    },
    hasNextPage: Boolean(listsQuery.hasNextPage || placesQuery.hasNextPage),
    hasPartialDataError: Boolean(summaryQuery.data && (listsQuery.error || placesQuery.error)),
    isFetching: summaryQuery.isFetching || listsQuery.isFetching || placesQuery.isFetching,
    isFetchingNextPage: listsQuery.isFetchingNextPage || placesQuery.isFetchingNextPage,
    isLoading:
      summaryQuery.isLoading ||
      (contentEnabled && (listsQuery.isLoading || placesQuery.isLoading)),
    lists,
    places,
    refetch: async () => {
      const summaryResult = await summaryQuery.refetch();
      const canViewContent =
        summaryResult.data?.canViewContent ?? summaryQuery.data?.canViewContent ?? false;

      if (!canViewContent) {
        return {
          lists,
          places,
          summary: summaryResult.data ?? summaryQuery.data ?? null,
        };
      }

      const [listsResult, placesResult] = await Promise.allSettled([
        listsQuery.refetch(),
        placesQuery.refetch(),
      ]);

      return {
        lists:
          listsResult.status === 'fulfilled'
            ? (listsResult.value.data?.pages || []).flatMap((page) => page.lists)
            : lists,
        places:
          placesResult.status === 'fulfilled'
            ? (placesResult.value.data?.pages || []).flatMap((page) => page.places)
            : places,
        summary: summaryResult.data ?? summaryQuery.data ?? null,
      };
    },
    summary: summaryQuery.data,
  };
}
