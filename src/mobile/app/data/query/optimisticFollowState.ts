import type { QueryClient } from '@tanstack/react-query';

import type { User } from '@/mobile/app/data/contracts/entities';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';

export type FollowStateResult = 'following' | 'requested' | 'unfollowed';

type VisibleUserData = {
  allUsers: User[];
  currentUser: User | null;
};

function isVisibleUserData(value: unknown): value is VisibleUserData {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'allUsers' in value &&
    Array.isArray(value.allUsers) &&
    'currentUser' in value,
  );
}

export function inferOptimisticFollowResult(
  queryClient: QueryClient,
  input: { currentUserId: string; targetUserId: string },
): FollowStateResult {
  const visibleQueries = queryClient.getQueriesData({ queryKey: queryKeys.visibleData.all });

  for (const [, data] of visibleQueries) {
    if (!isVisibleUserData(data)) {
      continue;
    }

    const currentUser = data.currentUser?.id === input.currentUserId
      ? data.currentUser
      : data.allUsers.find((item) => item.id === input.currentUserId);
    const targetUser = data.allUsers.find((item) => item.id === input.targetUserId);

    if ((currentUser?.following || []).includes(input.targetUserId)) {
      return 'unfollowed';
    }

    if (
      (currentUser?.pendingFollowRequestsSent || []).includes(input.targetUserId) ||
      targetUser?.isPublicAccount === false
    ) {
      return 'requested';
    }
  }

  return 'following';
}

export function readOptimisticFollowState(
  queryClient: QueryClient,
  input: { currentUserId: string; targetUserId: string },
): FollowStateResult | null {
  const visibleQueries = queryClient.getQueriesData({ queryKey: queryKeys.visibleData.all });

  for (const [, data] of visibleQueries) {
    if (!isVisibleUserData(data)) {
      continue;
    }

    const currentUser = data.currentUser?.id === input.currentUserId
      ? data.currentUser
      : data.allUsers.find((item) => item.id === input.currentUserId);

    if ((currentUser?.following || []).includes(input.targetUserId)) {
      return 'following';
    }

    if ((currentUser?.pendingFollowRequestsSent || []).includes(input.targetUserId)) {
      return 'requested';
    }

    return 'unfollowed';
  }

  return null;
}
