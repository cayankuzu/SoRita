import { useCallback, useMemo } from 'react';

import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { storage, type FollowStateResult } from '@/mobile/app/data/repositories/supabaseStorage';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import { useStorageVersion } from '@/mobile/app/shared/hooks/useStorageVersion';
import { buildPlaceFeedCardItems } from '@/mobile/app/shared/utils/placeAggregation';

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
  const storageVersion = useStorageVersion();
  const currentUserId = user?.id;

  const loadData = useCallback(async () => {
    await storage.refreshVisibleData(currentUserId);
  }, [currentUserId]);

  const { refreshing, onRefresh } = useFocusRefresh(loadData);

  const currentUser = useMemo(() => {
    if (!currentUserId) {
      return null;
    }

    return storage.findUserById(currentUserId) || user;
  }, [currentUserId, storageVersion, user]);

  const blockState = useMemo(
    () =>
      currentUser
        ? storage.getBlockState(currentUser.id, userId)
        : { blockedByCurrent: false, blockedByTarget: false },
    [currentUser, storageVersion, userId],
  );

  const profileUser = useMemo(
    () =>
      allowBlockedView || blockState.blockedByCurrent
        ? storage.findUserByIdIncludingBlocked(userId)
        : storage.findUserById(userId),
    [allowBlockedView, blockState.blockedByCurrent, storageVersion, userId],
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

  const publicLists: PlaceList[] = useMemo(
    () =>
      profileUser && canViewProfileContent
        ? storage.getListsByUserId(profileUser.id).filter((list) => list.isPublic)
        : [],
    [canViewProfileContent, profileUser, storageVersion],
  );

  const allPlaces = useMemo(
    () => buildPlaceFeedCardItems(publicLists, (ownerId) => storage.findUserById(ownerId)),
    [publicLists, storageVersion],
  );

  const allPhotos = useMemo(
    () => allPlaces.filter(({ place }) => (place.photos || []).length > 0),
    [allPlaces],
  );

  const followerUsers = useMemo<User[]>(
    () =>
      (profileUser?.followers || [])
        .map((followerId) => storage.findUserById(followerId))
        .filter((item): item is User => Boolean(item)),
    [profileUser, storageVersion],
  );

  const followingUsers = useMemo<User[]>(
    () =>
      (profileUser?.following || [])
        .map((followingId) => storage.findUserById(followingId))
        .filter((item): item is User => Boolean(item)),
    [profileUser, storageVersion],
  );

  const followUser = useCallback(async (): Promise<FollowStateResult> => {
    if (!currentUser || !profileUser) {
      throw new Error('Takip islemi icin kullanici bulunamadi.');
    }

    return storage.followUser(currentUser.id, profileUser.id);
  }, [currentUser, profileUser]);

  const reportUser = useCallback(
    async (reason: string) => {
      if (!currentUser || !profileUser) {
        throw new Error('Kullanici bulunamadi.');
      }

      await storage.reportUser(currentUser.id, profileUser.id, reason);
    },
    [currentUser, profileUser],
  );

  const blockUser = useCallback(async () => {
    if (!currentUser || !profileUser) {
      throw new Error('Kullanici bulunamadi.');
    }

    await storage.blockUser(currentUser.id, profileUser.id);
  }, [currentUser, profileUser]);

  const unblockUser = useCallback(async () => {
    if (!currentUser || !profileUser) {
      throw new Error('Kullanici bulunamadi.');
    }

    await storage.unblockUser(currentUser.id, profileUser.id);
  }, [currentUser, profileUser]);

  return {
    allPhotos,
    allPlaces,
    blockUser,
    canViewProfileContent,
    currentUser,
    followerUsers,
    followUser,
    followingUsers,
    hasPendingFollowRequest,
    isBlockedByCurrent,
    isBlockedByTarget,
    isFollowing,
    isOwnProfile,
    onRefresh,
    profileUser,
    publicLists,
    refreshing,
    reportUser,
    unblockUser,
  };
}
