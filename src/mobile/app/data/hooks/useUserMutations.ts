import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { User } from '@/mobile/app/data/contracts/entities';
import {
  applyOptimisticBlock,
  applyOptimisticExploreFollow,
  applyOptimisticFollow,
  applyOptimisticUserProfile,
  applyOptimisticUnblock,
  inferOptimisticFollowResult,
  socialMutationScope,
  type QuerySnapshot,
} from '@/mobile/app/data/query/optimisticSocialCache';
import {
  buildOptimisticMutation,
  useInvalidateVisibleData,
} from '@/mobile/app/data/query/optimisticMutationHelpers';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import { snapshotQueries, restoreQueries } from '@/mobile/app/data/query/optimisticSocialCache';
import {
  blockUser,
  deleteCurrentUser,
  followUser,
  type FollowStateResult,
  reportUser,
  unblockUser,
  updateUser,
} from '@/mobile/app/data/repositories/usersRepository';

export type { FollowStateResult };

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();

  return useMutation({
    mutationFn: (user: User) => updateUser(user),
    ...buildOptimisticMutation(queryClient, applyOptimisticUserProfile),
    onSettled: invalidateVisibleData,
  });
}

export function useFollowUserMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();

  type FollowInput = { currentUserId: string; targetUserId: string };

  return useMutation({
    scope: socialMutationScope,
    mutationFn: (input: FollowInput) =>
      followUser(input.currentUserId, input.targetUserId),
    onMutate: async (input: FollowInput) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.visibleData.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.explore.all }),
      ]);
      const snapshot = snapshotQueries(queryClient, queryKeys.visibleData.all);
      const exploreSnapshot = snapshotQueries(queryClient, queryKeys.explore.all);
      const optimisticResult = inferOptimisticFollowResult(queryClient, input);
      applyOptimisticFollow(queryClient, input, optimisticResult);
      applyOptimisticExploreFollow(queryClient, input, optimisticResult);
      return { exploreSnapshot, snapshot };
    },
    onSuccess: (result: FollowStateResult, input: FollowInput) => {
      applyOptimisticFollow(queryClient, input, result);
      applyOptimisticExploreFollow(queryClient, input, result);
    },
    onError: (
      _error: unknown,
      _input: FollowInput,
      context?: { exploreSnapshot?: QuerySnapshot; snapshot?: QuerySnapshot },
    ) => {
      restoreQueries(queryClient, context?.snapshot);
      restoreQueries(queryClient, context?.exploreSnapshot);
    },
    onSettled: async () => {
      await Promise.all([
        invalidateVisibleData(),
        queryClient.invalidateQueries({ queryKey: queryKeys.explore.all }),
      ]);
    },
  });
}

export function useBlockUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    scope: socialMutationScope,
    mutationFn: (input: { currentUserId: string; targetUserId: string }) =>
      blockUser(input.currentUserId, input.targetUserId),
    onMutate: async (input: { currentUserId: string; targetUserId: string }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.visibleData.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.notifications.all }),
      ]);
      const visibleSnapshot = snapshotQueries(queryClient, queryKeys.visibleData.all);
      const notificationsSnapshot = snapshotQueries(queryClient, queryKeys.notifications.all);
      applyOptimisticBlock(queryClient, input);
      return { notificationsSnapshot, visibleSnapshot };
    },
    onError: (
      _error: unknown,
      _input: { currentUserId: string; targetUserId: string },
      context?: { notificationsSnapshot?: QuerySnapshot; visibleSnapshot?: QuerySnapshot },
    ) => {
      restoreQueries(queryClient, context?.visibleSnapshot);
      restoreQueries(queryClient, context?.notificationsSnapshot);
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.visibleData.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.placeComments.all }),
      ]);
    },
  });
}

export function useUnblockUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    scope: socialMutationScope,
    mutationFn: (input: { currentUserId: string; targetUserId: string }) =>
      unblockUser(input.currentUserId, input.targetUserId),
    ...buildOptimisticMutation(queryClient, applyOptimisticUnblock),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.visibleData.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.placeComments.all }),
      ]);
    },
  });
}

export function useReportUserMutation() {
  return useMutation({
    mutationFn: (input: { reporterUserId: string; targetUserId: string; reason: string; details?: string }) =>
      reportUser(input.reporterUserId, input.targetUserId, input.reason, input.details),
  });
}

export function useDeleteCurrentUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCurrentUser,
    onSuccess: () => queryClient.clear(),
  });
}
