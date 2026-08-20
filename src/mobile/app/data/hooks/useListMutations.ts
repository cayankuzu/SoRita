import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import {
  applyOptimisticListCreate,
  applyOptimisticListDelete,
  applyOptimisticListsUpdate,
  applyOptimisticListUpdate,
} from '@/mobile/app/data/query/optimisticSocialCache';
import {
  buildOptimisticMutation,
  useInvalidateVisibleData,
} from '@/mobile/app/data/query/optimisticMutationHelpers';
import {
  createList,
  deleteList,
  reportList,
  updateList,
  updateLists,
} from '@/mobile/app/data/repositories/listsRepository';
import { enqueueDurableOutboxEntry } from '@/mobile/app/data/outbox/enqueueDurableOutboxEntry';
import type { JsonValue } from '@/mobile/app/data/outbox/outboxStorage';
import {
  readOperationErrorStatus,
  shouldQueueOfflineOperation,
} from '@/mobile/app/data/outbox/shouldQueueOfflineOperation';
import { useMutationScope } from '@/mobile/app/data/hooks/useMutationScope';

type UpdateListsMutationInput = {
  lists: PlaceList[];
  previousLists?: PlaceList[];
  onProgress?: (progress: number) => void;
  abortSignal?: AbortSignal;
};

type UpdateListMutationInput = PlaceList | {
  list: PlaceList;
  previousList?: PlaceList | null;
};

function normalizeUpdateListMutationInput(input: UpdateListMutationInput) {
  return 'list' in input ? input : { list: input };
}

function normalizeUpdateListsMutationInput(
  input: PlaceList[] | UpdateListsMutationInput,
): UpdateListsMutationInput {
  return Array.isArray(input) ? { lists: input } : input;
}

const readMutationStatus = readOperationErrorStatus;
const shouldQueueListsUpdate = shouldQueueOfflineOperation;

async function updateListsOrQueue(input: UpdateListsMutationInput) {
  try {
    await updateLists(
      input.lists,
      input.onProgress,
      input.abortSignal,
      input.previousLists,
    );
  } catch (error) {
    const userId = input.lists[0]?.userId;

    if (!userId || !shouldQueueListsUpdate(error)) {
      throw error;
    }

    const payload = JSON.parse(JSON.stringify({ lists: input.lists })) as JsonValue;
    await enqueueDurableOutboxEntry({
      idempotencyKey: `lists-update:${input.lists.map((list) => list.id).sort().join(',')}`,
      kind: 'lists-update',
      payloadRef: payload,
      userId,
    });
  }
}

export const listMutationInternals = {
  normalizeUpdateListMutationInput,
  normalizeUpdateListsMutationInput,
  readMutationStatus,
  shouldQueueListsUpdate,
  updateListsOrQueue,
};

export function useCreateListMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();
  const mutationScope = useMutationScope('list-create');

  return useMutation({
    mutationKey: ['lists', 'create'],
    scope: mutationScope,
    mutationFn: (list: PlaceList) => createList(list),
    ...buildOptimisticMutation(queryClient, applyOptimisticListCreate),
    onSettled: invalidateVisibleData,
  });
}

export function useUpdateListMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();
  const mutationScope = useMutationScope('list-update');

  return useMutation({
    mutationKey: ['lists', 'update'],
    scope: mutationScope,
    mutationFn: (input: UpdateListMutationInput) => {
      const { list, previousList } = normalizeUpdateListMutationInput(input);
      return updateList(list, previousList);
    },
    ...buildOptimisticMutation<UpdateListMutationInput>(queryClient, (qc, input) =>
      applyOptimisticListUpdate(qc, normalizeUpdateListMutationInput(input).list),
    ),
    onSettled: invalidateVisibleData,
  });
}

export function useUpdateListsMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();
  const mutationScope = useMutationScope('lists-update');

  const mutation = useMutation({
    mutationKey: ['lists', 'update-many'],
    networkMode: 'always',
    scope: mutationScope,
    mutationFn: updateListsOrQueue,
    ...buildOptimisticMutation<UpdateListsMutationInput>(queryClient, (qc, input) =>
      applyOptimisticListsUpdate(qc, input.lists),
    ),
    onSettled: invalidateVisibleData,
  });

  const mutateAsync = useCallback(
    (input: PlaceList[] | UpdateListsMutationInput, options?: Parameters<typeof mutation.mutateAsync>[1]) =>
      mutation.mutateAsync(normalizeUpdateListsMutationInput(input), options),
    [mutation],
  );

  const mutate = useCallback(
    (input: PlaceList[] | UpdateListsMutationInput, options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate(normalizeUpdateListsMutationInput(input), options),
    [mutation],
  );

  return { ...mutation, mutate, mutateAsync };
}

export function useDeleteListMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();
  const mutationScope = useMutationScope('list-delete');

  return useMutation({
    mutationKey: ['lists', 'delete'],
    scope: mutationScope,
    mutationFn: (listId: string) => deleteList(listId),
    ...buildOptimisticMutation(queryClient, applyOptimisticListDelete),
    onSettled: invalidateVisibleData,
  });
}

export function useReportListMutation() {
  return useMutation({
    mutationKey: ['lists', 'report'],
    networkMode: 'always',
    mutationFn: (input: { reporterUserId: string; listId: string; reason: string; details?: string }) =>
      reportList(input.reporterUserId, input.listId, input.reason, input.details),
  });
}
