import { useCallback, useState } from 'react';

import type { User } from '@/mobile/app/data/contracts/entities';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { tr } from '@/mobile/app/shared/i18n/tr';

type FollowResult = 'following' | 'requested' | 'unfollowed';

type UseExploreFollowToggleParams = {
  followUser: (targetUserId: string) => Promise<FollowResult>;
  following: string[];
  people: User[];
};

// A tile follows in one tap. Unfollowing someone a search turned up asks
// first, as on their profile; it used to happen on the first tap.
export function useExploreFollowToggle({ followUser, following, people }: UseExploreFollowToggleParams) {
  const [unfollowTarget, setUnfollowTarget] = useState<User | null>(null);

  const submitFollowToggle = useCallback(
    async (targetUserId: string) => {
      try {
        const result = await followUser(targetUserId);
        showToast(
          result === 'requested'
            ? tr.explore.toast.followRequestSent
            : result === 'following'
              ? tr.explore.toast.userFollowed
              : tr.explore.toast.followUpdated,
          'success',
        );
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : tr.profile.toast.followFailed,
          'error',
        );
      }
    },
    [followUser],
  );

  const requestFollowToggle = useCallback(
    async (targetUserId: string) => {
      const person = following.includes(targetUserId)
        ? people.find((candidate) => candidate.id === targetUserId)
        : undefined;

      if (person) {
        setUnfollowTarget(person);
        return;
      }

      await submitFollowToggle(targetUserId);
    },
    [following, people, submitFollowToggle],
  );

  const confirmUnfollow = useCallback(async () => {
    const target = unfollowTarget;
    setUnfollowTarget(null);
    if (target) {
      await submitFollowToggle(target.id);
    }
  }, [submitFollowToggle, unfollowTarget]);

  const cancelUnfollow = useCallback(() => setUnfollowTarget(null), []);

  return {
    cancelUnfollow,
    confirmUnfollow,
    requestFollowToggle,
    unfollowTarget: unfollowTarget
      ? {
          isPrivateAccount: unfollowTarget.isPublicAccount === false,
          username: unfollowTarget.username,
        }
      : null,
  };
}
