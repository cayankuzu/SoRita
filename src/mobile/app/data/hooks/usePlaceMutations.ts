import { onlineManager, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import {
  applyOptimisticCommentCreate,
  applyOptimisticCommentDelete,
  applyOptimisticCommentLike,
  applyOptimisticCommentUpdate,
  applyOptimisticPlaceDelete,
  applyOptimisticPlaceLike,
  inferOptimisticPlaceLikeState,
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
import { shouldQueueOfflineOperation } from '@/mobile/app/data/outbox/shouldQueueOfflineOperation';

type PlaceLikeInput = { placeId: string; userId: string };

async function togglePlaceLikeOrQueue(
  queryClient: QueryClient,
  input: PlaceLikeInput,
) {
  const liked = inferOptimisticPlaceLikeState(queryClient, input);

  if (shouldQueueOfflineOperation()) {
    await enqueueDurableOutboxEntry({
      idempotencyKey: `place-like-state:${input.userId}:${input.placeId}`,
      kind: 'place-like-state',
      payloadRef: { liked, placeId: input.placeId },
      userId: input.userId,
    });
    return;
  }

  try {
    await toggleLikePlace(input.placeId, input.userId);
  } catch (error) {
    if (!shouldQueueOfflineOperation(error)) {
      throw error;
    }

    await enqueueDurableOutboxEntry({
      idempotencyKey: `place-like-state:${input.userId}:${input.placeId}`,
      kind: 'place-like-state',
      payloadRef: { liked, placeId: input.placeId },
      userId: input.userId,
    });
  }
}

export const placeMutationInternals = { togglePlaceLikeOrQueue };

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
    networkMode: 'always',
    scope: mutationScope,
    mutationFn: (input: PlaceLikeInput) => togglePlaceLikeOrQueue(queryClient, input),
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
    networkMode: 'always',
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
        }).then(() => undefined);
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
    networkMode: 'always',
    mutationFn: (input: { reporterUserId: string; placeId: string; reason: string; details?: string }) =>
      reportPlace(input.reporterUserId, input.placeId, input.reason, input.details),
  });
}

export function useReportPlaceCommentMutation() {
  return useMutation({
    mutationKey: ['place-comment', 'report'],
    networkMode: 'always',
    mutationFn: (input: { commentId: string; reporterUserId: string; reason: string; details?: string }) =>
      reportPlaceComment(input.commentId, input.reporterUserId, input.reason, input.details),
  });
}
