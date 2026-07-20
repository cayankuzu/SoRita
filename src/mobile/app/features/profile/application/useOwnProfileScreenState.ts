import { useCallback, useMemo } from 'react';

import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
import {
  useCreateListMutation,
  useDeleteListMutation,
  useUpdateListMutation,
  useUpdateListsMutation,
} from '@/mobile/app/data/hooks/useListMutations';
import { useDeletePlaceMutation } from '@/mobile/app/data/hooks/usePlaceMutations';
import { useProfileReadModelQuery } from '@/mobile/app/data/hooks/useProfileReadModelQuery';
import { useVisibleDataQuery } from '@/mobile/app/data/hooks/useVisibleDataQuery';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { getPlaceMedia } from '@/mobile/app/shared/utils/placeMedia';

type UseOwnProfileScreenStateParams = {
  activeTab?: 'gallery' | 'lists' | 'places';
  user: User | null;
};

export function useOwnProfileScreenState({ activeTab = 'lists', user }: UseOwnProfileScreenStateParams) {
  const userId = user?.id;
  const profileQuery = useProfileReadModelQuery(userId, userId, {
    activeTab,
    enabled: Boolean(userId),
  });
  const visibleDataQuery = useVisibleDataQuery(userId, {
    enabled: Boolean(userId),
    includeLists: false,
    includePlaceComments: false,
  });
  const { mutateAsync: createListAsync } = useCreateListMutation();
  const { mutateAsync: deleteListAsync } = useDeleteListMutation();
  const { mutateAsync: updateListAsync } = useUpdateListMutation();
  const { mutateAsync: updateListsAsync } = useUpdateListsMutation();
  const { mutateAsync: deletePlaceAsync } = useDeletePlaceMutation();
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = profileQuery;
  const visibleUsers = useMemo(
    () => visibleDataQuery.data?.users || [],
    [visibleDataQuery.data?.users],
  );
  const usersById = useMemo(
    () => new Map(visibleUsers.map((item) => [item.id, item])),
    [visibleUsers],
  );
  const errorMessage = profileQuery.error
    ? getUserFacingErrorMessage(
        profileQuery.error,
        tr.profile.error.ownRetryDescription,
      )
    : null;

  const loadLists = useCallback(async () => {
    if (!userId) {
      return;
    }

    await Promise.allSettled([
      profileQuery.refetch(),
      visibleDataQuery.refetch(),
    ]);
  }, [profileQuery, userId, visibleDataQuery]);

  const { refreshing, onRefresh } = useFocusRefresh(loadLists, {
    refreshOnFocus: false,
    skipInitialFocus: true,
  });

  const freshUser = useMemo(() => {
    if (!userId) {
      return null;
    }

    const contextUser = usersById.get(userId) || visibleDataQuery.data?.currentUser || user;

    if (profileQuery.summary?.user) {
      return {
        ...profileQuery.summary.user,
        followers: contextUser?.followers,
        following: contextUser?.following,
        pendingFollowRequestsReceived: contextUser?.pendingFollowRequestsReceived,
        pendingFollowRequestsSent: contextUser?.pendingFollowRequestsSent,
      };
    }

    return contextUser;
  }, [
    profileQuery.summary,
    user,
    userId,
    usersById,
    visibleDataQuery.data?.currentUser,
  ]);

  const lists = useMemo(
    () => {
      if (!userId) {
        return [];
      }

      const placesByListId = new Map<string, PlaceList['places']>();

      profileQuery.places.forEach((item) => {
        const places = placesByListId.get(item.listId) || [];
        places.push(item.place);
        placesByListId.set(item.listId, places);
      });

      return profileQuery.lists.map((list) => ({
        ...list,
        places: placesByListId.get(list.id) || [],
      }));
    },
    [profileQuery.lists, profileQuery.places, userId],
  );

  const allPlaces = profileQuery.places;

  const allPhotos = useMemo(
    () => allPlaces.filter(({ place }) => getPlaceMedia(place).length > 0),
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
  const followerCount = profileQuery.summary?.followerCount ?? followerUsers.length;
  const followingCount = profileQuery.summary?.followingCount ?? followingUsers.length;

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
    const previousList = profileQuery.lists.find((item) => item.id === list.id);
    await updateListAsync({ list, previousList });
  }, [profileQuery.lists, updateListAsync]);

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
    followerCount,
    followerUsers,
    followingCount,
    followingUsers,
    freshUser,
    hasNextPage,
    hasPartialDataError: profileQuery.hasPartialDataError,
    isFetchingNextPage,
    isInitialLoading: profileQuery.isLoading && !profileQuery.summary,
    lists,
    onRefresh,
    refreshing,
    retry: loadLists,
    updateList,
    updateLists,
  };
}
