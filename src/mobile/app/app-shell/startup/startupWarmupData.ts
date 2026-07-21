import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import {
  EXPLORE_STALE_TIME_MS,
} from '@/mobile/app/data/hooks/useExploreQuery';
import {
  HOME_FEED_ALGORITHM_VERSION,
  HOME_FEED_STALE_TIME_MS,
} from '@/mobile/app/data/hooks/useHomeFeedQuery';
import { LIST_DETAIL_STALE_TIME_MS } from '@/mobile/app/data/hooks/useListDetailQuery';
import {
  NOTIFICATIONS_PAGE_SIZE,
  NOTIFICATION_STALE_TIME_MS,
} from '@/mobile/app/data/hooks/useNotificationsQuery';
import {
  PROFILE_READ_MODEL_STALE_TIME_MS,
} from '@/mobile/app/data/hooks/useProfileReadModelQuery';
import { MAP_MARKERS_STALE_TIME_MS } from '@/mobile/app/data/hooks/useMapMarkersQuery';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import {
  fetchExplorePage,
  type ExploreCursor,
  type ExplorePage,
} from '@/mobile/app/data/repositories/exploreRepository';
import {
  fetchHomeFeedPage,
  type HomeFeedCursor,
  type HomeFeedPage,
} from '@/mobile/app/data/repositories/homeFeedRepository';
import {
  fetchListDetailHeader,
  fetchListPlacesPage,
  type ListPlacesCursor,
  type ListPlacesPage,
} from '@/mobile/app/data/repositories/listDetailRepository';
import {
  getNotificationCount,
  getNotificationsCursorPage,
  type MobileNotification,
  type NotificationCursor,
} from '@/mobile/app/data/repositories/notificationRepository';
import {
  fetchProfileContentPage,
  fetchProfileSummary,
  type ProfileContentCursor,
  type ProfileContentPage,
} from '@/mobile/app/data/repositories/profileRepository';
import { fetchOwnedMapMarkers } from '@/mobile/app/data/repositories/mapMarkersRepository';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';
import { prefetchAppImages } from '@/mobile/app/shared/components/ui/AppImage';

export type StartupWarmupStage =
  | 'home'
  | 'explore'
  | 'profile'
  | 'map'
  | 'notifications';

export const STARTUP_MEDIA_PREFETCH_LIMIT = 8;

function getFeedItemMediaUris(item: PlaceFeedCardItem) {
  return [
    item.place.media?.[0]?.thumbnailUrl || item.place.media?.[0]?.url,
    item.listCoverImage,
    item.owner?.profilePhoto,
  ];
}

function warmMedia(
  uris: Array<string | null | undefined>,
  signal?: AbortSignal,
) {
  void prefetchAppImages(uris.slice(0, STARTUP_MEDIA_PREFETCH_LIMIT), {
    priority: 'low',
    ...(signal ? { signal } : {}),
  });
}

async function warmHomeData(queryClient: QueryClient, userId: string, signal?: AbortSignal) {
  const queryKey = queryKeys.feed.page(userId, HOME_FEED_ALGORITHM_VERSION);
  await queryClient.prefetchInfiniteQuery({
    initialPageParam: null as HomeFeedCursor | null,
    queryKey,
    queryFn: ({ pageParam, signal }) =>
      fetchHomeFeedPage({
        cursor: (pageParam as HomeFeedCursor | null) ?? null,
        signal,
        viewerId: userId,
      }),
    staleTime: HOME_FEED_STALE_TIME_MS,
  });

  const data = queryClient.getQueryData<
    InfiniteData<HomeFeedPage, HomeFeedCursor | null>
  >(queryKey);
  warmMedia((data?.pages[0]?.items || []).flatMap(getFeedItemMediaUris), signal);
}

async function warmExploreData(queryClient: QueryClient, userId: string, signal?: AbortSignal) {
  const queryKey = queryKeys.explore.page(userId, 'lists', '');
  await queryClient.prefetchInfiniteQuery({
    initialPageParam: null as ExploreCursor | null,
    queryKey,
    queryFn: ({ pageParam, signal }) =>
      fetchExplorePage({
        abortSignal: signal,
        cursor: (pageParam as ExploreCursor | null) ?? null,
        kind: 'lists',
        query: '',
        viewerId: userId,
      }),
    staleTime: EXPLORE_STALE_TIME_MS,
  });

  const page = queryClient.getQueryData<
    InfiniteData<ExplorePage, ExploreCursor | null>
  >(queryKey)?.pages[0];
  warmMedia([
    ...(page?.listItems || []).flatMap(({ list, owner }) => [
      list.coverImage,
      owner?.profilePhoto,
    ]),
    ...(page?.placeItems || []).flatMap(getFeedItemMediaUris),
    ...(page?.userItems || []).map((item) => item.profilePhoto),
  ], signal);
}

