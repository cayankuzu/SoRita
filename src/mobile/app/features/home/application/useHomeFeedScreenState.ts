import { useCallback, useMemo } from 'react';

import type { User } from '@/mobile/app/data/contracts/entities';
import { useHomeFeedQuery } from '@/mobile/app/data/hooks/useHomeFeedQuery';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import { tr } from '@/mobile/app/shared/i18n/tr';

type UseHomeFeedScreenStateParams = {
  user: User | null;
};

function getHomeFeedStatus(params: {
  error: unknown;
  feedItemCount: number;
  hasNextPage?: boolean;
  isFetchedAfterMount: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  userId?: string;
}) {
  return {
    hasNextPage: Boolean(params.userId && params.hasNextPage),
    hasPartialDataError: Boolean(params.error && params.feedItemCount > 0),
    isFetchingNextPage: Boolean(params.userId && params.isFetchingNextPage),
    isInitialLoading: Boolean(
      params.userId &&
      params.isLoading &&
      params.feedItemCount === 0 &&
      !params.error,
    ),
    isShowingStartupCache:
      params.feedItemCount > 0 && !params.isFetchedAfterMount,
  };
}

export function useHomeFeedScreenState({ user }: UseHomeFeedScreenStateParams) {
  const userId = user?.id;
  const homeFeedQuery = useHomeFeedQuery(userId);
  const errorMessage = homeFeedQuery.error
    ? getUserFacingErrorMessage(
        homeFeedQuery.error,
        tr.home.errorDescription,
      )
    : null;

  const loadFeed = useCallback(async () => {
    if (!userId) {
      return;
    }

    await homeFeedQuery.refetch();
  }, [homeFeedQuery, userId]);

  const { refreshing, onRefresh } = useFocusRefresh(loadFeed, {
    refreshOnFocus: false,
    skipInitialFocus: true,
  });

  const feedItems = useMemo(
    () => {
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
    },
    [homeFeedQuery.data?.pages],
  );
  const status = getHomeFeedStatus({
    error: homeFeedQuery.error,
    feedItemCount: feedItems.length,
    hasNextPage: homeFeedQuery.hasNextPage,
    isFetchedAfterMount: homeFeedQuery.isFetchedAfterMount,
    isFetchingNextPage: homeFeedQuery.isFetchingNextPage,
    isLoading: homeFeedQuery.isLoading,
    userId,
  });

  return {
    errorMessage,
    fetchNextPage: userId ? homeFeedQuery.fetchNextPage : undefined,
    feedItems,
    freshUser: user,
    followingCount: user?.following?.length || 0,
    ...status,
    refreshing,
    retry: loadFeed,
    onRefresh,
  };
}
