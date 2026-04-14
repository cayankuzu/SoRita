import { useCallback, useMemo } from 'react';

import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { storage } from '@/mobile/app/data/repositories/supabaseStorage';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import { useStorageVersion } from '@/mobile/app/shared/hooks/useStorageVersion';
import { buildPlaceFeedCardItems } from '@/mobile/app/shared/utils/placeAggregation';

type UseOwnProfileScreenStateParams = {
  user: User | null;
};

export function useOwnProfileScreenState({ user }: UseOwnProfileScreenStateParams) {
  const storageVersion = useStorageVersion();
  const userId = user?.id;

  const loadLists = useCallback(async () => {
    if (!userId) {
      return;
    }

    await storage.refreshVisibleData(userId);
  }, [userId]);

  const { refreshing, onRefresh } = useFocusRefresh(loadLists);

  const freshUser = useMemo(() => {
    if (!userId) {
      return null;
    }

    return storage.findUserById(userId) || user;
  }, [storageVersion, user, userId]);

  const lists = useMemo(() => (userId ? storage.getListsByUserId(userId) : []), [storageVersion, userId]);

  const allPlaces = useMemo(
    () => buildPlaceFeedCardItems(lists, (ownerId) => storage.findUserById(ownerId)),
    [lists, storageVersion],
  );

  const allPhotos = useMemo(
    () => allPlaces.filter(({ place }) => (place.photos || []).length > 0),
    [allPlaces],
  );

  const followerUsers = useMemo<User[]>(
    () =>
      (freshUser?.followers || [])
        .map((targetUserId) => storage.findUserById(targetUserId))
        .filter((item): item is User => Boolean(item)),
    [freshUser, storageVersion],
  );

  const followingUsers = useMemo<User[]>(
    () =>
      (freshUser?.following || [])
        .map((targetUserId) => storage.findUserById(targetUserId))
        .filter((item): item is User => Boolean(item)),
    [freshUser, storageVersion],
  );

  const createList = useCallback(async (list: PlaceList) => {
    await storage.createList(list);
  }, []);

  const deleteList = useCallback(async (listId: string) => {
    await storage.deleteList(listId);
  }, []);

  const updateList = useCallback(async (list: PlaceList) => {
    await storage.updateList(list);
  }, []);

  const updateLists = useCallback(async (listsToUpdate: PlaceList[]) => {
    await storage.updateLists(listsToUpdate);
  }, []);

  const deletePlace = useCallback(async (placeId: string) => {
    await storage.deletePlace(placeId);
  }, []);

  return {
    allPhotos,
    allPlaces,
    createList,
    deleteList,
    deletePlace,
    followerUsers,
    followingUsers,
    freshUser,
    lists,
    onRefresh,
    refreshing,
    updateList,
    updateLists,
  };
}
