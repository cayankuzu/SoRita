import {
  type InfiniteData,
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

export type { ProfileSummary };

export const PROFILE_READ_MODEL_STALE_TIME_MS = 1000 * 60 * 5;

type ProfileContentTab = 'lists' | 'places';

type UseProfileReadModelQueryOptions = {
  activeTab?: 'gallery' | ProfileContentTab;
  enabled?: boolean;
};

function useProfileSummaryQuery(
  targetUserId?: string | null,
  viewerId?: string | null,
  enabled = true,
) {
  const resolvedViewerId = viewerId || '__anonymous__';

  return useQuery<
    ProfileSummary | null,
    Error,
    ProfileSummary | null,
    ReturnType<typeof queryKeys.profile.summary> | typeof queryKeys.profile.all
  >({
    enabled: Boolean(targetUserId && viewerId && enabled),
    queryKey: targetUserId
      ? queryKeys.profile.summary(resolvedViewerId, targetUserId)
      : queryKeys.profile.all,
    queryFn: ({ signal }: { signal?: AbortSignal } = {}) => {
      if (!targetUserId) {
        return Promise.resolve(null);
      }

      return signal
        ? fetchProfileSummary(targetUserId, signal)
        : fetchProfileSummary(targetUserId);
    },
    staleTime: PROFILE_READ_MODEL_STALE_TIME_MS,
  });
}

function useProfileContentQuery({
  enabled,
  tab,
  targetUserId,
  viewerId,
}: {
  enabled: boolean;
  tab: ProfileContentTab;
  targetUserId?: string | null;
  viewerId?: string | null;
}) {
  const resolvedViewerId = viewerId || '__anonymous__';

  return useInfiniteQuery<
    ProfileContentPage,
    Error,
    InfiniteData<ProfileContentPage, ProfileContentCursor | null>,
    ReturnType<typeof queryKeys.profile.content> | typeof queryKeys.profile.all,
    ProfileContentCursor | null
  >({
    enabled,
    initialPageParam: null,
    queryKey: targetUserId
      ? queryKeys.profile.content(resolvedViewerId, targetUserId, tab)
      : queryKeys.profile.all,
    queryFn: ({ pageParam, signal }) => targetUserId
      ? fetchProfileContentPage({
          cursor: pageParam,
          signal,
          tab,
          userId: targetUserId,
          viewerId,
        })
      : Promise.resolve({ lists: [], places: [] }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: PROFILE_READ_MODEL_STALE_TIME_MS,
  });
}

function flattenProfileLists(
  data: InfiniteData<ProfileContentPage, ProfileContentCursor | null> | undefined,
) {
  return (data?.pages || []).flatMap((page) => page.lists);
}

function flattenProfilePlaces(
  data: InfiniteData<ProfileContentPage, ProfileContentCursor | null> | undefined,
) {
  return (data?.pages || []).flatMap((page) => page.places);
}

function getProfileLoadOptions(options: UseProfileReadModelQueryOptions) {
  return {
    enabled: options.enabled ?? true,
    loadLists: options.activeTab == null || options.activeTab === 'lists',
    loadPlaces: options.activeTab == null || options.activeTab !== 'lists',
  };
}

function canLoadProfileContent(params: {
  canViewContent?: boolean;
  enabled: boolean;
  targetUserId?: string | null;
  viewerId?: string | null;
}) {
  return Boolean(
    params.targetUserId &&
    params.viewerId &&
    params.enabled &&
    params.canViewContent,
  );
}

function when(enabled: boolean, value?: boolean) {
  return Boolean(enabled && value);
}

function hasAny(values: unknown[]) {
  return values.some(Boolean);
}

function getProfileQueryStatus(params: {
  contentEnabled: boolean;
  listsError: unknown;
  listsFetching: boolean;
  listsFetchingNextPage: boolean;
  listsHasNextPage?: boolean;
  listsLoading: boolean;
  loadLists: boolean;
  loadPlaces: boolean;
  placesError: unknown;
  placesFetching: boolean;
  placesFetchingNextPage: boolean;
  placesHasNextPage?: boolean;
  placesLoading: boolean;
  summaryData: unknown;
  summaryError: unknown;
  summaryFetching: boolean;
  summaryLoading: boolean;
}) {
  const listsError = when(params.loadLists, Boolean(params.listsError));
  const placesError = when(params.loadPlaces, Boolean(params.placesError));
  const listsFetching = when(params.loadLists, params.listsFetching);
  const placesFetching = when(params.loadPlaces, params.placesFetching);
  const listsLoading = when(params.loadLists, params.listsLoading);
  const placesLoading = when(params.loadPlaces, params.placesLoading);

  return {
    error: params.summaryError || params.listsError || params.placesError,
    hasNextPage: hasAny([
      when(params.loadLists, params.listsHasNextPage),
      when(params.loadPlaces, params.placesHasNextPage),
    ]),
    hasPartialDataError: when(
      Boolean(params.summaryData),
      hasAny([listsError, placesError]),
    ),
    isFetching: hasAny([params.summaryFetching, listsFetching, placesFetching]),
    isFetchingNextPage: hasAny([
      when(params.loadLists, params.listsFetchingNextPage),
      when(params.loadPlaces, params.placesFetchingNextPage),
    ]),
    isLoading: hasAny([
      params.summaryLoading,
      when(params.contentEnabled, hasAny([listsLoading, placesLoading])),
    ]),
  };
}

export function useProfileReadModelQuery(
  targetUserId?: string | null,
  viewerId?: string | null,
  options: UseProfileReadModelQueryOptions = {},
) {
  const { enabled, loadLists, loadPlaces } = getProfileLoadOptions(options);
  const summaryQuery = useProfileSummaryQuery(targetUserId, viewerId, enabled);
  const contentEnabled = canLoadProfileContent({
    canViewContent: summaryQuery.data?.canViewContent,
    enabled,
    targetUserId,
    viewerId,
  });
  const listsQuery = useProfileContentQuery({
    enabled: contentEnabled && loadLists,
    tab: 'lists',
    targetUserId,
    viewerId,
  });
  const placesQuery = useProfileContentQuery({
    enabled: contentEnabled && loadPlaces,
    tab: 'places',
    targetUserId,
    viewerId,
  });
  const lists = flattenProfileLists(listsQuery.data);
  const places = flattenProfilePlaces(placesQuery.data);
  const status = getProfileQueryStatus({
    contentEnabled,
    listsError: listsQuery.error,
    listsFetching: listsQuery.isFetching,
    listsFetchingNextPage: listsQuery.isFetchingNextPage,
    listsHasNextPage: listsQuery.hasNextPage,
    listsLoading: listsQuery.isLoading,
    loadLists,
    loadPlaces,
    placesError: placesQuery.error,
    placesFetching: placesQuery.isFetching,
    placesFetchingNextPage: placesQuery.isFetchingNextPage,
    placesHasNextPage: placesQuery.hasNextPage,
    placesLoading: placesQuery.isLoading,
    summaryData: summaryQuery.data,
    summaryError: summaryQuery.error,
    summaryFetching: summaryQuery.isFetching,
    summaryLoading: summaryQuery.isLoading,
  });

  return {
    ...status,
    fetchNextPage: async () => {
      await Promise.allSettled([
        loadLists && listsQuery.hasNextPage ? listsQuery.fetchNextPage() : Promise.resolve(),
        loadPlaces && placesQuery.hasNextPage ? placesQuery.fetchNextPage() : Promise.resolve(),
      ]);
    },
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
        loadLists ? listsQuery.refetch() : Promise.resolve({ data: listsQuery.data }),
        loadPlaces ? placesQuery.refetch() : Promise.resolve({ data: placesQuery.data }),
      ]);

      return {
        lists: listsResult.status === 'fulfilled'
          ? flattenProfileLists(listsResult.value.data)
          : lists,
        places: placesResult.status === 'fulfilled'
          ? flattenProfilePlaces(placesResult.value.data)
          : places,
        summary: summaryResult.data ?? summaryQuery.data ?? null,
      };
    },
    summary: summaryQuery.data,
  };
}
