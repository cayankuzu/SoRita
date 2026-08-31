import type { QueryClient, QueryKey } from '@tanstack/react-query';

import {
  readScreenIndex,
  writeScreenIndex,
} from '@/mobile/app/data/cache/screenIndexStorage';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { scheduleDeferredTask } from '@/mobile/app/shared/utils/deferredTask';

// v3 invalidates snapshots produced by the old truncated-media read models.
const STARTUP_QUERY_INDEX_NAME = 'startup-queries-v3';
const MAX_STARTUP_QUERY_RETENTION_MS = 1000 * 60 * 60 * 24;
const STARTUP_QUERY_PERSIST_DEBOUNCE_MS = 650;
const MAX_PERSISTED_QUERY_COUNT = 7;
const MAX_PERSISTED_PAYLOAD_BYTES = 1_000_000;

type PersistedStartupQuery = {
  data: unknown;
  dataUpdatedAt: number;
  queryKey: unknown[];
};

type PersistedStartupQuerySnapshot = {
  queries: PersistedStartupQuery[];
};

type PendingPersistence = {
  deferredTask: ReturnType<typeof scheduleDeferredTask> | null;
  queryClient: QueryClient;
  timeout: ReturnType<typeof setTimeout> | null;
};

const pendingPersistenceByUser = new Map<string, PendingPersistence>();
const restoreInFlightByUser = new Map<string, Promise<number>>();
const persistenceInFlightByUser = new Map<string, Set<Promise<boolean>>>();
const workGenerationByUser = new Map<string, number>();

function getWorkGeneration(userId: string) {
  return workGenerationByUser.get(userId) ?? 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Only viewer-scoped, bounded, first-screen read models are durable. Search
 * results, arbitrary profiles, mutations and signed media URLs stay in memory.
 */
export function isStartupQueryKeyAllowed(queryKey: QueryKey, userId: string) {
  const [domain, kind, viewerId, detail, search] = queryKey;

  if (!isNonEmptyString(userId) || viewerId !== userId) {
    return false;
  }

  if (domain === 'feed') {
    return kind === 'page';
  }

  if (domain === 'explore') {
    return (
      kind === 'page' &&
      detail === 'lists' &&
      search === ''
    );
  }

  if (domain === 'profile') {
    return (
      (kind === 'summary' && detail === userId) ||
      (kind === 'content' && detail === userId && search === 'lists')
    );
  }

  if (domain === 'notifications') {
    return kind === 'list' || kind === 'unread-count';
  }

  if (domain === 'map') {
    return kind === 'markers';
  }

  return false;
}

function getStartupQueryRetentionMs(queryKey: QueryKey) {
  switch (queryKey[0]) {
    case 'notifications':
      return 1000 * 60 * 60 * 2;
    case 'explore':
      return 1000 * 60 * 60 * 6;
    case 'feed':
      return 1000 * 60 * 60 * 12;
    case 'map':
    case 'profile':
      return MAX_STARTUP_QUERY_RETENTION_MS;
    default:
      return 0;
  }
}

function isEphemeralMediaUri(value: string) {
  const normalized = value.toLowerCase();

  if (
    normalized.startsWith('file:') ||
    normalized.startsWith('content:') ||
    normalized.startsWith('blob:') ||
    normalized.startsWith('data:')
  ) {
    return true;
  }

  if (normalized.includes('/storage/v1/object/sign/')) {
    return true;
  }

  return /[?&](?:token|signature|x-amz-signature|x-goog-signature|expires)=/i.test(value);
}

function cloneForPersistence(value: unknown) {
  const serialized = JSON.stringify(value, (_key, nestedValue: unknown) => {
    if (typeof nestedValue === 'string' && isEphemeralMediaUri(nestedValue)) {
      return undefined;
    }

    return nestedValue;
  });

  return serialized === undefined ? undefined : (JSON.parse(serialized) as unknown);
}

function trimInfiniteQueryData(value: unknown) {
  if (!value || typeof value !== 'object') {
    return value;
  }

  const candidate = value as { pageParams?: unknown; pages?: unknown };

  if (!Array.isArray(candidate.pages) || !Array.isArray(candidate.pageParams)) {
    return value;
  }

  return {
    ...candidate,
    pageParams: candidate.pageParams.slice(0, 1),
    pages: candidate.pages.slice(0, 1),
  };
}

function isValidSnapshot(value: unknown): value is PersistedStartupQuerySnapshot {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const queries = (value as Partial<PersistedStartupQuerySnapshot>).queries;

  return (
    Array.isArray(queries) &&
    queries.length <= MAX_PERSISTED_QUERY_COUNT &&
    queries.every(
      (entry) =>
        Boolean(entry) &&
        Array.isArray(entry.queryKey) &&
        Number.isFinite(entry.dataUpdatedAt) &&
        entry.dataUpdatedAt > 0 &&
        entry.data !== undefined,
    )
  );
}

function createPersistedSnapshot(queryClient: QueryClient, userId: string) {
  const queries = queryClient
    .getQueryCache()
    .findAll({
      predicate: (query) =>
        query.state.status === 'success' &&
        query.state.data !== undefined &&
        isStartupQueryKeyAllowed(query.queryKey, userId),
    })
    .sort((left, right) => right.state.dataUpdatedAt - left.state.dataUpdatedAt)
    .slice(0, MAX_PERSISTED_QUERY_COUNT)
    .flatMap<PersistedStartupQuery>((query) => {
      const data = cloneForPersistence(trimInfiniteQueryData(query.state.data));

      return data === undefined
        ? []
        : [{
            data,
            dataUpdatedAt: query.state.dataUpdatedAt,
            queryKey: [...query.queryKey],
          }];
    });

  return { queries } satisfies PersistedStartupQuerySnapshot;
}

export function restoreStartupQueryCache(queryClient: QueryClient, userId: string) {
  const existingRestore = restoreInFlightByUser.get(userId);

  if (existingRestore) {
    return existingRestore;
  }

  const generation = getWorkGeneration(userId);
  const restore = (async () => {
    const snapshot = await readScreenIndex<unknown>(
      userId,
      STARTUP_QUERY_INDEX_NAME,
      MAX_STARTUP_QUERY_RETENTION_MS,
    );

    if (generation !== getWorkGeneration(userId) || !isValidSnapshot(snapshot)) {
      return 0;
    }

    let restoredCount = 0;

    for (const entry of snapshot.queries) {
      if (generation !== getWorkGeneration(userId)) {
        return 0;
      }

      const retentionMs = getStartupQueryRetentionMs(entry.queryKey);

      if (
        !isStartupQueryKeyAllowed(entry.queryKey, userId) ||
        Date.now() - entry.dataUpdatedAt > retentionMs
      ) {
        continue;
      }

      queryClient.setQueryData(entry.queryKey, entry.data, {
        updatedAt: entry.dataUpdatedAt,
      });
      restoredCount += 1;
    }

    return restoredCount;
  })().finally(() => {
    restoreInFlightByUser.delete(userId);
  });

  restoreInFlightByUser.set(userId, restore);
  return restore;
}

export function persistStartupQueryCache(queryClient: QueryClient, userId: string) {
  const generation = getWorkGeneration(userId);
  const persist = (async () => {
    const snapshot = createPersistedSnapshot(queryClient, userId);

    if (snapshot.queries.length === 0 || generation !== getWorkGeneration(userId)) {
      return false;
    }

    const payloadSize = JSON.stringify(snapshot).length;

    if (payloadSize > MAX_PERSISTED_PAYLOAD_BYTES) {
      logger.warn('startup-cache', 'Skipped oversized startup query snapshot.', {
        payloadSize,
        queryCount: snapshot.queries.length,
      });
      return false;
    }

    if (generation !== getWorkGeneration(userId)) {
      return false;
    }

    await writeScreenIndex(userId, STARTUP_QUERY_INDEX_NAME, snapshot);
    return generation === getWorkGeneration(userId);
  })();
  const userPersistence = persistenceInFlightByUser.get(userId) ?? new Set<Promise<boolean>>();
  userPersistence.add(persist);
  persistenceInFlightByUser.set(userId, userPersistence);
  void persist.then(
    () => {
      userPersistence.delete(persist);

      if (userPersistence.size === 0) {
        persistenceInFlightByUser.delete(userId);
      }
    },
    () => {
      userPersistence.delete(persist);

      if (userPersistence.size === 0) {
        persistenceInFlightByUser.delete(userId);
      }
    },
  );
  return persist;
}

export function scheduleStartupQueryCachePersist(queryClient: QueryClient, userId: string) {
  const pending = pendingPersistenceByUser.get(userId);

  if (pending) {
    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }
    pending.deferredTask?.cancel();
  }

  const timeout = setTimeout(() => {
    const queued = pendingPersistenceByUser.get(userId);

    if (!queued) {
      return;
    }

    queued.timeout = null;
    queued.deferredTask = scheduleDeferredTask(() => {
      pendingPersistenceByUser.delete(userId);
      void persistStartupQueryCache(queryClient, userId).catch((error) => {
        logger.debug('startup-cache', 'Failed to persist startup query snapshot.', error);
      });
    });
  }, STARTUP_QUERY_PERSIST_DEBOUNCE_MS);

  pendingPersistenceByUser.set(userId, { deferredTask: null, queryClient, timeout });
}