async function warmProfileData(queryClient: QueryClient, userId: string, signal?: AbortSignal) {
  const summary = await queryClient.fetchQuery({
    queryKey: queryKeys.profile.summary(userId, userId),
    queryFn: ({ signal }) => fetchProfileSummary(userId, signal),
    staleTime: PROFILE_READ_MODEL_STALE_TIME_MS,
  });
  warmMedia([summary?.user.profilePhoto, summary?.user.coverPhoto], signal);

  if (!summary?.canViewContent || signal?.aborted) {
    return;
  }

  const queryKey = queryKeys.profile.content(userId, userId, 'lists');
  await queryClient.prefetchInfiniteQuery({
    initialPageParam: null as ProfileContentCursor | null,
    queryKey,
    queryFn: ({ pageParam, signal }) =>
      fetchProfileContentPage({
        cursor: (pageParam as ProfileContentCursor | null) ?? null,
        signal,
        tab: 'lists',
        userId,
        viewerId: userId,
      }),
    staleTime: PROFILE_READ_MODEL_STALE_TIME_MS,
  });

  const page = queryClient.getQueryData<
    InfiniteData<ProfileContentPage, ProfileContentCursor | null>
  >(queryKey)?.pages[0];
  warmMedia((page?.lists || []).map((list) => list.coverImage), signal);
}

async function warmMapData(queryClient: QueryClient, userId: string) {
  await queryClient.prefetchQuery({
    queryKey: queryKeys.map.markers(userId),
    queryFn: () => fetchOwnedMapMarkers(userId),
    staleTime: MAP_MARKERS_STALE_TIME_MS,
  });
}

async function warmNotificationsData(
  queryClient: QueryClient,
  userId: string,
  signal?: AbortSignal,
) {
  const queryKey = queryKeys.notifications.list(userId);
  await Promise.all([
    queryClient.prefetchInfiniteQuery({
      initialPageParam: null as NotificationCursor | null,
      queryKey,
      queryFn: ({ pageParam, signal }) =>
        getNotificationsCursorPage({
          cursor: (pageParam as NotificationCursor | null) ?? null,
          pageSize: NOTIFICATIONS_PAGE_SIZE,
          signal,
          userId,
        }),
      staleTime: NOTIFICATION_STALE_TIME_MS,
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.notifications.unreadCount(userId),
      queryFn: () => getNotificationCount(userId),
      staleTime: NOTIFICATION_STALE_TIME_MS,
    }),
  ]);

  const page = queryClient.getQueryData<
    InfiniteData<MobileNotification[], NotificationCursor | null>
  >(queryKey)?.pages[0];
  warmMedia((page || []).map((notification) => notification.userPhoto), signal);
}

export function warmStageData(
  queryClient: QueryClient,
  userId: string,
  stage: StartupWarmupStage,
  signal?: AbortSignal,
) {
  const warmers: Record<StartupWarmupStage, () => Promise<void>> = {
    explore: () => warmExploreData(queryClient, userId, signal),
    home: () => warmHomeData(queryClient, userId, signal),
    map: () => warmMapData(queryClient, userId),
    notifications: () => warmNotificationsData(queryClient, userId, signal),
    profile: () => warmProfileData(queryClient, userId, signal),
  };

  return warmers[stage]();
}

export async function warmListDetailStage(params: {
  listId: string;
  queryClient: QueryClient;
  viewerId: string;
}) {
  const header = await params.queryClient.fetchQuery({
    queryKey: queryKeys.list.header(params.viewerId, params.listId),
    queryFn: () => fetchListDetailHeader(params.listId),
    staleTime: LIST_DETAIL_STALE_TIME_MS,
  });

  if (!header) {
    return;
  }

  const queryKey = queryKeys.list.places(params.viewerId, params.listId);
  await params.queryClient.prefetchInfiniteQuery({
    initialPageParam: null as ListPlacesCursor | null,
    queryKey,
    queryFn: ({ pageParam }) =>
      fetchListPlacesPage({
        cursor: (pageParam as ListPlacesCursor | null) ?? null,
        listId: params.listId,
        viewerId: params.viewerId,
      }),
    staleTime: LIST_DETAIL_STALE_TIME_MS,
  });

  const page = params.queryClient.getQueryData<
    InfiniteData<ListPlacesPage, ListPlacesCursor | null>
  >(queryKey)?.pages[0];
  warmMedia([
    header.list.coverImage,
    header.owner.profilePhoto,
    ...(page?.items || []).flatMap((place) => [
      place.media?.[0]?.thumbnailUrl || place.media?.[0]?.url,
    ]),
  ]);
}

export async function warmUserProfileStage(params: {
  queryClient: QueryClient;
  targetUserId: string;
  viewerId: string;
}) {
  const summary = await params.queryClient.fetchQuery({
    queryKey: queryKeys.profile.summary(params.viewerId, params.targetUserId),
    queryFn: ({ signal }) => fetchProfileSummary(params.targetUserId, signal),
    staleTime: PROFILE_READ_MODEL_STALE_TIME_MS,
  });
  warmMedia([summary?.user.profilePhoto, summary?.user.coverPhoto]);

  if (!summary?.canViewContent) {
    return;
  }

  const queryKey = queryKeys.profile.content(
    params.viewerId,
    params.targetUserId,
    'lists',
  );
  await params.queryClient.prefetchInfiniteQuery({
    initialPageParam: null as ProfileContentCursor | null,
    queryKey,
    queryFn: ({ pageParam, signal }) =>
      fetchProfileContentPage({
        cursor: (pageParam as ProfileContentCursor | null) ?? null,
        signal,
        tab: 'lists',
        userId: params.targetUserId,
        viewerId: params.viewerId,
      }),
    staleTime: PROFILE_READ_MODEL_STALE_TIME_MS,
  });

  const page = params.queryClient.getQueryData<
    InfiniteData<ProfileContentPage, ProfileContentCursor | null>
  >(queryKey)?.pages[0];
  warmMedia((page?.lists || []).map((list) => list.coverImage));
}
