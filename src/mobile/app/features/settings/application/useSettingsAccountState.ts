import { useCallback, useMemo } from 'react';

import type { User } from '@/mobile/app/data/contracts/entities';
import {
  useDeleteCurrentUserMutation,
  useUpdateUserMutation,
} from '@/mobile/app/data/hooks/useUserMutations';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { useVisibleDataQuery } from '@/mobile/app/data/hooks/useVisibleDataQuery';
import { usePullToRefresh } from '@/mobile/app/shared/hooks/usePullToRefresh';
import { tr } from '@/mobile/app/shared/i18n/tr';

type UseSettingsAccountStateParams = {
  refreshUser: () => Promise<void>;
  user: User | null;
};

export function useSettingsAccountState({
  refreshUser,
  user,
}: UseSettingsAccountStateParams) {
  const userId = user?.id;
  const visibleDataQuery = useVisibleDataQuery(userId, { includeLists: false });
  const { mutateAsync: updateUserAsync } = useUpdateUserMutation();
  const { mutateAsync: deleteCurrentUserAsync } = useDeleteCurrentUserMutation();
  const { refetch } = visibleDataQuery;
  const visibleUsers = visibleDataQuery.data?.users || [];
  const allUsers = visibleDataQuery.data?.allUsers || [];

  const syncSessionUser = useCallback(() => {
    return refreshUser().catch((error) => {
      logger.warn('settings', 'Background user refresh failed after profile update', error);
    });
  }, [refreshUser]);

  const freshUser = useMemo(() => {
    if (!userId) {
      return null;
    }

    return visibleUsers.find((item) => item.id === userId) || user;
  }, [user, userId, visibleUsers]);

  const blockedUsers = useMemo(
    () =>
      freshUser
        ? (freshUser.blockedUsers || [])
            .map((blockedUserId) => allUsers.find((item) => item.id === blockedUserId))
            .filter((item): item is User => Boolean(item))
        : [],
    [allUsers, freshUser],
  );

  const refreshCurrentUserState = useCallback(async () => {
    if (!userId || !user) {
      return null;
    }

    const [{ data }] = await Promise.all([
      refetch(),
      refreshUser(),
    ]);
    const nextUser = data?.users.find((item) => item.id === userId) || user;
    return nextUser;
  }, [refetch, refreshUser, user, userId]);

  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await refreshCurrentUserState();
  });

  const saveUserProfile = useCallback(
    async (nextUser: User) => {
      const updatedUser = await updateUserAsync(nextUser);
      void syncSessionUser();
      return updatedUser;
    },
    [syncSessionUser, updateUserAsync],
  );

  const saveAccountPrivacy = useCallback(
    async (nextIsPublicAccount: boolean) => {
      if (!freshUser) {
        throw new Error(tr.profile.userActions.userMissing);
      }

      const updatedUser = await updateUserAsync({
        ...freshUser,
        isPublicAccount: nextIsPublicAccount,
      });
      void syncSessionUser();
      return updatedUser;
    },
    [freshUser, syncSessionUser, updateUserAsync],
  );

  const deleteCurrentUser = useCallback(async () => {
    await deleteCurrentUserAsync();
  }, [deleteCurrentUserAsync]);

  return {
    blockedUsers,
    deleteCurrentUser,
    freshUser,
    onRefresh,
    refreshing,
    refreshCurrentUserState,
    saveAccountPrivacy,
    saveUserProfile,
  };
}
