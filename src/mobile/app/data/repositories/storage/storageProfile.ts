import type { User } from '@/mobile/app/data/contracts/entities';
import { upsertUserInCache } from '@/mobile/app/data/repositories/storage/storageCacheMutations';
import { uniqueStrings } from '@/mobile/app/data/repositories/storage/storageUtils';

type RunOptimisticMutation = <T>(
  applyOptimistic: () => void,
  task: () => Promise<T>,
  onError?: (error: unknown) => Promise<void> | void,
) => Promise<T>;

type StorageProfileDependencies = {
  supabase: typeof import('@/mobile/app/platform/supabase/client').supabase;
  getUsersCache: () => User[];
  setUsersCache: (users: User[]) => void;
  getCurrentUserCache: () => User | null;
  setCurrentUserCache: (user: User | null) => void;
  runOptimisticMutation: RunOptimisticMutation;
  refreshUsers: () => Promise<void>;
  refreshLists: (currentUserId?: string) => Promise<void>;
  uploadUserMedia: (userId: string, profilePhoto?: string, coverPhoto?: string) => Promise<{
    profilePhoto?: string;
    coverPhoto?: string;
  }>;
  deleteUnreferencedProfileMediaUrls: (urls: string[]) => Promise<void>;
};

export function createStorageProfileRepository({
  supabase,
  getUsersCache,
  setUsersCache,
  getCurrentUserCache,
  setCurrentUserCache,
  runOptimisticMutation,
  refreshUsers,
  refreshLists,
  uploadUserMedia,
  deleteUnreferencedProfileMediaUrls,
}: StorageProfileDependencies) {
  return {
    async updateUser(user: User): Promise<User> {
      const previousUser = getUsersCache().find((item) => item.id === user.id);
      const optimisticUser: User = {
        ...user,
        username: user.username.toLowerCase(),
        interests: user.interests?.length ? uniqueStrings(user.interests) : undefined,
      };

      await runOptimisticMutation(
        () => {
          setUsersCache(upsertUserInCache(getUsersCache(), optimisticUser));

          if (getCurrentUserCache()?.id === optimisticUser.id) {
            setCurrentUserCache(optimisticUser);
          }
        },
        async () => {
          const nextMedia = await uploadUserMedia(user.id, user.profilePhoto, user.coverPhoto);

          const { error } = await supabase
            .from('profiles')
            .update({
              name: user.name,
              username: user.username.toLowerCase(),
              is_public_account: user.isPublicAccount ?? true,
              bio: user.bio || null,
              interests: user.interests?.length ? uniqueStrings(user.interests) : null,
              profile_photo_url: nextMedia.profilePhoto || null,
              cover_photo_url: nextMedia.coverPhoto || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

          if (error) {
            throw error;
          }

          const obsoleteProfileMedia = [
            previousUser?.profilePhoto && previousUser.profilePhoto !== nextMedia.profilePhoto
              ? previousUser.profilePhoto
              : undefined,
            previousUser?.coverPhoto && previousUser.coverPhoto !== nextMedia.coverPhoto
              ? previousUser.coverPhoto
              : undefined,
          ].filter((value): value is string => Boolean(value));

          if (obsoleteProfileMedia.length) {
            await deleteUnreferencedProfileMediaUrls(obsoleteProfileMedia);
          }

          await refreshUsers();
          await refreshLists(user.id);
        },
        async () => {
          await Promise.all([
            refreshUsers().catch(() => undefined),
            refreshLists(user.id).catch(() => undefined),
          ]);
        },
      );

      const nextUser = getUsersCache().find((item) => item.id === user.id) || optimisticUser;

      if (getCurrentUserCache()?.id === nextUser.id) {
        setCurrentUserCache(nextUser);
      }

      return nextUser;
    },
  };
}
