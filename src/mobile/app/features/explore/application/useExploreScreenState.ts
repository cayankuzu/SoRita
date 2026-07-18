import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
import {
  useFollowUserMutation,
  type FollowStateResult,
} from '@/mobile/app/data/hooks/useUserMutations';
import { useExploreQuery } from '@/mobile/app/data/hooks/useExploreQuery';
import { useVisibleDataQuery } from '@/mobile/app/data/hooks/useVisibleDataQuery';
import { isMissingReadModelError } from '@/mobile/app/data/query/readModelErrors';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { getPlaceMedia } from '@/mobile/app/shared/utils/placeMedia';
import {
  buildPlaceFeedCardItems,
  type PlaceFeedCardItem,
} from '@/mobile/app/data/selectors/placeAggregation';

export type ExploreTabKey = 'lists' | 'places' | 'photos' | 'people';

type UseExploreScreenStateParams = {
  activeTab: ExploreTabKey;
  user: User | null;
  searchQuery: string;
};

type ExploreListItem = {
  list: PlaceList;
  owner: User | null;
};

type ExploreTabQueryState = {
  fetchNextPage?: () => Promise<unknown>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
};

const EXPLORE_TABS: ExploreTabKey[] = ['lists', 'places', 'photos', 'people'];
function useDebouncedValue(value: string, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [delayMs, value]);

  return debouncedValue;
}

function isActiveOrNeighbor(activeTab: ExploreTabKey, candidate: ExploreTabKey) {
  return Math.abs(EXPLORE_TABS.indexOf(activeTab) - EXPLORE_TABS.indexOf(candidate)) <= 1;
}

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