export async function flushStartupQueryCachePersist(userId: string) {
  const pending = pendingPersistenceByUser.get(userId);

  if (!pending) {
    return false;
  }

  if (pending.timeout) {
    clearTimeout(pending.timeout);
  }
  pending.deferredTask?.cancel();
  pendingPersistenceByUser.delete(userId);
  return persistStartupQueryCache(pending.queryClient, userId);
}

/** Invalidates and drains startup cache work before user-scoped storage is removed. */
export async function cancelAndDrainStartupQueryCacheWork(userId: string) {
  workGenerationByUser.set(userId, getWorkGeneration(userId) + 1);
  const pending = pendingPersistenceByUser.get(userId);

  if (pending?.timeout) {
    clearTimeout(pending.timeout);
  }
  pending?.deferredTask?.cancel();
  pendingPersistenceByUser.delete(userId);

  const workInFlight: Promise<unknown>[] = [
    ...Array.from(persistenceInFlightByUser.get(userId) ?? []),
  ];
  const restoreInFlight = restoreInFlightByUser.get(userId);

  if (restoreInFlight) {
    workInFlight.push(restoreInFlight);
  }

  if (workInFlight.length > 0) {
    await Promise.allSettled(workInFlight);
  }
}

export const startupQueryCacheInternals = {
  MAX_PERSISTED_PAYLOAD_BYTES,
  cloneForPersistence,
  createPersistedSnapshot,
  getStartupQueryRetentionMs,
  isEphemeralMediaUri,
  isValidSnapshot,
  trimInfiniteQueryData,
};
