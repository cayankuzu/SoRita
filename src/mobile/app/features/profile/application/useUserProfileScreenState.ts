import { useCallback, useMemo } from 'react';

import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { useProfileReadModelQuery } from '@/mobile/app/data/hooks/useProfileReadModelQuery';
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
import { tr } from '@/mobile/app/shared/i18n/tr';
import { getPlaceMedia } from '@/mobile/app/shared/utils/placeMedia';

type UseUserProfileScreenStateParams = {
  activeTab?: 'gallery' | 'lists' | 'places';
  allowBlockedView: boolean;
  user: User | null;
  userId: string;
};

function mergeProfileUser(
  summaryUser: User | null | undefined,
  contextUser: User | undefined,
) {
  if (!summaryUser) {
    return undefined;
  }

  return {
    ...summaryUser,
    followers: contextUser?.followers ?? summaryUser.followers,
    following: contextUser?.following ?? summaryUser.following,
    pendingFollowRequestsReceived:
      contextUser?.pendingFollowRequestsReceived ??
      summaryUser.pendingFollowRequestsReceived,
    pendingFollowRequestsSent:
      contextUser?.pendingFollowRequestsSent ?? summaryUser.pendingFollowRequestsSent,
  };
}

function resolveUsers(ids: string[] | undefined, usersById: Map<string, User>) {
  return (ids || [])
    .map((id) => usersById.get(id))
    .filter((item): item is User => Boolean(item));
}

function resolveCurrentUser(
  currentUserId: string | undefined,
  usersById: Map<string, User>,
  contextUser: User | null | undefined,
  sessionUser: User | null,
) {
  return currentUserId
    ? usersById.get(currentUserId) || contextUser || sessionUser
    : null;
}

function getProfileViewState(
  profileUser: User | undefined,
  summary: ReturnType<typeof useProfileReadModelQuery>['summary'],
) {
  const isBlockedByCurrent = Boolean(summary?.isBlockedByViewer);
  const isBlockedByTarget = Boolean(summary?.isBlockingViewer);

  return {
    canViewProfileContent: Boolean(
      profileUser &&
        summary?.canViewContent &&
        !isBlockedByCurrent &&
        !isBlockedByTarget,
    ),
    hasPendingFollowRequest: Boolean(summary?.viewerHasPendingFollowRequest),
    isBlockedByCurrent,
    isBlockedByTarget,
    isFollowing: Boolean(summary?.viewerHasFollowed),
  };
}

function selectProfileContent(
  canView: boolean,
  lists: PlaceList[],
  places: ReturnType<typeof useProfileReadModelQuery>['places'],
) {
  if (!canView) {
    return { places: [], publicLists: [] };
  }

  return {
    places: places.filter((item) => item.listIsPublic),
    publicLists: lists.filter((list) => list.isPublic),
  };
}

function resolveSessionProfileUser(
  currentUserId: string | undefined,
  summaryUser: User | null | undefined,
  contextUser: User | undefined,
) {
  return currentUserId
    ? mergeProfileUser(summaryUser, contextUser)
    : undefined;
}

function getProfileResultStatus(params: {
  currentUser: User | null;
  followerCount?: number;
  followerUsersCount: number;
  followingCount?: number;
  followingUsersCount: number;
  hasPendingFollowRequest: boolean;
  isLoading: boolean;
  profileUser?: User;
  summaryExists: boolean;
}) {
  return {
    followerCount: params.followerCount ?? params.followerUsersCount,
    followingCount: params.followingCount ?? params.followingUsersCount,
    hasPendingFollowRequest:
      Boolean(params.currentUser) && params.hasPendingFollowRequest,
    isInitialLoading: params.isLoading && !params.summaryExists,
    isOwnProfile: Boolean(
      params.currentUser?.id &&
        params.profileUser?.id &&
        params.currentUser.id === params.profileUser.id,
    ),
  };
}

function getProfileErrorMessage(error: unknown) {
  return error
    ? getUserFacingErrorMessage(error, tr.profile.error.userRetryDescription)
    : null;
}

