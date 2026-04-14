import { useCallback, useDeferredValue, useMemo } from 'react';

import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { storage, type FollowStateResult } from '@/mobile/app/data/repositories/supabaseStorage';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import { useStorageVersion } from '@/mobile/app/shared/hooks/useStorageVersion';
import {
  buildPlaceFeedCardItems,
  type PlaceFeedCardItem,
} from '@/mobile/app/shared/utils/placeAggregation';

type UseExploreScreenStateParams = {
  user: User | null;
  searchQuery: string;
};

type ExploreListItem = {
  list: PlaceList;
  owner: User | null;
};

export function useExploreScreenState({ user, searchQuery }: UseExploreScreenStateParams) {
  const storageVersion = useStorageVersion();
  const userId = user?.id;
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const q = deferredSearchQuery.trim().toLowerCase();

  const loadData = useCallback(async () => {
    if (!userId) {
      return;
    }

    await storage.refreshVisibleData(userId);
  }, [userId]);

  const { refreshing, onRefresh } = useFocusRefresh(loadData);

  const currentUser = useMemo(() => {
    if (!userId) {
      return null;
    }

    return storage.findUserById(userId) || user;
  }, [storageVersion, user, userId]);

  const following = currentUser?.following || [];
  const pendingFollowRequests = currentUser?.pendingFollowRequestsSent || [];

  const allUsers = useMemo(() => {
    if (!userId) {
      return [];
    }

    return storage.getUsers().filter((item) => item.id !== userId);
  }, [storageVersion, userId]);

  const publicLists = useMemo(() => {
    const followingUserIds = new Set(following);
    const discoverableContentUserIds = new Set(
      allUsers
        .filter((item) => item.isPublicAccount !== false && !followingUserIds.has(item.id))
        .map((item) => item.id),
    );

    return storage
      .getPublicLists()
      .filter((list) => discoverableContentUserIds.has(list.userId))
      .sort((a, b) => (b.likes || 0) - (a.likes || 0));
  }, [allUsers, following, storageVersion]);

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
        owner: storage.findUserById(list.userId) || null,
      })),
    [filteredLists, storageVersion],
  );

  const placeFeedItems = useMemo<PlaceFeedCardItem[]>(
    () => buildPlaceFeedCardItems(publicLists, (ownerId) => storage.findUserById(ownerId)),
    [publicLists, storageVersion],
  );

  const filteredPlaces = useMemo(
    () =>
      placeFeedItems.filter(
        ({ place }) =>
          !q ||
          place.name.toLowerCase().includes(q) ||
          place.address?.toLowerCase().includes(q),
      ),
    [placeFeedItems, q],
  );

  const filteredPhotos = useMemo(
    () =>
      placeFeedItems.filter(
        ({ place }) =>
          (place.photos || []).length > 0 && (!q || place.name.toLowerCase().includes(q)),
      ),
    [placeFeedItems, q],
  );

  const filteredUsers = useMemo(
    () =>
      allUsers.filter(
        (item) =>
          !following.includes(item.id) &&
          (!q ||
            item.name.toLowerCase().includes(q) ||
            item.username.toLowerCase().includes(q) ||
            item.bio?.toLowerCase().includes(q)),
      ),
    [allUsers, following, q],
  );

  const followUser = useCallback(
    async (targetUserId: string): Promise<FollowStateResult> => {
      if (!userId) {
        throw new Error('Takip islemi icin aktif kullanici gerekli.');
      }

      return storage.followUser(userId, targetUserId);
    },
    [userId],
  );

  return {
    currentUser,
    filteredListItems,
    filteredPhotos,
    filteredPlaces,
    filteredUsers,
    followUser,
    following,
    pendingFollowRequests,
    refreshing,
    onRefresh,
  };
}
