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

const listMutationScope = { id: 'list-write-queue' } as const;

type UpdateListsMutationInput = {
  lists: PlaceList[];
  onProgress?: (progress: number) => void;
  abortSignal?: AbortSignal;
};

function normalizeUpdateListsMutationInput(
  input: PlaceList[] | UpdateListsMutationInput,
): UpdateListsMutationInput {
  return Array.isArray(input) ? { lists: input } : input;
}

export function useCreateListMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();

  return useMutation({
    mutationKey: ['lists', 'create'],
    scope: listMutationScope,
    mutationFn: (list: PlaceList) => createList(list),
    ...buildOptimisticMutation(queryClient, applyOptimisticListCreate),
    onSettled: invalidateVisibleData,
  });
}

export function useUpdateListMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();

  return useMutation({
    mutationKey: ['lists', 'update'],
    scope: listMutationScope,
    mutationFn: (list: PlaceList) => updateList(list),
    ...buildOptimisticMutation(queryClient, applyOptimisticListUpdate),
    onSettled: invalidateVisibleData,
  });
}

export function useUpdateListsMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();

  const mutation = useMutation({
    mutationKey: ['lists', 'update-many'],
    scope: listMutationScope,
    mutationFn: (input: UpdateListsMutationInput) =>
      updateLists(input.lists, input.onProgress, input.abortSignal),
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

  return useMutation({
    mutationKey: ['lists', 'delete'],
    scope: listMutationScope,
    mutationFn: (listId: string) => deleteList(listId),
    ...buildOptimisticMutation(queryClient, applyOptimisticListDelete),
    onSettled: invalidateVisibleData,
  });
}

export function useReportListMutation() {
  return useMutation({
    mutationKey: ['lists', 'report'],
    mutationFn: (input: { reporterUserId: string; listId: string; reason: string; details?: string }) =>
      reportList(input.reporterUserId, input.listId, input.reason, input.details),
  });
}
