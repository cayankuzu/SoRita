import { useCallback, useMemo } from 'react';

import type { User } from '@/mobile/app/data/contracts/entities';
import { storage } from '@/mobile/app/data/repositories/supabaseStorage';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import { useStorageVersion } from '@/mobile/app/shared/hooks/useStorageVersion';
import { buildPlaceFeedCardItems } from '@/mobile/app/shared/utils/placeAggregation';

type UseHomeFeedScreenStateParams = {
  user: User | null;
};

export function useHomeFeedScreenState({ user }: UseHomeFeedScreenStateParams) {
  const storageVersion = useStorageVersion();
  const userId = user?.id;

  const loadFeed = useCallback(async () => {
    if (!userId) {
      return;
    }

    await storage.refreshVisibleData(userId);
  }, [userId]);

  const { refreshing, onRefresh } = useFocusRefresh(loadFeed);

  const freshUser = useMemo(() => {
    if (!userId) {
      return null;
    }

    return storage.findUserById(userId) || user;
  }, [storageVersion, user, userId]);

  const visibleFeedLists = useMemo(() => {
    if (!userId || !freshUser) {
      return [];
    }

    const followingIds = new Set(freshUser.following || []);

    return storage.getLists().filter(
      (list) =>
        (list.userId === userId || followingIds.has(list.userId)) &&
        (list.isPublic || list.userId === userId),
    );
  }, [freshUser, storageVersion, userId]);

  const feedItems = useMemo(
    () => buildPlaceFeedCardItems(visibleFeedLists, (ownerId) => storage.findUserById(ownerId)),
    [storageVersion, visibleFeedLists],
  );

  return {
    feedItems,
    freshUser,
    followingCount: freshUser?.following?.length || 0,
    refreshing,
    onRefresh,
  };
}
