import { useCallback, useMemo } from 'react';

import type { User } from '@/mobile/app/data/contracts/entities';
import { storage } from '@/mobile/app/data/repositories/supabaseStorage';
import { usePullToRefresh } from '@/mobile/app/shared/hooks/usePullToRefresh';
import { useStorageVersion } from '@/mobile/app/shared/hooks/useStorageVersion';

type UseSettingsAccountStateParams = {
  refreshUser: () => Promise<void>;
  user: User | null;
};

export function useSettingsAccountState({
  refreshUser,
  user,
}: UseSettingsAccountStateParams) {
  const storageVersion = useStorageVersion();
  const userId = user?.id;

  const freshUser = useMemo(() => {
    if (!userId) {
      return null;
    }

    return storage.findUserById(userId) || user;
  }, [storageVersion, user, userId]);

  const blockedUsers = useMemo(
    () => (freshUser ? storage.getBlockedUsers(freshUser.id) : []),
    [freshUser, storageVersion],
  );

  const refreshCurrentUserState = useCallback(async () => {
    if (!userId || !user) {
      return null;
    }

    await storage.refreshVisibleData(userId);
    const nextUser = storage.findUserById(userId) || user;
    await refreshUser();
    return nextUser;
  }, [refreshUser, user, userId]);

  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await refreshCurrentUserState();
  });

  const saveUserProfile = useCallback(
    async (nextUser: User) => {
      const updatedUser = await storage.updateUser(nextUser);
      await refreshUser();
      return updatedUser;
    },
    [refreshUser],
  );

  const saveAccountPrivacy = useCallback(
    async (nextIsPublicAccount: boolean) => {
      if (!freshUser) {
        throw new Error('Kullanici bulunamadi.');
      }

      const updatedUser = await storage.updateUser({
        ...freshUser,
        isPublicAccount: nextIsPublicAccount,
      });
      await refreshUser();
      return updatedUser;
    },
    [freshUser, refreshUser],
  );

  const deleteCurrentUser = useCallback(async () => {
    await storage.deleteUser();
  }, []);

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