export function useExploreScreenState({
  activeTab,
  user,
  searchQuery,
}: UseExploreScreenStateParams) {
  const selectedTab: ExploreTabKey = EXPLORE_TABS.includes(activeTab) ? activeTab : 'lists';
  const userId = user?.id;
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const q = debouncedSearchQuery.trim().toLowerCase();
  const listExploreQuery = useExploreQuery(userId, debouncedSearchQuery, {
    enabled: Boolean(userId) && isActiveOrNeighbor(selectedTab, 'lists'),
    kind: 'lists',
  });
  const placeExploreQuery = useExploreQuery(userId, debouncedSearchQuery, {
    enabled: Boolean(userId) && isActiveOrNeighbor(selectedTab, 'places'),
    kind: 'places',
  });
  const photoExploreQuery = useExploreQuery(userId, debouncedSearchQuery, {
    enabled: Boolean(userId) && isActiveOrNeighbor(selectedTab, 'photos'),
    kind: 'photos',
  });
  const userExploreQuery = useExploreQuery(userId, debouncedSearchQuery, {
    enabled: Boolean(userId) && isActiveOrNeighbor(selectedTab, 'people'),
    kind: 'users',
  });
  const exploreQueryByTab = {
    lists: listExploreQuery,
    people: userExploreQuery,
    photos: photoExploreQuery,
    places: placeExploreQuery,
  } as const;
  const activeExploreQuery = exploreQueryByTab[selectedTab];
  const shouldUseLegacyVisibleData = isMissingReadModelError(activeExploreQuery.error);
  const visibleDataQuery = useVisibleDataQuery(userId, {
    enabled: Boolean(userId) && shouldUseLegacyVisibleData,
    includePlaceComments: false,
    publicOnly: true,
  });
  const { mutateAsync: followUserAsync } = useFollowUserMutation();
  const activeQuery = shouldUseLegacyVisibleData ? visibleDataQuery : activeExploreQuery;
  const visibleUsers = visibleDataQuery.data?.users || [];
  const visibleLists = visibleDataQuery.data?.lists || [];
  const usersById = useMemo(
    () => new Map(visibleUsers.map((item) => [item.id, item])),
    [visibleUsers],
  );
  const errorMessage = activeQuery.error
    ? getUserFacingErrorMessage(
        activeQuery.error,
        tr.explore.errorDescription,
      )
    : null;

  const loadData = useCallback(async () => {
    if (!userId) {
      return;
    }

    await activeQuery.refetch();
  }, [activeQuery, userId]);

  const { refreshing, onRefresh } = useFocusRefresh(loadData, {
    refreshOnFocus: false,
    skipInitialFocus: true,
  });

  const currentUser = useMemo(() => {
    if (!userId) {
      return null;
    }

    return shouldUseLegacyVisibleData ? usersById.get(userId) || user : user;
  }, [shouldUseLegacyVisibleData, user, userId, usersById]);

  const following = currentUser?.following || [];
  const pendingFollowRequests = currentUser?.pendingFollowRequestsSent || [];
  const followingSet = useMemo(() => new Set(following), [following]);
  const canAppearInExplore = useCallback(
    (ownerId?: string | null) =>
      Boolean(ownerId && ownerId !== userId && !followingSet.has(ownerId)),
    [followingSet, userId],
  );

  const allUsers = useMemo(() => {
    if (!userId) {
      return [];
    }

    return visibleUsers.filter(
      (item) => item.isPublicAccount !== false && canAppearInExplore(item.id),
    );
  }, [canAppearInExplore, userId, visibleUsers]);

  const publicLists = useMemo(() => {
    const discoverableContentUserIds = new Set(allUsers.map((item) => item.id));

    return visibleLists
      .filter((list) => list.isPublic)
      .filter((list) => discoverableContentUserIds.has(list.userId))
      .sort((a, b) => getEntitySortTime(b.updatedAt, b.createdAt) - getEntitySortTime(a.updatedAt, a.createdAt));
  }, [allUsers, visibleLists]);

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

  const readModelListItems = useMemo<ExploreListItem[]>(() => {
    const itemsById = new Map<string, ExploreListItem>();

    (listExploreQuery.data?.pages || []).forEach((page) => {
      page.listItems.forEach((item) => {
        if (!canAppearInExplore(item.list.userId)) {
          return;
        }

        if (!q || matchesText(item.list.name, q) || matchesText(item.list.description, q)) {
          itemsById.set(item.list.id, item);
        }
      });
    });

    return Array.from(itemsById.values()).sort(
      (left, right) =>
        getEntitySortTime(right.list.updatedAt, right.list.createdAt) -
        getEntitySortTime(left.list.updatedAt, left.list.createdAt),
    );
  }, [canAppearInExplore, listExploreQuery.data?.pages, q]);

  const filteredListItems = useMemo<ExploreListItem[]>(
    () =>
      shouldUseLegacyVisibleData
        ? filteredLists.map((list) => ({
            list,
            owner: usersById.get(list.userId) || null,
          }))
        : readModelListItems,
    [filteredLists, readModelListItems, shouldUseLegacyVisibleData, usersById],
  );

  const placeFeedItems = useMemo<PlaceFeedCardItem[]>(
    () => buildPlaceFeedCardItems(publicLists, (ownerId) => usersById.get(ownerId)),
    [publicLists, usersById],
  );

  const readModelPlaces = useMemo<PlaceFeedCardItem[]>(() => {
    const itemsByKey = new Map<string, PlaceFeedCardItem>();

    (placeExploreQuery.data?.pages || []).forEach((page) => {
      page.placeItems.forEach((item) => {
        if (!canAppearInExplore(item.ownerId)) {
          return;
        }

        if (!q || matchesFeedItem(item, q)) {
          itemsByKey.set(item.key, item);
        }
      });
    });

    return Array.from(itemsByKey.values()).sort((left, right) => right.sortTime - left.sortTime);
  }, [canAppearInExplore, placeExploreQuery.data?.pages, q]);

  const readModelPhotos = useMemo<PlaceFeedCardItem[]>(() => {
    const itemsByKey = new Map<string, PlaceFeedCardItem>();

    (photoExploreQuery.data?.pages || []).forEach((page) => {
      page.placeItems.forEach((item) => {
        if (!canAppearInExplore(item.ownerId)) {
          return;
        }

        if (getPlaceMedia(item.place).length > 0 && (!q || matchesFeedItem(item, q))) {
          itemsByKey.set(item.key, item);
        }
      });
    });

    return Array.from(itemsByKey.values()).sort((left, right) => right.sortTime - left.sortTime);
  }, [canAppearInExplore, photoExploreQuery.data?.pages, q]);

  const filteredPlaces = useMemo(
    () =>
      shouldUseLegacyVisibleData
        ? placeFeedItems.filter((item) => !q || matchesFeedItem(item, q))
        : readModelPlaces,
    [placeFeedItems, q, readModelPlaces, shouldUseLegacyVisibleData],
  );

  const filteredPhotos = useMemo(
    () =>
      shouldUseLegacyVisibleData
        ? placeFeedItems.filter(
            (item) => getPlaceMedia(item.place).length > 0 && (!q || matchesFeedItem(item, q)),
          )
        : readModelPhotos,
    [placeFeedItems, q, readModelPhotos, shouldUseLegacyVisibleData],
  );

  const readModelUsers = useMemo<User[]>(() => {
    const usersByResultId = new Map<string, User>();

    (userExploreQuery.data?.pages || []).forEach((page) => {
      page.userItems.forEach((item) => {
        if (canAppearInExplore(item.id) && (!q || matchesUser(item, q))) {
          usersByResultId.set(item.id, item);
        }
      });
    });

    return Array.from(usersByResultId.values());
  }, [canAppearInExplore, q, userExploreQuery.data?.pages]);

  const filteredUsers = useMemo(
    () =>
      shouldUseLegacyVisibleData
        ? allUsers.filter((item) => !q || matchesUser(item, q))
        : readModelUsers,
    [allUsers, q, readModelUsers, shouldUseLegacyVisibleData],
  );

  const queryStateByTab = useMemo<Record<ExploreTabKey, ExploreTabQueryState>>(() => {
    if (shouldUseLegacyVisibleData) {
      const legacyState = {
        fetchNextPage: visibleDataQuery.fetchNextPage as (() => Promise<unknown>) | undefined,
        hasNextPage: Boolean(visibleDataQuery.hasNextPage),
        isFetchingNextPage: visibleDataQuery.isFetchingNextPage,
      };

      return {
        lists: legacyState,
        people: legacyState,
        photos: legacyState,
        places: legacyState,
      };
    }

    return {
      lists: {
        fetchNextPage: listExploreQuery.fetchNextPage as (() => Promise<unknown>) | undefined,
        hasNextPage: Boolean(listExploreQuery.hasNextPage),
        isFetchingNextPage: listExploreQuery.isFetchingNextPage,
      },
      people: {
        fetchNextPage: userExploreQuery.fetchNextPage as (() => Promise<unknown>) | undefined,
        hasNextPage: Boolean(userExploreQuery.hasNextPage),
        isFetchingNextPage: userExploreQuery.isFetchingNextPage,
      },
      photos: {
        fetchNextPage: photoExploreQuery.fetchNextPage as (() => Promise<unknown>) | undefined,
        hasNextPage: Boolean(photoExploreQuery.hasNextPage),
        isFetchingNextPage: photoExploreQuery.isFetchingNextPage,
      },
      places: {
        fetchNextPage: placeExploreQuery.fetchNextPage as (() => Promise<unknown>) | undefined,
        hasNextPage: Boolean(placeExploreQuery.hasNextPage),
        isFetchingNextPage: placeExploreQuery.isFetchingNextPage,
      },
    };
  }, [
    listExploreQuery.fetchNextPage,
    listExploreQuery.hasNextPage,
    listExploreQuery.isFetchingNextPage,
    photoExploreQuery.fetchNextPage,
    photoExploreQuery.hasNextPage,
    photoExploreQuery.isFetchingNextPage,
    placeExploreQuery.fetchNextPage,
    placeExploreQuery.hasNextPage,
    placeExploreQuery.isFetchingNextPage,
    shouldUseLegacyVisibleData,
    userExploreQuery.fetchNextPage,
    userExploreQuery.hasNextPage,
    userExploreQuery.isFetchingNextPage,
    visibleDataQuery.fetchNextPage,
    visibleDataQuery.hasNextPage,
    visibleDataQuery.isFetchingNextPage,
  ]);

  const followUser = useCallback(
    async (targetUserId: string): Promise<FollowStateResult> => {
      if (!userId) {
        throw new Error(tr.explore.followRequiresUser);
      }

      return followUserAsync({ currentUserId: userId, targetUserId });
    },
    [followUserAsync, userId],
  );

  return {
    currentUser,
    debouncedSearchQuery,
    errorMessage,
    fetchNextPage: queryStateByTab[selectedTab].fetchNextPage,
    filteredListItems,
    filteredPhotos,
    filteredPlaces,
    filteredUsers,
    followUser,
    following,
    hasNextPage: queryStateByTab[selectedTab].hasNextPage,
    hasPartialDataError: shouldUseLegacyVisibleData
      ? visibleDataQuery.hasPartialDataError
      : false,
    isFetchingNextPage: queryStateByTab[selectedTab].isFetchingNextPage,
    isInitialLoading: shouldUseLegacyVisibleData
      ? visibleDataQuery.isLoading && !visibleDataQuery.data
      : activeExploreQuery.isLoading && !activeExploreQuery.data,
    pendingFollowRequests,
    queryStateByTab,
    refreshing,
    retry: loadData,
    onRefresh,
  };
}
