import type { User } from '@/mobile/app/data/contracts/entities';
import type { UserBlockRow } from '@/mobile/app/platform/supabase/databaseTypes';

export type FollowStateResult = 'following' | 'requested' | 'unfollowed';

type RunOptimisticMutation = <T>(
  applyOptimistic: () => void,
  task: () => Promise<T>,
  onError?: (error: unknown) => Promise<void> | void,
) => Promise<T>;

type StorageRelationshipsDependencies = {
  supabase: typeof import('@/mobile/app/platform/supabase/client').supabase;
  getUsersCache: () => User[];
  setUsersCache: (users: User[]) => void;
  getBlockRowsCache: () => UserBlockRow[];
  setBlockRowsCache: (rows: UserBlockRow[]) => void;
  getCurrentUserCache: () => User | null;
  setCurrentUserCache: (user: User | null) => void;
  getBlockState: (
    currentUserId: string,
    targetUserId: string,
  ) => { blockedByCurrent: boolean; blockedByTarget: boolean };
  runOptimisticMutation: RunOptimisticMutation;
  refreshUsers: () => Promise<void>;
  refreshLists: (currentUserId?: string) => Promise<void>;
};

export function createStorageRelationshipsRepository({
  supabase,
  getUsersCache,
  setUsersCache,
  getBlockRowsCache,
  setBlockRowsCache,
  getCurrentUserCache,
  setCurrentUserCache,
  getBlockState,
  runOptimisticMutation,
  refreshUsers,
  refreshLists,
}: StorageRelationshipsDependencies) {
  return {
    async followUser(currentUserId: string, targetUserId: string): Promise<FollowStateResult> {
      const blockState = getBlockState(currentUserId, targetUserId);

      if (blockState.blockedByCurrent) {
        throw new Error('Bu kullaniciyi engelledin. Takip etmek icin once engeli kaldir.');
      }

      if (blockState.blockedByTarget) {
        throw new Error('Bu kullanici ile su anda etkilesime gecemezsin.');
      }

      const currentUser = getUsersCache().find((item) => item.id === currentUserId);
      const targetUser = getUsersCache().find((item) => item.id === targetUserId);
      const isFollowing = Boolean(currentUser?.following?.includes(targetUserId));
      const hasPendingRequest = Boolean(currentUser?.pendingFollowRequestsSent?.includes(targetUserId));

      if (isFollowing) {
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', targetUserId);

        if (error) {
          throw error;
        }

        await refreshUsers();
        setCurrentUserCache(getUsersCache().find((item) => item.id === currentUserId) || getCurrentUserCache());
        return 'unfollowed';
      }

      if (hasPendingRequest) {
        return 'requested';
      }

      const shouldRequest = targetUser?.isPublicAccount === false;

      await runOptimisticMutation(
        () => {
          setUsersCache(
            getUsersCache().map((item) => {
              if (item.id === currentUserId) {
                const nextFollowing = new Set(item.following || []);
                const nextPendingSent = new Set(item.pendingFollowRequestsSent || []);

                if (isFollowing) {
                  nextFollowing.delete(targetUserId);
                } else if (shouldRequest) {
                  nextPendingSent.add(targetUserId);
                } else {
                  nextFollowing.add(targetUserId);
                }

                return {
                  ...item,
                  following: nextFollowing.size ? Array.from(nextFollowing) : undefined,
                  pendingFollowRequestsSent: nextPendingSent.size ? Array.from(nextPendingSent) : undefined,
                };
              }

              if (item.id === targetUserId) {
                const nextFollowers = new Set(item.followers || []);
                const nextPendingReceived = new Set(item.pendingFollowRequestsReceived || []);

                if (isFollowing) {
                  nextFollowers.delete(currentUserId);
                } else if (shouldRequest) {
                  nextPendingReceived.add(currentUserId);
                } else {
                  nextFollowers.add(currentUserId);
                }

                return {
                  ...item,
                  followers: nextFollowers.size ? Array.from(nextFollowers) : undefined,
                  pendingFollowRequestsReceived: nextPendingReceived.size ? Array.from(nextPendingReceived) : undefined,
                };
              }

              return item;
            }),
          );
        },
        async () => {
          if (isFollowing) {
            const { error } = await supabase
              .from('user_follows')
              .delete()
              .eq('follower_id', currentUserId)
              .eq('following_id', targetUserId);

            if (error) {
              throw error;
            }

            await refreshUsers();
            return;
          }

          if (shouldRequest) {
            const { error } = await supabase.from('follow_requests').insert({
              requester_id: currentUserId,
              target_user_id: targetUserId,
              status: 'pending',
            });

            if (error) {
              if (error.code === '23505') {
                await refreshUsers();
                return;
              }

              throw error;
            }
          } else {
            const { error } = await supabase.from('user_follows').insert({
              follower_id: currentUserId,
              following_id: targetUserId,
            });

            if (error) {
              throw error;
            }
          }

          await refreshUsers();
        },
        async () => {
          await refreshUsers().catch(() => undefined);
        },
      );

      setCurrentUserCache(getUsersCache().find((item) => item.id === currentUserId) || getCurrentUserCache());
      return isFollowing ? 'unfollowed' : shouldRequest ? 'requested' : 'following';
    },

    async blockUser(currentUserId: string, targetUserId: string): Promise<void> {
      if (currentUserId === targetUserId) {
        throw new Error('Kendi hesabini engelleyemezsin.');
      }

      await runOptimisticMutation(
        () => {
          const blockRowsCache = getBlockRowsCache();
          const alreadyBlocked = blockRowsCache.some(
            (row) => row.blocker_user_id === currentUserId && row.blocked_user_id === targetUserId,
          );

          if (!alreadyBlocked) {
            setBlockRowsCache([
              {
                blocker_user_id: currentUserId,
                blocked_user_id: targetUserId,
                created_at: new Date().toISOString(),
              },
              ...blockRowsCache,
            ]);
          }

          setUsersCache(
            getUsersCache().map((item) => {
              if (item.id === currentUserId) {
                const nextBlocked = new Set(item.blockedUsers || []);
                nextBlocked.add(targetUserId);
                return {
                  ...item,
                  blockedUsers: Array.from(nextBlocked),
                };
              }

              if (item.id === targetUserId) {
                const nextBlockedBy = new Set(item.blockedByUsers || []);
                nextBlockedBy.add(currentUserId);
                return {
                  ...item,
                  blockedByUsers: Array.from(nextBlockedBy),
                };
              }

              return item;
            }),
          );
        },
        async () => {
          const { error } = await supabase.from('user_blocks').upsert(
            {
              blocker_user_id: currentUserId,
              blocked_user_id: targetUserId,
              created_at: new Date().toISOString(),
            },
            { onConflict: 'blocker_user_id,blocked_user_id' },
          );

          if (error) {
            throw error;
          }

          await refreshUsers();
          await refreshLists(getCurrentUserCache()?.id || currentUserId);
        },
        async () => {
          await Promise.all([
            refreshUsers().catch(() => undefined),
            refreshLists(getCurrentUserCache()?.id || currentUserId).catch(() => undefined),
          ]);
        },
      );

      setCurrentUserCache(getUsersCache().find((item) => item.id === currentUserId) || getCurrentUserCache());
    },

    async unblockUser(currentUserId: string, targetUserId: string): Promise<void> {
      await runOptimisticMutation(
        () => {
          setBlockRowsCache(
            getBlockRowsCache().filter(
              (row) => !(row.blocker_user_id === currentUserId && row.blocked_user_id === targetUserId),
            ),
          );

          setUsersCache(
            getUsersCache().map((item) => {
              if (item.id === currentUserId) {
                return {
                  ...item,
                  blockedUsers: (item.blockedUsers || []).filter((userId) => userId !== targetUserId),
                };
              }

              if (item.id === targetUserId) {
                return {
                  ...item,
                  blockedByUsers: (item.blockedByUsers || []).filter((userId) => userId !== currentUserId),
                };
              }

              return item;
            }),
          );
        },
        async () => {
          const { error } = await supabase
            .from('user_blocks')
            .delete()
            .eq('blocker_user_id', currentUserId)
            .eq('blocked_user_id', targetUserId);

          if (error) {
            throw error;
          }

          await refreshUsers();
          await refreshLists(getCurrentUserCache()?.id || currentUserId);
        },
        async () => {
          await Promise.all([
            refreshUsers().catch(() => undefined),
            refreshLists(getCurrentUserCache()?.id || currentUserId).catch(() => undefined),
          ]);
        },
      );

      setCurrentUserCache(getUsersCache().find((item) => item.id === currentUserId) || getCurrentUserCache());
    },

    async respondToFollowRequest(
      requestId: string,
      decision: 'accept' | 'reject',
    ): Promise<'accepted' | 'rejected'> {
      const { data, error } = await supabase.rpc('respond_to_follow_request', {
        input_request_id: requestId,
        input_decision: decision,
      });

      if (error) {
        throw error;
      }

      await refreshUsers();
      if (getCurrentUserCache()) {
        setCurrentUserCache(
          getUsersCache().find((item) => item.id === getCurrentUserCache()?.id) || getCurrentUserCache(),
        );
      }

      return data === 'accepted' ? 'accepted' : 'rejected';
    },
  };
}
