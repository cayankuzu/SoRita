import { useCallback, useMemo } from 'react';

import type { User } from '@/mobile/app/data/contracts/entities';
import { useHomeFeedQuery } from '@/mobile/app/data/hooks/useHomeFeedQuery';
import { useVisibleDataQuery } from '@/mobile/app/data/hooks/useVisibleDataQuery';
import { isMissingReadModelError } from '@/mobile/app/data/query/readModelErrors';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import { buildPlaceFeedCardItems } from '@/mobile/app/data/selectors/placeAggregation';
import { tr } from '@/mobile/app/shared/i18n/tr';

type UseHomeFeedScreenStateParams = {
  user: User | null;
};

export function useHomeFeedScreenState({ user }: UseHomeFeedScreenStateParams) {
  const userId = user?.id;
  const homeFeedQuery = useHomeFeedQuery(userId);
  const shouldUseLegacyFeed =
    Boolean(userId) && isMissingReadModelError(homeFeedQuery.error);
  const visibleDataQuery = useVisibleDataQuery(userId, {
    enabled: shouldUseLegacyFeed,
    filterToViewerNetwork: true,
    includePlaceComments: false,
  });
  const activeFeedQuery = shouldUseLegacyFeed ? visibleDataQuery : homeFeedQuery;
  const visibleUsers = visibleDataQuery.data?.users || [];
  const visibleLists = visibleDataQuery.data?.lists || [];
  const usersById = useMemo(
    () => new Map(visibleUsers.map((item) => [item.id, item])),
    [visibleUsers],
  );
  const activeError =
    !shouldUseLegacyFeed && homeFeedQuery.error
      ? homeFeedQuery.error
      : visibleDataQuery.error;
  const errorMessage = activeError
    ? getUserFacingErrorMessage(
        activeError,
        tr.home.errorDescription,
      )
    : null;

  const loadFeed = useCallback(async () => {
    if (!userId) {
      return;
    }

    await activeFeedQuery.refetch();
  }, [activeFeedQuery, userId]);

  const { refreshing, onRefresh } = useFocusRefresh(loadFeed, {
    refreshOnFocus: false,
    skipInitialFocus: true,
  });

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
    () => {
      if (!shouldUseLegacyFeed) {
        const seenKeys = new Set<string>();
        return (homeFeedQuery.data?.pages || [])
          .flatMap((page) => page.items)
          .filter((item) => {
            if (seenKeys.has(item.key)) {
              return false;
            }

            seenKeys.add(item.key);
            return true;
          });
      }

      return buildPlaceFeedCardItems(visibleFeedLists, (ownerId) => usersById.get(ownerId));
    },
    [homeFeedQuery.data?.pages, shouldUseLegacyFeed, usersById, visibleFeedLists],
  );

  return {
    errorMessage,
    fetchNextPage: userId ? activeFeedQuery.fetchNextPage : undefined,
    feedItems,
    freshUser,
    followingCount: freshUser?.following?.length || 0,
    hasNextPage: Boolean(userId && activeFeedQuery.hasNextPage),
    hasPartialDataError:
      shouldUseLegacyFeed
        ? visibleDataQuery.hasPartialDataError
        : Boolean(homeFeedQuery.error && feedItems.length > 0),
    isInitialLoading:
      Boolean(userId) &&
      activeFeedQuery.isLoading &&
      feedItems.length === 0 &&
      !activeFeedQuery.error,
    isFetchingNextPage: Boolean(userId && activeFeedQuery.isFetchingNextPage),
    refreshing,
    retry: loadFeed,
    onRefresh,
  };
}
