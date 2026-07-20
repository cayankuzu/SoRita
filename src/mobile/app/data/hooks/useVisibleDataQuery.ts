import { useEffect, useMemo } from 'react';
import {
  InfiniteData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { flattenPages } from '@/mobile/app/data/query/queryDataHelpers';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import { savePersistedVisibleDataSnapshot } from '@/mobile/app/data/cache/visibleDataSnapshotCache';
import {
  fetchVisibleDataContext,
  fetchVisibleListsPage,
  type VisibleDataContext,
  type VisibleDataSnapshot,
} from '@/mobile/app/data/repositories/visibleDataRepository';
import {
  DEFAULT_VISIBLE_LISTS_PAGE_SIZE,
  PUBLIC_VIEWER_ID,
  VISIBLE_DATA_STALE_TIME_MS,
} from '@/mobile/app/data/constants';
import { logger } from '@/mobile/app/platform/feedback/logger';

export type UseVisibleDataQueryOptions = {
  enabled?: boolean;
  filterToViewerNetwork?: boolean;
  includeLists?: boolean;
  includePlaceComments?: boolean;
  listId?: string;
  listPageSize?: number;
  ownerId?: string;
  publicOnly?: boolean;
};

function getViewerId(userId?: string | null) {
  return userId || PUBLIC_VIEWER_ID;
}

function resolveVisibleQueryOptions(options: UseVisibleDataQueryOptions) {
  return {
    filterToViewerNetwork: options.filterToViewerNetwork ?? false,
    includeLists: options.includeLists !== false,
    includePlaceComments: options.includePlaceComments ?? false,
    listId: options.listId,
    listPageSize: options.listPageSize || DEFAULT_VISIBLE_LISTS_PAGE_SIZE,
    ownerId: options.ownerId,
    publicOnly: options.publicOnly ?? false,
    queryEnabled: options.enabled ?? true,
  };
}

function toVisibleDataContext(snapshot?: VisibleDataSnapshot): VisibleDataContext | undefined {
  if (!snapshot) {
    return undefined;
  }

  return {
    allUsers: snapshot.allUsers,
    blockRows: snapshot.blockRows,
    currentUser: snapshot.currentUser,
    users: snapshot.users,
  };
}

function getSnapshotLists(
  snapshot: VisibleDataSnapshot | undefined,
  options: UseVisibleDataQueryOptions,
  listPageSize: number,
) {
  if (!snapshot) {
    return [];
  }

  const filtered = snapshot.lists.filter((list) => {
    if (options.listId && list.id !== options.listId) {
      return false;
    }

    if (options.ownerId && list.userId !== options.ownerId) {
      return false;
    }

    if (options.publicOnly && !list.isPublic) {
      return false;
    }

    return true;
  });

  return filtered.slice(0, options.listId ? 1 : listPageSize);
}

function isFullSnapshotRequest(
  includeLists: boolean,
  options: UseVisibleDataQueryOptions,
) {
  return includeLists && !options.listId && !options.ownerId && !options.publicOnly;
}

function mergeSnapshotLists(existingLists: VisibleDataSnapshot['lists'], nextLists: VisibleDataSnapshot['lists']) {
  const mergedLists = new Map(existingLists.map((list) => [list.id, list]));

  nextLists.forEach((list) => {
    mergedLists.set(list.id, list);
  });

  return Array.from(mergedLists.values()).sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function getInitialListsData(
  includeLists: boolean,
  hasListSnapshot: boolean,
  snapshotLists: VisibleDataSnapshot['lists'],
) {
  if (!includeLists || !hasListSnapshot) {
    return undefined;
  }

  return {
    pages: [snapshotLists],
    pageParams: [0],
  };
}

function getVisibleQueryState(params: {
  contextLoading: boolean;
  includeLists: boolean;
  initialListsData?: InfiniteData<VisibleDataSnapshot['lists'], number>;
  listsData?: InfiniteData<VisibleDataSnapshot['lists'], number>;
  listsError: unknown;
  listsFetchingNextPage: boolean;
  listsHasNextPage?: boolean;
  listsLoading: boolean;
  resolvedContext?: VisibleDataContext;
}) {
  const isWaitingForInitialLists = Boolean(
    params.includeLists &&
    params.resolvedContext &&
    !params.listsData &&
    !params.initialListsData &&
    params.listsLoading,
  );

  return {
    hasNextPage: Boolean(params.includeLists && params.listsHasNextPage),
    hasPartialDataError: Boolean(
      params.resolvedContext && params.listsError && params.includeLists,
    ),
    isFetchingNextPage: params.includeLists && params.listsFetchingNextPage,
    isLoading: Boolean(
      (!params.resolvedContext && params.contextLoading) || isWaitingForInitialLists,
    ),
    isWaitingForInitialLists,
  };
}

function getSnapshotSeedState(params: {
  hasCachedContext: boolean;
  hasCachedLists: boolean;
  hasContextSnapshot: boolean;
  hasListSnapshot: boolean;
  includeLists: boolean;
}) {
  const seedContext = !params.hasCachedContext && params.hasContextSnapshot;
  const seedLists = Boolean(
    params.includeLists && !params.hasCachedLists && params.hasListSnapshot,
  );

  return {
    refetchContextOnMount: !params.hasCachedContext && !seedContext,
    refetchListsOnMount: Boolean(
      params.includeLists && !params.hasCachedLists && !seedLists,
    ),
    seedContext,
    seedLists,
  };
}

function buildSnapshotForCache(
  existingSnapshot: VisibleDataSnapshot | undefined,
  nextData: VisibleDataSnapshot,
  includeLists: boolean,
  options: UseVisibleDataQueryOptions,
): VisibleDataSnapshot {
  const nextContext = {
    allUsers: nextData.allUsers,
    blockRows: nextData.blockRows,
    currentUser: nextData.currentUser,
    users: nextData.users,
  };

  if (!includeLists) {
    return {
      ...nextContext,
      lists: existingSnapshot?.lists || [],
    };
  }

  if (isFullSnapshotRequest(includeLists, options) || !existingSnapshot) {
    return nextData;
  }

  if (options.listId || options.ownerId) {
    return {
      ...nextContext,
      lists: mergeSnapshotLists(existingSnapshot.lists, nextData.lists),
    };
  }

  return {
    ...nextContext,
    lists: existingSnapshot.lists.length > 0 ? existingSnapshot.lists : nextData.lists,
  };
}

export const visibleDataQueryInternals = {
  buildSnapshotForCache,
  getSnapshotLists,
  getViewerId,
  isFullSnapshotRequest,
  mergeSnapshotLists,
  toVisibleDataContext,
};

export function useVisibleDataQuery(
  userId?: string | null,
  options: UseVisibleDataQueryOptions = {},
) {
  const queryClient = useQueryClient();
  const {
    filterToViewerNetwork,
    includeLists,
    includePlaceComments,
    listId,
    listPageSize,
    ownerId,
    publicOnly,
    queryEnabled,
  } = resolveVisibleQueryOptions(options);
  const viewerId = getViewerId(userId);
  const contextQueryKey = queryKeys.visibleData.context(viewerId);
  const listsQueryKey = queryKeys.visibleData.lists(viewerId, {
    includePlaceComments,
    listId,
    ownerId,
    pageSize: listPageSize,
    publicOnly,
    scope: filterToViewerNetwork ? 'viewer-network' : null,
  });
  const hasCachedContextQuery = Boolean(
    queryClient.getQueryData<VisibleDataContext>(contextQueryKey),
  );
  const hasCachedListsQuery = Boolean(
    queryClient.getQueryData<InfiniteData<VisibleDataSnapshot['lists'], number>>(listsQueryKey),
  );
  const cachedSnapshot = queryClient.getQueryData<VisibleDataSnapshot>(
    queryKeys.visibleData.snapshot(viewerId),
  );
  const snapshotContext = toVisibleDataContext(cachedSnapshot);
  const snapshotLists = useMemo(
    () =>
      getSnapshotLists(
        cachedSnapshot,
        {
          includeLists,
          includePlaceComments,
          listId,
          listPageSize,
          ownerId,
          publicOnly,
        },
        listPageSize,
      ),
    [cachedSnapshot, includeLists, includePlaceComments, listId, listPageSize, ownerId, publicOnly],
  );
  const hasContextSnapshot = Boolean(snapshotContext);
  const hasListSnapshot = Boolean(cachedSnapshot);
  const initialListsData = useMemo(
    () => getInitialListsData(includeLists, hasListSnapshot, snapshotLists),
    [hasListSnapshot, includeLists, snapshotLists],
  );
  const seedState = getSnapshotSeedState({
    hasCachedContext: hasCachedContextQuery,
    hasCachedLists: hasCachedListsQuery,
    hasContextSnapshot,
    hasListSnapshot,
    includeLists,
  });

  const contextQuery = useQuery({
    enabled: queryEnabled,
    queryKey: contextQueryKey,
    queryFn: () => fetchVisibleDataContext(userId),
    initialData: seedState.seedContext ? snapshotContext : undefined,
    initialDataUpdatedAt: seedState.seedContext ? 0 : undefined,
    refetchOnMount: seedState.refetchContextOnMount,
    refetchOnReconnect: 'always',
    staleTime: VISIBLE_DATA_STALE_TIME_MS,
  });

  const listsQuery = useInfiniteQuery<
    VisibleDataSnapshot['lists'],
    Error,
    InfiniteData<VisibleDataSnapshot['lists'], number>,
    ReturnType<typeof queryKeys.visibleData.lists>,
    number
  >({
    enabled: queryEnabled && includeLists && (Boolean(contextQuery.data) || hasContextSnapshot),
    initialPageParam: 0,
    initialData: seedState.seedLists ? initialListsData : undefined,
    initialDataUpdatedAt: seedState.seedLists ? 0 : undefined,
    queryKey: listsQueryKey,
    queryFn: ({ pageParam = 0 }) =>
      fetchVisibleListsPage({
        allUsers: contextQuery.data?.allUsers || snapshotContext?.allUsers || [],
        blockRows: contextQuery.data?.blockRows || snapshotContext?.blockRows || [],
        includePlaceComments,
        limit: listId ? 1 : listPageSize,
        listId,
        offset: pageParam,
        ownerId,
        ownerIds:
          filterToViewerNetwork && userId
            ? Array.from(
                new Set([
                  userId,
                  ...((contextQuery.data || snapshotContext)?.currentUser?.following || []),
                ]),
              )
            : undefined,
        publicOnly,
        viewerId: userId,
      }),
    getNextPageParam: (lastPage, allPages) => {
      if (!Array.isArray(lastPage) || listId || lastPage.length < listPageSize) {
        return undefined;
      }

      return allPages.reduce(
        (total, page) => total + (Array.isArray(page) ? page.length : 0),
        0,
      );
    },
    refetchOnMount: seedState.refetchListsOnMount,
    refetchOnReconnect: 'always',
    staleTime: VISIBLE_DATA_STALE_TIME_MS,
  });

  const resolvedContext = contextQuery.data || snapshotContext;
  const lists = useMemo(
    (): VisibleDataSnapshot['lists'] =>
      includeLists ? flattenPages(listsQuery.data || initialListsData) as VisibleDataSnapshot['lists'] : [],
    [includeLists, initialListsData, listsQuery.data],
  );
  const error = contextQuery.error || listsQuery.error || null;
  const queryState = getVisibleQueryState({
    contextLoading: contextQuery.isLoading,
    includeLists,
    initialListsData,
    listsData: listsQuery.data,
    listsError: listsQuery.error,
    listsFetchingNextPage: listsQuery.isFetchingNextPage,
    listsHasNextPage: listsQuery.hasNextPage,
    listsLoading: listsQuery.isLoading,
    resolvedContext,
  });

  const data = useMemo<VisibleDataSnapshot | undefined>(() => {
    if (!resolvedContext || queryState.isWaitingForInitialLists) {
      return undefined;
    }

    return {
      ...resolvedContext,
      lists,
    };
  }, [lists, queryState.isWaitingForInitialLists, resolvedContext]);

  useEffect(() => {
    if (!data) {
      return;
    }

    const existingSnapshot = queryClient.getQueryData<VisibleDataSnapshot>(
      queryKeys.visibleData.snapshot(viewerId),
    );
    const nextSnapshot = buildSnapshotForCache(existingSnapshot, data, includeLists, {
      filterToViewerNetwork,
      includeLists,
      includePlaceComments,
      listId,
      listPageSize,
      ownerId,
      publicOnly,
    });

    queryClient.setQueryData(queryKeys.visibleData.snapshot(viewerId), nextSnapshot);

    if (viewerId === PUBLIC_VIEWER_ID) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void savePersistedVisibleDataSnapshot(viewerId, nextSnapshot).catch((err) => { logger.debug('visible-data', 'Failed to save persisted visible data snapshot', err); });
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    data,
    filterToViewerNetwork,
    includeLists,
    includePlaceComments,
    listId,
    listPageSize,
    ownerId,
    publicOnly,
    queryClient,
    viewerId,
  ]);

  const refetch = async () => {
    const [contextResult, listsResult] = await Promise.allSettled([
      contextQuery.refetch(),
      includeLists ? listsQuery.refetch() : Promise.resolve(undefined),
    ]);
    const nextContext =
      contextResult.status === 'fulfilled'
        ? (contextResult.value.data as VisibleDataContext | undefined)
        : resolvedContext;
    const nextLists = includeLists
      ? flattenPages(
          (listsResult.status === 'fulfilled'
            ? (listsResult.value?.data as InfiniteData<
                VisibleDataSnapshot['lists'],
                number
              > | undefined)
            : undefined) ||
            listsQuery.data ||
            initialListsData,
        )
      : [];

    const nextError =
      contextResult.status === 'rejected'
        ? contextResult.reason
        : listsResult.status === 'rejected'
          ? listsResult.reason
          : null;

    return {
      data: nextContext
        ? {
            ...nextContext,
            lists: nextLists,
          }
        : undefined,
      error: nextError,
    };
  };

  return {
    ...contextQuery,
    data,
    error,
    fetchNextPage: includeLists ? listsQuery.fetchNextPage : undefined,
    hasPartialDataError: queryState.hasPartialDataError,
    hasNextPage: queryState.hasNextPage,
    isFetchingNextPage: queryState.isFetchingNextPage,
    isLoading: queryState.isLoading,
    refetch,
  };
}
