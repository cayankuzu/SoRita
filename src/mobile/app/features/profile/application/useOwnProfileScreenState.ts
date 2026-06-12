import { useCallback, useEffect, useMemo } from 'react';

import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
import {
  useCreateListMutation,
  useDeleteListMutation,
  useUpdateListMutation,
  useUpdateListsMutation,
} from '@/mobile/app/data/hooks/useListMutations';
import { useDeletePlaceMutation } from '@/mobile/app/data/hooks/usePlaceMutations';
import { useVisibleDataQuery } from '@/mobile/app/data/hooks/useVisibleDataQuery';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import { buildPlaceFeedCardItems } from '@/mobile/app/data/selectors/placeAggregation';

type UseOwnProfileScreenStateParams = {
  user: User | null;
};

export function useOwnProfileScreenState({ user }: UseOwnProfileScreenStateParams) {
  const userId = user?.id;
  const visibleDataQuery = useVisibleDataQuery(userId, {
    ownerId: userId || undefined,
    listPageSize: 12,
  });
  const { mutateAsync: createListAsync } = useCreateListMutation();
  const { mutateAsync: deleteListAsync } = useDeleteListMutation();
  const { mutateAsync: updateListAsync } = useUpdateListMutation();
  const { mutateAsync: updateListsAsync } = useUpdateListsMutation();
  const { mutateAsync: deletePlaceAsync } = useDeletePlaceMutation();
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
        'Profil verileri su an yuklenemiyor. Lutfen tekrar dene.',
      )
    : null;

  const loadLists = useCallback(async () => {
    if (!userId) {
      return;
    }

    await refetch();
  }, [refetch, userId]);

  const { refreshing, onRefresh } = useFocusRefresh(loadLists);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

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

  const lists = useMemo(
    () => (userId ? visibleLists.filter((list) => list.userId === userId) : []),
    [userId, visibleLists],
  );

  const allPlaces = useMemo(
    () => buildPlaceFeedCardItems(lists, (ownerId) => usersById.get(ownerId)),
    [lists, usersById],
  );

  const allPhotos = useMemo(
    () => allPlaces.filter(({ place }) => (place.photos || []).length > 0),
    [allPlaces],
  );

  const followerUsers = useMemo<User[]>(
    () =>
      (freshUser?.followers || [])
        .map((targetUserId) => usersById.get(targetUserId))
        .filter((item): item is User => Boolean(item)),
    [freshUser, usersById],
  );

  const followingUsers = useMemo<User[]>(
    () =>
      (freshUser?.following || [])
        .map((targetUserId) => usersById.get(targetUserId))
        .filter((item): item is User => Boolean(item)),
    [freshUser, usersById],
  );

  const createList = useCallback(async (list: PlaceList) => {
    if (!userId) {
      return;
    }

    await createListAsync({ ...list, userId });
  }, [createListAsync, userId]);

  const deleteList = useCallback(async (listId: string) => {
    await deleteListAsync(listId);
  }, [deleteListAsync]);

  const updateList = useCallback(async (list: PlaceList) => {
    await updateListAsync(list);
  }, [updateListAsync]);

  const updateLists = useCallback(async (listsToUpdate: PlaceList[]) => {
    await updateListsAsync(listsToUpdate);
  }, [updateListsAsync]);

  const deletePlace = useCallback(async (placeId: string) => {
    await deletePlaceAsync(placeId);
  }, [deletePlaceAsync]);

  return {
    allPhotos,
    allPlaces,
    createList,
    deleteList,
    deletePlace,
    errorMessage,
    fetchNextPage,
    followerUsers,
    followingUsers,
    freshUser,
    hasNextPage,
    hasPartialDataError: visibleDataQuery.hasPartialDataError,
    isFetchingNextPage,
    lists,
    onRefresh,
    refreshing,
    retry: loadLists,
    updateList,
    updateLists,
  };
}
