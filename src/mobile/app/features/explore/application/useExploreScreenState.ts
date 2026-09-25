import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';

import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
import {
  useFollowUserMutation,
  type FollowStateResult,
} from '@/mobile/app/data/hooks/useUserMutations';
import { useExploreQuery } from '@/mobile/app/data/hooks/useExploreQuery';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { getPlaceMedia } from '@/mobile/app/shared/utils/placeMedia';
import { normalizeSearchQuery } from '@/mobile/app/shared/utils/textSort';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';

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
  // The tab's first page for the current query has not arrived yet.
  isLoading: boolean;
};

const EXPLORE_TABS: ExploreTabKey[] = ['lists', 'places', 'photos', 'people'];
// The server's trigram search needs three characters; shorter input asks for
// one more letter instead of reporting that nothing matched.
const EXPLORE_MIN_QUERY_LENGTH = 3;

function isExploreQueryTooShort(query: string) {
  const length = normalizeSearchQuery(query).length;
  return length > 0 && length < EXPLORE_MIN_QUERY_LENGTH;
}
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

function shouldLoadExploreTab(
  activeTab: ExploreTabKey,
  candidate: ExploreTabKey,
  hasSearchQuery: boolean,
) {
  if (hasSearchQuery) {
    return activeTab === candidate;
  }

  return Math.abs(EXPLORE_TABS.indexOf(activeTab) - EXPLORE_TABS.indexOf(candidate)) <= 1;
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
  const deferredSearchQuery = useDeferredValue(debouncedSearchQuery);
  // While searching, the server decides what matches and in which order:
  // re-filtering here dropped its category and owner matches, and re-sorting
  // by date undid its relevance order.
  const searching = normalizeSearchQuery(deferredSearchQuery).length > 0;
  const hasSearchQuery = normalizeSearchQuery(debouncedSearchQuery).length > 0;
  const searchTooShort = isExploreQueryTooShort(debouncedSearchQuery);
  const listExploreQuery = useExploreQuery(userId, debouncedSearchQuery, {
    enabled: Boolean(userId) && !searchTooShort && shouldLoadExploreTab(selectedTab, 'lists', hasSearchQuery),
    kind: 'lists',
  });
  const placeExploreQuery = useExploreQuery(userId, debouncedSearchQuery, {
    enabled: Boolean(userId) && !searchTooShort && shouldLoadExploreTab(selectedTab, 'places', hasSearchQuery),
    kind: 'places',
  });
  const photoExploreQuery = useExploreQuery(userId, debouncedSearchQuery, {
    enabled: Boolean(userId) && !searchTooShort && shouldLoadExploreTab(selectedTab, 'photos', hasSearchQuery),
    kind: 'photos',
  });
  const userExploreQuery = useExploreQuery(userId, debouncedSearchQuery, {
    enabled: Boolean(userId) && !searchTooShort && shouldLoadExploreTab(selectedTab, 'people', hasSearchQuery),
    kind: 'users',
  });
  const exploreQueryByTab = {
    lists: listExploreQuery,
    people: userExploreQuery,
    photos: photoExploreQuery,
    places: placeExploreQuery,
  } as const;
  const activeExploreQuery = exploreQueryByTab[selectedTab];
  const { mutateAsync: followUserAsync } = useFollowUserMutation();
  const errorMessage = activeExploreQuery.error
    ? getUserFacingErrorMessage(
        activeExploreQuery.error,
        tr.explore.errorDescription,
      )
    : null;

  const loadData = useCallback(async () => {
    if (!userId) {
      return;
    }

    await activeExploreQuery.refetch();
  }, [activeExploreQuery, userId]);

  const { refreshing, onRefresh } = useFocusRefresh(loadData, {
    refreshOnFocus: false,
    skipInitialFocus: true,
  });

  const currentUser = userId ? user : null;

  const following = useMemo(() => currentUser?.following || [], [currentUser?.following]);
  const pendingFollowRequests = currentUser?.pendingFollowRequestsSent || [];
  const followingSet = useMemo(() => new Set(following), [following]);
  // Suggestions leave out the viewer and people they follow; a search finds
  // them too, as the server returns them.
  const canAppearInExplore = useCallback(
    (ownerId?: string | null) =>
      searching || Boolean(ownerId && ownerId !== userId && !followingSet.has(ownerId)),
    [followingSet, searching, userId],
  );

  const readModelListItems = useMemo<ExploreListItem[]>(() => {
    const itemsById = new Map<string, ExploreListItem>();

    (listExploreQuery.data?.pages || []).forEach((page) => {
      page.listItems.forEach((item) => {
        if (!canAppearInExplore(item.list.userId)) {
          return;
        }

        itemsById.set(item.list.id, item);
      });
    });

    const items = Array.from(itemsById.values());
    return searching
      ? items
      : items.sort(
          (left, right) =>
            getEntitySortTime(right.list.updatedAt, right.list.createdAt) -
            getEntitySortTime(left.list.updatedAt, left.list.createdAt),
        );
  }, [canAppearInExplore, listExploreQuery.data?.pages, searching]);

  const filteredListItems = readModelListItems;

  const readModelPlaces = useMemo<PlaceFeedCardItem[]>(() => {
    const itemsByKey = new Map<string, PlaceFeedCardItem>();

    (placeExploreQuery.data?.pages || []).forEach((page) => {
      page.placeItems.forEach((item) => {
        if (!canAppearInExplore(item.ownerId)) {
          return;
        }

        itemsByKey.set(item.key, item);
      });
    });

    const items = Array.from(itemsByKey.values());
    return searching ? items : items.sort((left, right) => right.sortTime - left.sortTime);
  }, [canAppearInExplore, placeExploreQuery.data?.pages, searching]);

  const readModelPhotos = useMemo<PlaceFeedCardItem[]>(() => {
    const itemsByKey = new Map<string, PlaceFeedCardItem>();

    (photoExploreQuery.data?.pages || []).forEach((page) => {
      page.placeItems.forEach((item) => {
        if (!canAppearInExplore(item.ownerId)) {
          return;
        }

        if (getPlaceMedia(item.place).length > 0) {
          itemsByKey.set(item.key, item);
        }
      });
    });

    const items = Array.from(itemsByKey.values());
    return searching ? items : items.sort((left, right) => right.sortTime - left.sortTime);
  }, [canAppearInExplore, photoExploreQuery.data?.pages, searching]);

  const filteredPlaces = readModelPlaces;
  const filteredPhotos = readModelPhotos;

  const readModelUsers = useMemo<User[]>(() => {
    const usersByResultId = new Map<string, User>();

    (userExploreQuery.data?.pages || []).forEach((page) => {
      page.userItems.forEach((item) => {
        if (item.id !== userId && canAppearInExplore(item.id)) {
          usersByResultId.set(item.id, item);
        }
      });
    });

    return Array.from(usersByResultId.values());
  }, [canAppearInExplore, userExploreQuery.data?.pages, userId]);

  const filteredUsers = readModelUsers;

  const queryStateByTab = useMemo<Record<ExploreTabKey, ExploreTabQueryState>>(() => {
    return {
      lists: {
        fetchNextPage: listExploreQuery.fetchNextPage as (() => Promise<unknown>) | undefined,
        hasNextPage: Boolean(listExploreQuery.hasNextPage),
        isFetchingNextPage: listExploreQuery.isFetchingNextPage,
        isLoading: listExploreQuery.isLoading && !listExploreQuery.data,
      },
      people: {
        fetchNextPage: userExploreQuery.fetchNextPage as (() => Promise<unknown>) | undefined,
        hasNextPage: Boolean(userExploreQuery.hasNextPage),
        isFetchingNextPage: userExploreQuery.isFetchingNextPage,
        isLoading: userExploreQuery.isLoading && !userExploreQuery.data,
      },
      photos: {
        fetchNextPage: photoExploreQuery.fetchNextPage as (() => Promise<unknown>) | undefined,
        hasNextPage: Boolean(photoExploreQuery.hasNextPage),
        isFetchingNextPage: photoExploreQuery.isFetchingNextPage,
        isLoading: photoExploreQuery.isLoading && !photoExploreQuery.data,
      },
      places: {
        fetchNextPage: placeExploreQuery.fetchNextPage as (() => Promise<unknown>) | undefined,
        hasNextPage: Boolean(placeExploreQuery.hasNextPage),
        isFetchingNextPage: placeExploreQuery.isFetchingNextPage,
        isLoading: placeExploreQuery.isLoading && !placeExploreQuery.data,
      },
    };
  }, [
    listExploreQuery.data,
    listExploreQuery.fetchNextPage,
    listExploreQuery.hasNextPage,
    listExploreQuery.isFetchingNextPage,
    listExploreQuery.isLoading,
    photoExploreQuery.data,
    photoExploreQuery.fetchNextPage,
    photoExploreQuery.hasNextPage,
    photoExploreQuery.isFetchingNextPage,
    photoExploreQuery.isLoading,
    placeExploreQuery.data,
    placeExploreQuery.fetchNextPage,
    placeExploreQuery.hasNextPage,
    placeExploreQuery.isFetchingNextPage,
    placeExploreQuery.isLoading,
    userExploreQuery.data,
    userExploreQuery.fetchNextPage,
    userExploreQuery.hasNextPage,
    userExploreQuery.isFetchingNextPage,
    userExploreQuery.isLoading,
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
    debouncedSearchQuery: deferredSearchQuery,
    errorMessage,
    fetchNextPage: queryStateByTab[selectedTab].fetchNextPage,
    filteredListItems,
    filteredPhotos,
    filteredPlaces,
    filteredUsers,
    followUser,
    following,
    hasNextPage: queryStateByTab[selectedTab].hasNextPage,
    hasPartialDataError: Boolean(
      activeExploreQuery.error &&
      (filteredListItems.length ||
        filteredPhotos.length ||
        filteredPlaces.length ||
        filteredUsers.length),
    ),
    isFetchingNextPage: queryStateByTab[selectedTab].isFetchingNextPage,
    // Only the first browse load takes over the whole screen. A search loads
    // inside its tab: swapping the screen remounted the search field, which
    // closed the keyboard three letters into every query.
    isInitialLoading: !hasSearchQuery && activeExploreQuery.isLoading && !activeExploreQuery.data,
    pendingFollowRequests,
    queryStateByTab,
    refreshing,
    retry: loadData,
    searchTooShort,
    onRefresh,
  };
}
