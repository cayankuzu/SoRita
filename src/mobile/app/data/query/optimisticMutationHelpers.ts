import { type QueryClient, useQueryClient } from '@tanstack/react-query';

import {
  restoreQueries,
  snapshotQueries,
  type QuerySnapshot,
} from '@/mobile/app/data/query/optimisticSocialCache';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';

const visibleReadModelRoots = [
  queryKeys.visibleData.all,
  queryKeys.feed.all,
  queryKeys.explore.all,
  queryKeys.profile.all,
  queryKeys.list.all,
  queryKeys.map.all,
] as const;

function snapshotVisibleReadModels(queryClient: QueryClient) {
  return visibleReadModelRoots.flatMap((queryKey) => snapshotQueries(queryClient, queryKey));
}

function cancelVisibleReadModels(queryClient: QueryClient) {
  return Promise.all(
    visibleReadModelRoots.map((queryKey) => queryClient.cancelQueries({ queryKey })),
  );
}

/**
 * Shared hook for invalidating the visible data cache after mutations.
 */
export function useInvalidateVisibleData() {
  const queryClient = useQueryClient();
  return () => Promise.all(
    visibleReadModelRoots.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

/**
 * Shared hook for invalidating the place comments cache.
 */
export function useInvalidatePlaceComments() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.placeComments.all });
}

/**
 * Builds optimistic mutation callbacks for mutations targeting the visible data cache only.
 * Eliminates repetition of the cancel → snapshot → apply → restore pattern.
 */
export function buildOptimisticMutation<TInput>(
  queryClient: QueryClient,
  applyOptimistic: (queryClient: QueryClient, input: TInput) => void,
) {
  return {
    onMutate: async (input: TInput) => {
      const cancellation = cancelVisibleReadModels(queryClient);
      const snapshot = snapshotVisibleReadModels(queryClient);
      applyOptimistic(queryClient, input);
      await cancellation;
      return { snapshot };
    },
    onError: (_error: unknown, _input: TInput, context?: { snapshot?: QuerySnapshot }) => {
      restoreQueries(queryClient, context?.snapshot);
    },
  };
}

/**
 * Builds optimistic mutation callbacks for mutations targeting both
 * visible data and place comments caches (e.g., comment CRUD, comment likes).
 */
export function buildDualOptimisticMutation<TInput>(
  queryClient: QueryClient,
  applyOptimistic: (queryClient: QueryClient, input: TInput) => void,
) {
  return {
    onMutate: async (input: TInput) => {
      const cancellation = Promise.all([
        cancelVisibleReadModels(queryClient),
        queryClient.cancelQueries({ queryKey: queryKeys.placeComments.all }),
      ]);
      const visibleSnapshot = snapshotVisibleReadModels(queryClient);
      const commentsSnapshot = snapshotQueries(queryClient, queryKeys.placeComments.all);
      applyOptimistic(queryClient, input);
      await cancellation;
      return { visibleSnapshot, commentsSnapshot };
    },
    onError: (
      _error: unknown,
      _input: TInput,
      context?: { visibleSnapshot?: QuerySnapshot; commentsSnapshot?: QuerySnapshot },
    ) => {
      restoreQueries(queryClient, context?.visibleSnapshot);
      restoreQueries(queryClient, context?.commentsSnapshot);
    },
  };
}
