import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import {
  applyOptimisticListCreate,
  applyOptimisticListDelete,
  applyOptimisticListsUpdate,
  applyOptimisticListUpdate,
  restoreQueries,
  snapshotQueries,
} from '@/mobile/app/data/query/optimisticSocialCache';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import {
  createList,
  deleteList,
  reportList,
  updateList,
  updateLists,
} from '@/mobile/app/data/repositories/listsRepository';

const listMutationScope = { id: 'list-write-queue' } as const;

function useInvalidateVisibleData() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: queryKeys.visibleData.all });
}

export function useCreateListMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();

  return useMutation({
    scope: listMutationScope,
    mutationFn: (list: PlaceList) => createList(list),
    onMutate: async (list) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.visibleData.all });
      const snapshot = snapshotQueries(queryClient, queryKeys.visibleData.all);
      applyOptimisticListCreate(queryClient, list);
      return { snapshot };
    },
    onError: (_error, _list, context) => {
      restoreQueries(queryClient, context?.snapshot);
    },
    onSettled: invalidateVisibleData,
  });
}

export function useUpdateListMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();

  return useMutation({
    scope: listMutationScope,
    mutationFn: (list: PlaceList) => updateList(list),
    onMutate: async (list) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.visibleData.all });
      const snapshot = snapshotQueries(queryClient, queryKeys.visibleData.all);
      applyOptimisticListUpdate(queryClient, list);
      return { snapshot };
    },
    onError: (_error, _list, context) => {
      restoreQueries(queryClient, context?.snapshot);
    },
    onSettled: invalidateVisibleData,
  });
}

export function useUpdateListsMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();

  return useMutation({
    scope: listMutationScope,
    mutationFn: (lists: PlaceList[]) => updateLists(lists),
    onMutate: async (lists) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.visibleData.all });
      const snapshot = snapshotQueries(queryClient, queryKeys.visibleData.all);
      applyOptimisticListsUpdate(queryClient, lists);
      return { snapshot };
    },
    onError: (_error, _lists, context) => {
      restoreQueries(queryClient, context?.snapshot);
    },
    onSettled: invalidateVisibleData,
  });
}

export function useDeleteListMutation() {
  const queryClient = useQueryClient();
  const invalidateVisibleData = useInvalidateVisibleData();

  return useMutation({
    scope: listMutationScope,
    mutationFn: (listId: string) => deleteList(listId),
    onMutate: async (listId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.visibleData.all });
      const snapshot = snapshotQueries(queryClient, queryKeys.visibleData.all);
      applyOptimisticListDelete(queryClient, listId);
      return { snapshot };
    },
    onError: (_error, _listId, context) => {
      restoreQueries(queryClient, context?.snapshot);
    },
    onSettled: invalidateVisibleData,
  });
}

export function useReportListMutation() {
  return useMutation({
    mutationFn: (input: { reporterUserId: string; listId: string; reason: string }) =>
      reportList(input.reporterUserId, input.listId, input.reason),
  });
}
