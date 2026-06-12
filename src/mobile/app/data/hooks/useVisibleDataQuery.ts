import { useEffect, useMemo } from 'react';
import {
  InfiniteData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import {
  fetchVisibleDataContext,
  fetchVisibleListsPage,
  type VisibleDataContext,
  type VisibleDataSnapshot,
} from '@/mobile/app/data/repositories/visibleDataRepository';

const PUBLIC_VIEWER_ID = '__public__';
const VISIBLE_DATA_STALE_TIME_MS = 1000 * 60 * 2;
const DEFAULT_VISIBLE_LISTS_PAGE_SIZE = 20;

export type UseVisibleDataQueryOptions = {
  includeLists?: boolean;
  listId?: string;
  listPageSize?: number;
  ownerId?: string;
  publicOnly?: boolean;
};

function getViewerId(userId?: string | null) {
  return userId || PUBLIC_VIEWER_ID;
}

function isInfiniteVisibleListsData(
  data: unknown,
): data is InfiniteData<VisibleDataSnapshot['lists'], number> {
  return Boolean(
    data &&
      typeof data === 'object' &&
      Array.isArray((data as { pages?: unknown }).pages) &&
      Array.isArray((data as { pageParams?: unknown }).pageParams),
  );
}

function flattenListPages(
  data?: InfiniteData<VisibleDataSnapshot['lists'], number> | VisibleDataSnapshot['lists'] | unknown,
) {
  if (Array.isArray(data)) {
    return data;
  }

  if (!isInfiniteVisibleListsData(data)) {
    return [];
  }

  const seenIds = new Set<string>();

  return data.pages.flatMap((page) =>
    page.filter((item) => {
      if (seenIds.has(item.id)) {
        return false;
      }

      seenIds.add(item.id);
      return true;
    }),
  );
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

export function useVisibleDataQuery(
  userId?: string | null,
  options: UseVisibleDataQueryOptions = {},
) {
  const queryClient = useQueryClient();
  const viewerId = getViewerId(userId);
  const includeLists = options.includeLists !== false;
  const listPageSize = options.listPageSize || DEFAULT_VISIBLE_LISTS_PAGE_SIZE;
  const cachedSnapshot = queryClient.getQueryData<VisibleDataSnapshot>(
    queryKeys.visibleData.snapshot(viewerId),
  );
  const snapshotContext = toVisibleDataContext(cachedSnapshot);
  const snapshotLists = getSnapshotLists(cachedSnapshot, options, listPageSize);
  const hasContextPlaceholder = Boolean(snapshotContext);
  const placeholderListsData = includeLists
    ? {
        pages: [snapshotLists],
        pageParams: [0],
      }
    : undefined;

  const contextQuery = useQuery({
    queryKey: queryKeys.visibleData.context(viewerId),
    queryFn: () => fetchVisibleDataContext(userId),
    placeholderData: snapshotContext,
    refetchOnMount: 'always',
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
    enabled: includeLists && (Boolean(contextQuery.data) || hasContextPlaceholder),
    initialPageParam: 0,
    placeholderData: placeholderListsData,
    queryKey: queryKeys.visibleData.lists(viewerId, {
      listId: options.listId,
      ownerId: options.ownerId,
      pageSize: listPageSize,
      publicOnly: options.publicOnly,
    }),
    queryFn: ({ pageParam = 0 }) =>
      fetchVisibleListsPage({
        allUsers: contextQuery.data?.allUsers || snapshotContext?.allUsers || [],
        blockRows: contextQuery.data?.blockRows || snapshotContext?.blockRows || [],
        limit: options.listId ? 1 : listPageSize,
        listId: options.listId,
        offset: pageParam,
        ownerId: options.ownerId,
        publicOnly: options.publicOnly,
        viewerId: userId,
      }),
    getNextPageParam: (lastPage, allPages) => {
      if (!Array.isArray(lastPage) || options.listId || lastPage.length < listPageSize) {
        return undefined;
      }

      return allPages.reduce(
        (total, page) => total + (Array.isArray(page) ? page.length : 0),
        0,
      );
    },
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
    staleTime: VISIBLE_DATA_STALE_TIME_MS,
  });

  const resolvedContext = contextQuery.data || snapshotContext;
  const lists = useMemo(
    () => (includeLists ? flattenListPages(listsQuery.data || placeholderListsData) : []),
    [includeLists, listsQuery.data, placeholderListsData],
  );
  const isWaitingForInitialLists =
    includeLists &&
    Boolean(resolvedContext) &&
    !listsQuery.data &&
    !placeholderListsData &&
    listsQuery.isLoading;
  const error = contextQuery.error || listsQuery.error || null;
  const hasPartialDataError =
    Boolean(resolvedContext) &&
    Boolean(listsQuery.error) &&
    includeLists;

  const data = useMemo<VisibleDataSnapshot | undefined>(() => {
    if (!resolvedContext || isWaitingForInitialLists) {
      return undefined;
    }

    return {
      ...resolvedContext,
      lists,
    };
  }, [isWaitingForInitialLists, lists, resolvedContext]);

  useEffect(() => {
    if (data) {
      queryClient.setQueryData(queryKeys.visibleData.snapshot(viewerId), data);
    }
  }, [data, queryClient, viewerId]);

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
      ? flattenListPages(
          (listsResult.status === 'fulfilled'
            ? (listsResult.value?.data as InfiniteData<
                VisibleDataSnapshot['lists'],
                number
              > | undefined)
            : undefined) ||
            listsQuery.data ||
            placeholderListsData,
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
    hasPartialDataError,
    hasNextPage: includeLists ? listsQuery.hasNextPage : false,
    isFetchingNextPage: includeLists ? listsQuery.isFetchingNextPage : false,
    isLoading: (!resolvedContext && contextQuery.isLoading) || isWaitingForInitialLists,
    refetch,
  };
}