export function useUserProfileScreenState({
  activeTab = 'lists',
  allowBlockedView: _allowBlockedView,
  user,
  userId,
}: UseUserProfileScreenStateParams) {
  const currentUserId = user ? user.id : undefined;
  const profileQuery = useProfileReadModelQuery(userId, currentUserId, {
    activeTab,
    enabled: Boolean(currentUserId) && userId.length > 0,
  });
  const contextQuery = useVisibleDataQuery(currentUserId, {
    enabled: Boolean(currentUserId),
    includeLists: false,
    includePlaceComments: false,
  });
  const { mutateAsync: followUserAsync } = useFollowUserMutation();
  const { mutateAsync: reportUserAsync } = useReportUserMutation();
  const { mutateAsync: blockUserAsync } = useBlockUserMutation();
  const { mutateAsync: unblockUserAsync } = useUnblockUserMutation();
  const users = useMemo(
    () => [
      ...new Map(
        [
          ...(contextQuery.data?.allUsers || []),
          ...(contextQuery.data?.users || []),
        ].map((item) => [item.id, item]),
      ).values(),
    ],
    [contextQuery.data?.allUsers, contextQuery.data?.users],
  );
  const usersById = useMemo(
    () => new Map(users.map((item) => [item.id, item])),
    [users],
  );
  const currentUser = resolveCurrentUser(
    currentUserId,
    usersById,
    contextQuery.data?.currentUser,
    user,
  );
  const targetContextUser = usersById.get(userId);
  const profileUser = resolveSessionProfileUser(
    currentUserId,
    profileQuery.summary?.user,
    targetContextUser,
  );
  const viewState = getProfileViewState(profileUser, profileQuery.summary);
  const { places: allPlaces, publicLists } = useMemo(
    () => selectProfileContent(
      viewState.canViewProfileContent,
      profileQuery.lists,
      profileQuery.places,
    ),
    [profileQuery.lists, profileQuery.places, viewState.canViewProfileContent],
  );
  const allPhotos = useMemo(
    () => allPlaces.filter(({ place }) => getPlaceMedia(place).length > 0),
    [allPlaces],
  );
  const followerUsers = useMemo(
    () => resolveUsers(profileUser?.followers, usersById),
    [profileUser?.followers, usersById],
  );
  const followingUsers = useMemo(
    () => resolveUsers(profileUser?.following, usersById),
    [profileUser?.following, usersById],
  );
  const errorMessage = getProfileErrorMessage(profileQuery.error);

  const loadData = useCallback(async () => {
    await Promise.allSettled([
      profileQuery.refetch(),
      contextQuery.refetch(),
    ]);
  }, [contextQuery, profileQuery]);
  const { refreshing, onRefresh } = useFocusRefresh(loadData, {
    refreshOnFocus: false,
    skipInitialFocus: true,
  });
  const resultStatus = getProfileResultStatus({
    currentUser,
    followerCount: profileQuery.summary?.followerCount,
    followerUsersCount: followerUsers.length,
    followingCount: profileQuery.summary?.followingCount,
    followingUsersCount: followingUsers.length,
    hasPendingFollowRequest: viewState.hasPendingFollowRequest,
    isLoading: profileQuery.isLoading,
    profileUser,
    summaryExists: Boolean(profileQuery.summary),
  });

  const followUser = useCallback(async (): Promise<FollowStateResult> => {
    if (!currentUser || !profileUser) {
      throw new Error(tr.profile.userActions.followUserMissing);
    }

    return followUserAsync({
      currentUserId: currentUser.id,
      targetUserId: profileUser.id,
    });
  }, [currentUser, followUserAsync, profileUser]);

  const reportUser = useCallback(
    async (reason: string, details?: string) => {
      if (!currentUser || !profileUser) {
        throw new Error(tr.profile.userActions.userMissing);
      }

      await reportUserAsync({
        details,
        reason,
        reporterUserId: currentUser.id,
        targetUserId: profileUser.id,
      });
    },
    [currentUser, profileUser, reportUserAsync],
  );

  const blockUser = useCallback(async () => {
    if (!currentUser || !profileUser) {
      throw new Error(tr.profile.userActions.userMissing);
    }

    await blockUserAsync({
      currentUserId: currentUser.id,
      targetUserId: profileUser.id,
    });
  }, [blockUserAsync, currentUser, profileUser]);

  const unblockUser = useCallback(async () => {
    if (!currentUser || !profileUser) {
      throw new Error(tr.profile.userActions.userMissing);
    }

    await unblockUserAsync({
      currentUserId: currentUser.id,
      targetUserId: profileUser.id,
    });
  }, [currentUser, profileUser, unblockUserAsync]);

  return {
    allPhotos,
    allPlaces,
    blockUser,
    canViewProfileContent: viewState.canViewProfileContent,
    currentUser,
    errorMessage,
    fetchNextPage: profileQuery.fetchNextPage,
    followerCount: resultStatus.followerCount,
    followerUsers,
    followUser,
    followingCount: resultStatus.followingCount,
    followingUsers,
    hasNextPage: profileQuery.hasNextPage,
    hasPartialDataError: profileQuery.hasPartialDataError,
    hasPendingFollowRequest: resultStatus.hasPendingFollowRequest,
    isBlockedByCurrent: viewState.isBlockedByCurrent,
    isBlockedByTarget: viewState.isBlockedByTarget,
    isFetchingNextPage: profileQuery.isFetchingNextPage,
    isFollowing: viewState.isFollowing,
    isInitialLoading: resultStatus.isInitialLoading,
    isOwnProfile: resultStatus.isOwnProfile,
    onRefresh,
    profileUser,
    publicLists,
    refreshing,
    reportUser,
    retry: loadData,
    unblockUser,
  };
}
