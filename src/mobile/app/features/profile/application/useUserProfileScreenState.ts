import { useCallback, useEffect, useMemo } from 'react';

import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
import {
  useBlockUserMutation,
  useFollowUserMutation,
  useReportUserMutation,
  useUnblockUserMutation,
  type FollowStateResult,
} from '@/mobile/app/data/hooks/useUserMutations';
import { useVisibleDataQuery } from '@/mobile/app/data/hooks/useVisibleDataQuery';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import { buildPlaceFeedCardItems } from '@/mobile/app/data/selectors/placeAggregation';
import { getBlockStateForUsers } from '@/mobile/app/data/selectors/visibility';

type UseUserProfileScreenStateParams = {
  allowBlockedView: boolean;
  user: User | null;
  userId: string;
};

export function useUserProfileScreenState({
  allowBlockedView,
  user,
  userId,
}: UseUserProfileScreenStateParams) {
  const currentUserId = user?.id;
  const visibleDataQuery = useVisibleDataQuery(currentUserId, {
    listPageSize: 12,
    ownerId: userId,
    publicOnly: true,
  });
  const { mutateAsync: followUserAsync } = useFollowUserMutation();
  const { mutateAsync: reportUserAsync } = useReportUserMutation();
  const { mutateAsync: blockUserAsync } = useBlockUserMutation();
  const { mutateAsync: unblockUserAsync } = useUnblockUserMutation();
  const { fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = visibleDataQuery;
  const visibleUsers = visibleDataQuery.data?.users || [];
  const allUsers = visibleDataQuery.data?.allUsers || [];
  const blockRows = visibleDataQuery.data?.blockRows || [];
  const visibleLists = visibleDataQuery.data?.lists || [];
  const usersById = useMemo(
    () => new Map(visibleUsers.map((item) => [item.id, item])),
    [visibleUsers],
  );
  const errorMessage = visibleDataQuery.error
    ? getUserFacingErrorMessage(
        visibleDataQuery.error,
        'Profil su an yuklenemiyor. Lutfen tekrar dene.',
      )
    : null;

  const loadData = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const { refreshing, onRefresh } = useFocusRefresh(loadData);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const currentUser = useMemo(() => {
    if (!currentUserId) {
      return null;
    }

    return usersById.get(currentUserId) || user;
  }, [currentUserId, user, usersById]);

  const blockState = useMemo(
    () =>
      currentUser
        ? getBlockStateForUsers(blockRows, currentUser.id, userId)
        : { blockedByCurrent: false, blockedByTarget: false },
    [blockRows, currentUser, userId],
  );

  const profileUser = useMemo(
    () =>
      allowBlockedView || blockState.blockedByCurrent
        ? allUsers.find((item) => item.id === userId)
        : usersById.get(userId),
    [allUsers, allowBlockedView, blockState.blockedByCurrent, userId, usersById],
  );

  const isOwnProfile = currentUser?.id === profileUser?.id;
  const isFollowing = currentUser ? (currentUser.following || []).includes(userId) : false;
  const hasPendingFollowRequest = currentUser
    ? (currentUser.pendingFollowRequestsSent || []).includes(userId)
    : false;
  const isBlockedByCurrent = blockState.blockedByCurrent;
  const isBlockedByTarget = blockState.blockedByTarget;
  const canViewProfileContent =
    !isBlockedByCurrent &&
    !isBlockedByTarget &&
    (profileUser?.id === currentUser?.id || profileUser?.isPublicAccount !== false || isFollowing);

  useEffect(() => {
    if (!canViewProfileContent || !hasNextPage || isFetchingNextPage || !fetchNextPage) {
      return;
    }

    void fetchNextPage();
  }, [canViewProfileContent, fetchNextPage, hasNextPage, isFetchingNextPage]);

  const publicLists: PlaceList[] = useMemo(
    () =>
      profileUser && canViewProfileContent
        ? visibleLists.filter((list) => list.userId === profileUser.id && list.isPublic)
        : [],
    [canViewProfileContent, profileUser, visibleLists],
  );

  const allPlaces = useMemo(
    () => buildPlaceFeedCardItems(publicLists, (ownerId) => usersById.get(ownerId)),
    [publicLists, usersById],
  );

  const allPhotos = useMemo(
    () => allPlaces.filter(({ place }) => (place.photos || []).length > 0),
    [allPlaces],
  );

  const followerUsers = useMemo<User[]>(
    () =>
      (profileUser?.followers || [])
        .map((followerId) => usersById.get(followerId))
        .filter((item): item is User => Boolean(item)),
    [profileUser, usersById],
  );

  const followingUsers = useMemo<User[]>(
    () =>
      (profileUser?.following || [])
        .map((followingId) => usersById.get(followingId))
        .filter((item): item is User => Boolean(item)),
    [profileUser, usersById],
  );

  const followUser = useCallback(async (): Promise<FollowStateResult> => {
    if (!currentUser || !profileUser) {
      throw new Error('Takip islemi icin kullanici bulunamadi.');
    }

    return followUserAsync({ currentUserId: currentUser.id, targetUserId: profileUser.id });
  }, [currentUser, followUserAsync, profileUser]);

  const reportUser = useCallback(
    async (reason: string) => {
      if (!currentUser || !profileUser) {
        throw new Error('Kullanici bulunamadi.');
      }

      await reportUserAsync({
        reporterUserId: currentUser.id,
        targetUserId: profileUser.id,
        reason,
      });
    },
    [currentUser, profileUser, reportUserAsync],
  );

  const blockUser = useCallback(async () => {
    if (!currentUser || !profileUser) {
      throw new Error('Kullanici bulunamadi.');
    }

    await blockUserAsync({ currentUserId: currentUser.id, targetUserId: profileUser.id });
  }, [blockUserAsync, currentUser, profileUser]);

  const unblockUser = useCallback(async () => {
    if (!currentUser || !profileUser) {
      throw new Error('Kullanici bulunamadi.');
    }

    await unblockUserAsync({ currentUserId: currentUser.id, targetUserId: profileUser.id });
  }, [currentUser, profileUser, unblockUserAsync]);

  return {
    allPhotos,
    allPlaces,
    blockUser,
    canViewProfileContent,
    currentUser,
    errorMessage,
    fetchNextPage,
    followerUsers,
    followUser,
    followingUsers,
    hasPendingFollowRequest,
    hasNextPage,
    hasPartialDataError: visibleDataQuery.hasPartialDataError,
    isFetchingNextPage,
    isBlockedByCurrent,
    isBlockedByTarget,
    isFollowing,
    isOwnProfile,
    onRefresh,
    profileUser,
    publicLists,
    refreshing,
    reportUser,
    retry: loadData,
    unblockUser,
  };
}
