import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import {
  applyOptimisticCommentCreate,
  applyOptimisticCommentDelete,
  applyOptimisticCommentLike,
  applyOptimisticCommentUpdate,
  applyOptimisticPlaceDelete,
  applyOptimisticPlaceLike,
  restoreQueries,
  snapshotQueries,
  socialMutationScope,
} from '@/mobile/app/data/query/optimisticSocialCache';
import {
  createPlaceComment,
  deletePlace,
  deletePlaceComment,
  reportPlace,
  reportPlaceComment,
  toggleLikePlace,
  toggleLikePlaceComment,
  updatePlaceComment,
} from '@/mobile/app/data/repositories/placesRepository';
import { createUuid } from '@/shared/utils/id';

function useInvalidateVisibleData() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: queryKeys.visibleData.all });
}

function useInvalidatePlaceComments() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: queryKeys.placeComments.all });
}

export function useDeletePlaceMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();

  return useMutation({
    mutationFn: (placeId: string) => deletePlace(placeId),
    onMutate: async (placeId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.visibleData.all });
      const snapshot = snapshotQueries(queryClient, queryKeys.visibleData.all);
      applyOptimisticPlaceDelete(queryClient, placeId);
      return { snapshot };
    },
    onError: (_error, _placeId, context) => {
      restoreQueries(queryClient, context?.snapshot);
    },
    onSettled: invalidateVisibleData,
  });
}

export function useToggleLikePlaceMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();

  return useMutation({
    scope: socialMutationScope,
    mutationFn: (input: { placeId: string; userId: string }) =>
      toggleLikePlace(input.placeId, input.userId),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.visibleData.all });
      const snapshot = snapshotQueries(queryClient, queryKeys.visibleData.all);
      applyOptimisticPlaceLike(queryClient, input);
      return { snapshot };
    },
    onError: (_error, _input, context) => {
      restoreQueries(queryClient, context?.snapshot);
    },
    onSettled: invalidateVisibleData,
  });
}

export function useCreatePlaceCommentMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();
  const invalidatePlaceComments = useInvalidatePlaceComments();

  return useMutation({
    scope: socialMutationScope,
    mutationFn: (input: {
      placeId: string;
      userId: string;
      content: string;
      parentCommentId?: string | null;
    }) =>
      createPlaceComment(
        input.placeId,
        input.userId,
        input.content,
        input.parentCommentId,
      ),
    onMutate: async (input) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.visibleData.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.placeComments.all }),
      ]);
      const visibleSnapshot = snapshotQueries(queryClient, queryKeys.visibleData.all);
      const commentsSnapshot = snapshotQueries(queryClient, queryKeys.placeComments.all);
      applyOptimisticCommentCreate(queryClient, {
        ...input,
        commentId: createUuid(),
        content: input.content.trim(),
      });
      return { commentsSnapshot, visibleSnapshot };
    },
    onError: (_error, _input, context) => {
      restoreQueries(queryClient, context?.visibleSnapshot);
      restoreQueries(queryClient, context?.commentsSnapshot);
    },
    onSettled: () => {
      void invalidateVisibleData();
      void invalidatePlaceComments();
    },
  });
}

export function useUpdatePlaceCommentMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();
  const invalidatePlaceComments = useInvalidatePlaceComments();

  return useMutation({
    scope: socialMutationScope,
    mutationFn: (input: { commentId: string; userId: string; content: string }) =>
      updatePlaceComment(input.commentId, input.userId, input.content),
    onMutate: async (input) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.visibleData.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.placeComments.all }),
      ]);
      const visibleSnapshot = snapshotQueries(queryClient, queryKeys.visibleData.all);
      const commentsSnapshot = snapshotQueries(queryClient, queryKeys.placeComments.all);
      applyOptimisticCommentUpdate(queryClient, {
        commentId: input.commentId,
        content: input.content.trim(),
      });
      return { commentsSnapshot, visibleSnapshot };
    },
    onError: (_error, _input, context) => {
      restoreQueries(queryClient, context?.visibleSnapshot);
      restoreQueries(queryClient, context?.commentsSnapshot);
    },
    onSettled: () => {
      void invalidateVisibleData();
      void invalidatePlaceComments();
    },
  });
}

export function useDeletePlaceCommentMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();
  const invalidatePlaceComments = useInvalidatePlaceComments();

  return useMutation({
    scope: socialMutationScope,
    mutationFn: (commentId: string) => deletePlaceComment(commentId),
    onMutate: async (commentId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.visibleData.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.placeComments.all }),
      ]);
      const visibleSnapshot = snapshotQueries(queryClient, queryKeys.visibleData.all);
      const commentsSnapshot = snapshotQueries(queryClient, queryKeys.placeComments.all);
      applyOptimisticCommentDelete(queryClient, commentId);
      return { commentsSnapshot, visibleSnapshot };
    },
    onError: (_error, _input, context) => {
      restoreQueries(queryClient, context?.visibleSnapshot);
      restoreQueries(queryClient, context?.commentsSnapshot);
    },
    onSettled: () => {
      void invalidateVisibleData();
      void invalidatePlaceComments();
    },
  });
}

export function useToggleLikePlaceCommentMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();
  const invalidatePlaceComments = useInvalidatePlaceComments();

  return useMutation({
    scope: socialMutationScope,
    mutationFn: (input: { commentId: string; userId: string }) =>
      toggleLikePlaceComment(input.commentId, input.userId),
    onMutate: async (input) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.visibleData.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.placeComments.all }),
      ]);
      const visibleSnapshot = snapshotQueries(queryClient, queryKeys.visibleData.all);
      const commentsSnapshot = snapshotQueries(queryClient, queryKeys.placeComments.all);
      applyOptimisticCommentLike(queryClient, input);
      return { commentsSnapshot, visibleSnapshot };
    },
    onError: (_error, _input, context) => {
      restoreQueries(queryClient, context?.visibleSnapshot);
      restoreQueries(queryClient, context?.commentsSnapshot);
    },
    onSettled: () => {
      void invalidateVisibleData();
      void invalidatePlaceComments();
    },
  });
}

export function useReportPlaceMutation() {
  return useMutation({
    mutationFn: (input: { reporterUserId: string; placeId: string; reason: string }) =>
      reportPlace(input.reporterUserId, input.placeId, input.reason),
  });
}

export function useReportPlaceCommentMutation() {
  return useMutation({
    mutationFn: (input: { commentId: string; reporterUserId: string; reason: string }) =>
      reportPlaceComment(input.commentId, input.reporterUserId, input.reason),
  });
}
