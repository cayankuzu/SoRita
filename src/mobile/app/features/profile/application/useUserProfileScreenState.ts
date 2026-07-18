import { useCallback, useMemo } from 'react';

import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
import {
  useBlockUserMutation,
  useFollowUserMutation,
  useReportUserMutation,
  useUnblockUserMutation,
  type FollowStateResult,
} from '@/mobile/app/data/hooks/useUserMutations';
import { useProfileReadModelQuery } from '@/mobile/app/data/hooks/useProfileReadModelQuery';
import { useVisibleDataQuery } from '@/mobile/app/data/hooks/useVisibleDataQuery';
import { isMissingReadModelError } from '@/mobile/app/data/query/readModelErrors';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { buildPlaceFeedCardItems } from '@/mobile/app/data/selectors/placeAggregation';
import { getBlockStateForUsers } from '@/mobile/app/data/selectors/visibility';
import { getPlaceMedia } from '@/mobile/app/shared/utils/placeMedia';

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
  const profileQuery = useProfileReadModelQuery(userId, currentUserId, {
    enabled: Boolean(currentUserId && userId),
  });
  const shouldUseLegacyVisibleData = isMissingReadModelError(profileQuery.error);
  const visibleDataQuery = useVisibleDataQuery(currentUserId, {
    enabled: Boolean(currentUserId),
    includeLists: shouldUseLegacyVisibleData,
    includePlaceComments: false,
    listPageSize: 12,
    ownerId: shouldUseLegacyVisibleData ? userId : undefined,
    publicOnly: true,
  });
  const { mutateAsync: followUserAsync } = useFollowUserMutation();
  const { mutateAsync: reportUserAsync } = useReportUserMutation();
  const { mutateAsync: blockUserAsync } = useBlockUserMutation();
  const { mutateAsync: unblockUserAsync } = useUnblockUserMutation();
  const activeQuery = shouldUseLegacyVisibleData ? visibleDataQuery : profileQuery;
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = activeQuery;
  const visibleUsers = visibleDataQuery.data?.users || [];
  const allUsers = visibleDataQuery.data?.allUsers || [];
  const blockRows = visibleDataQuery.data?.blockRows || [];
  const visibleLists = visibleDataQuery.data?.lists || [];
  const usersById = useMemo(
    () => new Map(visibleUsers.map((item) => [item.id, item])),
    [visibleUsers],
  );
  const errorMessage = activeQuery.error
    ? getUserFacingErrorMessage(
        activeQuery.error,
        tr.profile.error.userRetryDescription,
      )
    : null;

  const loadData = useCallback(async () => {
    await Promise.allSettled([
      activeQuery.refetch(),
      shouldUseLegacyVisibleData ? Promise.resolve() : visibleDataQuery.refetch(),
    ]);
  }, [activeQuery, shouldUseLegacyVisibleData, visibleDataQuery]);

  const { refreshing, onRefresh } = useFocusRefresh(loadData, {
    refreshOnFocus: false,
    skipInitialFocus: true,
  });

  const currentUser = useMemo(() => {
    if (!currentUserId) {
      return null;
    }

    return usersById.get(currentUserId) || visibleDataQuery.data?.currentUser || user;
  }, [currentUserId, user, usersById, visibleDataQuery.data?.currentUser]);

  const blockState = useMemo(
    () => {
      if (!shouldUseLegacyVisibleData && profileQuery.summary) {
        return {
          blockedByCurrent: profileQuery.summary.isBlockedByViewer,
          blockedByTarget: profileQuery.summary.isBlockingViewer,
        };
      }

      return currentUser
        ? getBlockStateForUsers(blockRows, currentUser.id, userId)
        : { blockedByCurrent: false, blockedByTarget: false };
    },
    [blockRows, currentUser, profileQuery.summary, shouldUseLegacyVisibleData, userId],
  );

  const profileUser = useMemo(
    () => {
      if (!shouldUseLegacyVisibleData && profileQuery.summary?.user) {
        const contextUser = allUsers.find((item) => item.id === userId) || usersById.get(userId);

        return {
          ...profileQuery.summary.user,
          followers: contextUser?.followers,
          following: contextUser?.following,
          pendingFollowRequestsReceived: contextUser?.pendingFollowRequestsReceived,
          pendingFollowRequestsSent: contextUser?.pendingFollowRequestsSent,
        };
      }

      return allowBlockedView || blockState.blockedByCurrent
        ? allUsers.find((item) => item.id === userId)
        : usersById.get(userId);
    },
    [
      allUsers,
      allowBlockedView,
      blockState.blockedByCurrent,
      profileQuery.summary,
      shouldUseLegacyVisibleData,
      userId,
      usersById,
    ],
  );

  const isOwnProfile = currentUser?.id === profileUser?.id;
  const isFollowing =
    !shouldUseLegacyVisibleData && profileQuery.summary
      ? profileQuery.summary.viewerHasFollowed
      : currentUser
        ? (currentUser.following || []).includes(userId)
        : false;
  const hasPendingFollowRequest = currentUser
    ? !shouldUseLegacyVisibleData && profileQuery.summary
      ? profileQuery.summary.viewerHasPendingFollowRequest
      : (currentUser.pendingFollowRequestsSent || []).includes(userId)
    : false;
  const isBlockedByCurrent = blockState.blockedByCurrent;
  const isBlockedByTarget = blockState.blockedByTarget;
  const canViewProfileContent =
    !shouldUseLegacyVisibleData && profileQuery.summary
      ? profileQuery.summary.canViewContent && !isBlockedByCurrent && !isBlockedByTarget
      : !isBlockedByCurrent &&
        !isBlockedByTarget &&
        (profileUser?.id === currentUser?.id || profileUser?.isPublicAccount !== false || isFollowing);

  const publicLists: PlaceList[] = useMemo(
    () =>
      profileUser && canViewProfileContent
        ? shouldUseLegacyVisibleData
          ? visibleLists.filter((list) => list.userId === profileUser.id && list.isPublic)
          : profileQuery.lists.filter((list) => list.isPublic)
        : [],
    [
      canViewProfileContent,
      profileQuery.lists,
      profileUser,
      shouldUseLegacyVisibleData,
      visibleLists,
    ],
  );

  const allPlaces = useMemo(
    () =>
      shouldUseLegacyVisibleData
        ? buildPlaceFeedCardItems(publicLists, (ownerId) => usersById.get(ownerId))
        : profileQuery.places.filter((item) => item.listIsPublic),
    [profileQuery.places, publicLists, shouldUseLegacyVisibleData, usersById],
  );

  const allPhotos = useMemo(
    () => allPlaces.filter(({ place }) => getPlaceMedia(place).length > 0),
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
  const followerCount = profileQuery.summary?.followerCount ?? followerUsers.length;
  const followingCount = profileQuery.summary?.followingCount ?? followingUsers.length;

  const followUser = useCallback(async (): Promise<FollowStateResult> => {
    if (!currentUser || !profileUser) {
      throw new Error(tr.profile.userActions.followUserMissing);
    }

    return followUserAsync({ currentUserId: currentUser.id, targetUserId: profileUser.id });
  }, [currentUser, followUserAsync, profileUser]);

  const reportUser = useCallback(
    async (reason: string, details?: string) => {
      if (!currentUser || !profileUser) {
        throw new Error(tr.profile.userActions.userMissing);
      }

      await reportUserAsync({
        reporterUserId: currentUser.id,
        targetUserId: profileUser.id,
        reason,
        details,
      });
    },
    [currentUser, profileUser, reportUserAsync],
  );

  const blockUser = useCallback(async () => {
    if (!currentUser || !profileUser) {
      throw new Error(tr.profile.userActions.userMissing);
    }

    await blockUserAsync({ currentUserId: currentUser.id, targetUserId: profileUser.id });
  }, [blockUserAsync, currentUser, profileUser]);

  const unblockUser = useCallback(async () => {
    if (!currentUser || !profileUser) {
      throw new Error(tr.profile.userActions.userMissing);
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
    followerCount,
    followerUsers,
    followUser,
    followingCount,
    followingUsers,
    hasPendingFollowRequest,
    hasNextPage,
    hasPartialDataError: shouldUseLegacyVisibleData
      ? visibleDataQuery.hasPartialDataError
      : profileQuery.hasPartialDataError,
    isFetchingNextPage,
    isBlockedByCurrent,
    isBlockedByTarget,
    isFollowing,
    isInitialLoading: shouldUseLegacyVisibleData
      ? visibleDataQuery.isLoading && !visibleDataQuery.data
      : profileQuery.isLoading && !profileQuery.summary,
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
