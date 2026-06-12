import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { User } from '@/mobile/app/data/contracts/entities';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import {
  applyOptimisticBlock,
  applyOptimisticFollow,
  applyOptimisticUserProfile,
  applyOptimisticUnblock,
  inferOptimisticFollowResult,
  restoreQueries,
  snapshotQueries,
  socialMutationScope,
} from '@/mobile/app/data/query/optimisticSocialCache';
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

function useInvalidateVisibleData() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: queryKeys.visibleData.all });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();

  return useMutation({
    mutationFn: (user: User) => updateUser(user),
    onMutate: async (user) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.visibleData.all });
      const snapshot = snapshotQueries(queryClient, queryKeys.visibleData.all);
      applyOptimisticUserProfile(queryClient, user);
      return { snapshot };
    },
    onError: (_error, _user, context) => {
      restoreQueries(queryClient, context?.snapshot);
    },
    onSettled: invalidateVisibleData,
  });
}

export function useFollowUserMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();

  return useMutation({
    scope: socialMutationScope,
    mutationFn: (input: { currentUserId: string; targetUserId: string }) =>
      followUser(input.currentUserId, input.targetUserId),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.visibleData.all });
      const snapshot = snapshotQueries(queryClient, queryKeys.visibleData.all);
      const optimisticResult = inferOptimisticFollowResult(queryClient, input);
      applyOptimisticFollow(queryClient, input, optimisticResult);

      return { snapshot };
    },
    onSuccess: (result, input) => {
      applyOptimisticFollow(queryClient, input, result);
    },
    onError: (_error, _input, context) => {
      restoreQueries(queryClient, context?.snapshot);
    },
    onSettled: invalidateVisibleData,
  });
}

export function useBlockUserMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();

  return useMutation({
    scope: socialMutationScope,
    mutationFn: (input: { currentUserId: string; targetUserId: string }) =>
      blockUser(input.currentUserId, input.targetUserId),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.visibleData.all });
      const snapshot = snapshotQueries(queryClient, queryKeys.visibleData.all);
      applyOptimisticBlock(queryClient, input);
      return { snapshot };
    },
    onError: (_error, _input, context) => {
      restoreQueries(queryClient, context?.snapshot);
    },
    onSettled: invalidateVisibleData,
  });
}

export function useUnblockUserMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();

  return useMutation({
    scope: socialMutationScope,
    mutationFn: (input: { currentUserId: string; targetUserId: string }) =>
      unblockUser(input.currentUserId, input.targetUserId),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.visibleData.all });
      const snapshot = snapshotQueries(queryClient, queryKeys.visibleData.all);
      applyOptimisticUnblock(queryClient, input);
      return { snapshot };
    },
    onError: (_error, _input, context) => {
      restoreQueries(queryClient, context?.snapshot);
    },
    onSettled: invalidateVisibleData,
  });
}

export function useReportUserMutation() {
  return useMutation({
    mutationFn: (input: { reporterUserId: string; targetUserId: string; reason: string }) =>
      reportUser(input.reporterUserId, input.targetUserId, input.reason),
  });
}

export function useDeleteCurrentUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCurrentUser,
    onSuccess: () => queryClient.clear(),
  });
}
