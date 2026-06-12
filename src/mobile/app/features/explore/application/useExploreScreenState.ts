import { useCallback, useDeferredValue, useEffect, useMemo } from 'react';

import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
import {
  useFollowUserMutation,
  type FollowStateResult,
} from '@/mobile/app/data/hooks/useUserMutations';
import { useVisibleDataQuery } from '@/mobile/app/data/hooks/useVisibleDataQuery';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import {
  buildPlaceFeedCardItems,
  type PlaceFeedCardItem,
} from '@/mobile/app/data/selectors/placeAggregation';

type UseExploreScreenStateParams = {
  user: User | null;
  searchQuery: string;
};

type ExploreListItem = {
  list: PlaceList;
  owner: User | null;
};

function matchesText(value: string | undefined | null, query: string) {
  return Boolean(value?.toLowerCase().includes(query));
}

function matchesUser(user: User, query: string) {
  return (
    matchesText(user.name, query) ||
    matchesText(user.username, query) ||
    matchesText(user.bio, query)
  );
}

function matchesFeedItem(item: PlaceFeedCardItem, query: string) {
  return (
    matchesText(item.place.name, query) ||
    matchesText(item.place.address, query) ||
    matchesText(item.place.notes, query) ||
    matchesText(item.listName, query) ||
    item.memberships.some((membership) => matchesText(membership.listName, query)) ||
    matchesText(item.owner?.name, query) ||
    matchesText(item.owner?.username, query)
  );
}

function getEntitySortTime(updatedAt?: string | null, createdAt?: string | null) {
  return new Date(updatedAt || createdAt || 0).getTime();
}

export function useExploreScreenState({ user, searchQuery }: UseExploreScreenStateParams) {
  const userId = user?.id;
  const visibleDataQuery = useVisibleDataQuery(userId, { publicOnly: true });
  const { mutateAsync: followUserAsync } = useFollowUserMutation();
  const { fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = visibleDataQuery;
  const visibleUsers = visibleDataQuery.data?.users || [];
  const visibleLists = visibleDataQuery.data?.lists || [];
  const usersById = useMemo(
    () => new Map(visibleUsers.map((item) => [item.id, item])),
    [visibleUsers],
  );
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const q = deferredSearchQuery.trim().toLowerCase();
  const hasSearchQuery = q.length > 0;
  const errorMessage = visibleDataQuery.error
    ? getUserFacingErrorMessage(
        visibleDataQuery.error,
        'Kesfet icerikleri su an yuklenemiyor. Lutfen tekrar dene.',
      )
    : null;

  const loadData = useCallback(async () => {
    if (!userId) {
      return;
    }

    await refetch();
  }, [refetch, userId]);

  const { refreshing, onRefresh } = useFocusRefresh(loadData);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || !fetchNextPage) {
      return;
    }

    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const currentUser = useMemo(() => {
    if (!userId) {
      return null;
    }

    return usersById.get(userId) || user;
  }, [user, userId, usersById]);

  const following = currentUser?.following || [];
  const pendingFollowRequests = currentUser?.pendingFollowRequestsSent || [];

  const allUsers = useMemo(() => {
    if (!userId) {
      return [];
    }

    return visibleUsers.filter((item) => item.id !== userId);
  }, [userId, visibleUsers]);

  const discoverablePublicLists = useMemo(() => {
    const followingUserIds = new Set(following);
    const discoverableContentUserIds = new Set(
      allUsers
        .filter((item) => item.isPublicAccount !== false && !followingUserIds.has(item.id))
        .map((item) => item.id),
    );

    return visibleLists
      .filter((list) => list.isPublic)
      .filter((list) => discoverableContentUserIds.has(list.userId))
      .sort((a, b) => getEntitySortTime(b.updatedAt, b.createdAt) - getEntitySortTime(a.updatedAt, a.createdAt));
  }, [allUsers, following, visibleLists]);

  const searchablePublicLists = useMemo(() => {
    const followingUserIds = new Set(following);
    const searchableContentUserIds = new Set(
      allUsers
        .filter((item) => item.isPublicAccount !== false || followingUserIds.has(item.id))
        .map((item) => item.id),
    );

    return visibleLists
      .filter((list) => list.isPublic)
      .filter((list) => searchableContentUserIds.has(list.userId))
      .sort((a, b) => getEntitySortTime(b.updatedAt, b.createdAt) - getEntitySortTime(a.updatedAt, a.createdAt));
  }, [allUsers, following, visibleLists]);

  const publicLists = hasSearchQuery ? searchablePublicLists : discoverablePublicLists;

  const filteredLists = useMemo(
    () =>
      publicLists.filter(
        (list) =>
          !q ||
          list.name.toLowerCase().includes(q) ||
          list.description?.toLowerCase().includes(q),
      ),
    [publicLists, q],
  );

  const filteredListItems = useMemo<ExploreListItem[]>(
    () =>
      filteredLists.map((list) => ({
        list,
        owner: usersById.get(list.userId) || null,
      })),
    [filteredLists, usersById],
  );

  const placeFeedItems = useMemo<PlaceFeedCardItem[]>(
    () => buildPlaceFeedCardItems(publicLists, (ownerId) => usersById.get(ownerId)),
    [publicLists, usersById],
  );

  const filteredPlaces = useMemo(
    () =>
      placeFeedItems.filter(
        (item) => !q || matchesFeedItem(item, q),
      ),
    [placeFeedItems, q],
  );

  const filteredPhotos = useMemo(
    () =>
      placeFeedItems.filter(
        (item) => (item.place.photos || []).length > 0 && (!q || matchesFeedItem(item, q)),
      ),
    [placeFeedItems, q],
  );

  const filteredUsers = useMemo(
    () =>
      allUsers.filter(
        (item) =>
          (hasSearchQuery || !following.includes(item.id)) &&
          (!q || matchesUser(item, q)),
      ),
    [allUsers, following, hasSearchQuery, q],
  );

  const followUser = useCallback(
    async (targetUserId: string): Promise<FollowStateResult> => {
      if (!userId) {
        throw new Error('Takip islemi icin aktif kullanici gerekli.');
      }

      return followUserAsync({ currentUserId: userId, targetUserId });
    },
    [followUserAsync, userId],
  );

  return {
    currentUser,
    errorMessage,
    fetchNextPage,
    filteredListItems,
    filteredPhotos,
    filteredPlaces,
    filteredUsers,
    followUser,
    following,
    hasNextPage,
    hasPartialDataError: visibleDataQuery.hasPartialDataError,
    isFetchingNextPage,
    pendingFollowRequests,
    refreshing,
    retry: loadData,
    onRefresh,
  };
}
