import { useCallback, useEffect, useMemo } from 'react';

import type { User } from '@/mobile/app/data/contracts/entities';
import { useVisibleDataQuery } from '@/mobile/app/data/hooks/useVisibleDataQuery';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import { buildPlaceFeedCardItems } from '@/mobile/app/data/selectors/placeAggregation';

type UseHomeFeedScreenStateParams = {
  user: User | null;
};

export function useHomeFeedScreenState({ user }: UseHomeFeedScreenStateParams) {
  const userId = user?.id;
  const visibleDataQuery = useVisibleDataQuery(userId);
  const { fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = visibleDataQuery;
  const visibleUsers = visibleDataQuery.data?.users || [];
  const visibleLists = visibleDataQuery.data?.lists || [];
  const usersById = useMemo(
    () => new Map(visibleUsers.map((item) => [item.id, item])),
    [visibleUsers],
  );
  const errorMessage = visibleDataQuery.error
    ? getUserFacingErrorMessage(
        visibleDataQuery.error,
        'Ana akis su an yuklenemiyor. Lutfen tekrar dene.',
      )
    : null;

  const loadFeed = useCallback(async () => {
    if (!userId) {
      return;
    }

    await refetch();
  }, [refetch, userId]);

  const { refreshing, onRefresh } = useFocusRefresh(loadFeed);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || !fetchNextPage) {
      return;
    }

    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const freshUser = useMemo(() => {
    if (!userId) {
      return null;
    }

    return usersById.get(userId) || user;
  }, [user, userId, usersById]);

  const visibleFeedLists = useMemo(() => {
    if (!userId || !freshUser) {
      return [];
    }

    const followingIds = new Set(freshUser.following || []);

    return visibleLists.filter(
      (list) =>
        (list.userId === userId || followingIds.has(list.userId)) &&
        (list.isPublic || list.userId === userId),
    );
  }, [freshUser, userId, visibleLists]);

  const feedItems = useMemo(
    () => buildPlaceFeedCardItems(visibleFeedLists, (ownerId) => usersById.get(ownerId)),
    [usersById, visibleFeedLists],
  );

  return {
    errorMessage,
    fetchNextPage,
    feedItems,
    freshUser,
    followingCount: freshUser?.following?.length || 0,
    hasNextPage,
    hasPartialDataError: visibleDataQuery.hasPartialDataError,
    isInitialLoading: visibleDataQuery.isLoading && !visibleDataQuery.data,
    isFetchingNextPage,
    refreshing,
    retry: loadFeed,
    onRefresh,
  };
}
