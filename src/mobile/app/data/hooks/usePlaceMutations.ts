import { onlineManager, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  applyOptimisticCommentCreate,
  applyOptimisticCommentDelete,
  applyOptimisticCommentLike,
  applyOptimisticCommentUpdate,
  applyOptimisticPlaceDelete,
  applyOptimisticPlaceLike,
} from '@/mobile/app/data/query/optimisticSocialCache';
import { useMutationScope } from '@/mobile/app/data/hooks/useMutationScope';
import {
  buildDualOptimisticMutation,
  buildOptimisticMutation,
  useInvalidatePlaceComments,
  useInvalidateVisibleData,
} from '@/mobile/app/data/query/optimisticMutationHelpers';
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
import { enqueueDurableOutboxEntry } from '@/mobile/app/data/outbox/enqueueDurableOutboxEntry';
import { trackEvent } from '@/mobile/app/platform/analytics/analyticsEvents';

export function useDeletePlaceMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();

  return useMutation({
    mutationKey: ['place', 'delete'],
    mutationFn: (placeId: string) => deletePlace(placeId),
    ...buildOptimisticMutation(queryClient, applyOptimisticPlaceDelete),
    onSettled: invalidateVisibleData,
  });
}

export function useToggleLikePlaceMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();
  const mutationScope = useMutationScope('place-like');

  return useMutation({
    mutationKey: ['place', 'like-toggle'],
    scope: mutationScope,
    mutationFn: (input: { placeId: string; userId: string }) =>
      toggleLikePlace(input.placeId, input.userId),
    ...buildOptimisticMutation(queryClient, applyOptimisticPlaceLike),
    onSettled: invalidateVisibleData,
  });
}

export function useCreatePlaceCommentMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();
  const invalidatePlaceComments = useInvalidatePlaceComments();
  const mutationScope = useMutationScope('comment-create');

  return useMutation({
    mutationKey: ['place-comment', 'create'],
    scope: mutationScope,
    mutationFn: (input: {
      commentId: string;
      placeId: string;
      userId: string;
      content: string;
      parentCommentId?: string | null;
    }) => {
      if (!onlineManager.isOnline()) {
        return enqueueDurableOutboxEntry({
          idempotencyKey: `comment-create:${input.commentId}`,
          kind: 'comment-create',
          payloadRef: {
            commentId: input.commentId,
            content: input.content,
            parentCommentId: input.parentCommentId ?? null,
            placeId: input.placeId,
          },
          userId: input.userId,
        }).then(() => {
          trackEvent({ name: 'outbox_enqueued', params: { operation: 'comment-create' } });
        });
      }

      return createPlaceComment(
        input.placeId,
        input.userId,
        input.content,
        input.parentCommentId,
        input.commentId,
      );
    },
    ...buildDualOptimisticMutation(queryClient, (qc, input: {
      commentId: string;
      placeId: string;
      userId: string;
      content: string;
      parentCommentId?: string | null;
    }) =>
      applyOptimisticCommentCreate(qc, {
        ...input,
        content: input.content.trim(),
      }),
    ),
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
  const mutationScope = useMutationScope('comment-update');

  return useMutation({
    mutationKey: ['place-comment', 'update'],
    scope: mutationScope,
    mutationFn: (input: { commentId: string; userId: string; content: string }) =>
      updatePlaceComment(input.commentId, input.userId, input.content),
    ...buildDualOptimisticMutation(queryClient, (qc, input: { commentId: string; content: string }) =>
      applyOptimisticCommentUpdate(qc, {
        commentId: input.commentId,
        content: input.content.trim(),
      }),
    ),
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
  const mutationScope = useMutationScope('comment-delete');

  return useMutation({
    mutationKey: ['place-comment', 'delete'],
    scope: mutationScope,
    mutationFn: (commentId: string) => deletePlaceComment(commentId),
    ...buildDualOptimisticMutation(queryClient, applyOptimisticCommentDelete),
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
  const mutationScope = useMutationScope('comment-like');

  return useMutation({
    mutationKey: ['place-comment', 'like-toggle'],
    scope: mutationScope,
    mutationFn: (input: { commentId: string; userId: string }) =>
      toggleLikePlaceComment(input.commentId, input.userId),
    ...buildDualOptimisticMutation(queryClient, applyOptimisticCommentLike),
    onSettled: () => {
      void invalidateVisibleData();
      void invalidatePlaceComments();
    },
  });
}

export function useReportPlaceMutation() {
  return useMutation({
    mutationKey: ['place', 'report'],
    mutationFn: (input: { reporterUserId: string; placeId: string; reason: string; details?: string }) =>
      reportPlace(input.reporterUserId, input.placeId, input.reason, input.details),
  });
}

export function useReportPlaceCommentMutation() {
  return useMutation({
    mutationKey: ['place-comment', 'report'],
    mutationFn: (input: { commentId: string; reporterUserId: string; reason: string; details?: string }) =>
      reportPlaceComment(input.commentId, input.reporterUserId, input.reason, input.details),
  });
}
