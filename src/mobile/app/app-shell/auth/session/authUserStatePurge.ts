import { clearEntityCacheForUser } from '@/mobile/app/data/cache/entityCacheStorage';
import { clearScreenIndexesForUser } from '@/mobile/app/data/cache/screenIndexStorage';
import { cancelAndDrainStartupQueryCacheWork } from '@/mobile/app/data/cache/startupQueryCache';
import { clearPersistedVisibleDataSnapshot } from '@/mobile/app/data/cache/visibleDataSnapshotCache';
import { clearOutboxForUser } from '@/mobile/app/data/outbox/outboxStorage';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { purgePrivateSignedReadUrlState } from '@/mobile/app/platform/supabase/media';

type PurgeOperation = {
  name: string;
  run: () => Promise<unknown> | unknown;
};

const purgeInFlightByUser = new Map<string, Promise<void>>();

export class AuthUserStatePurgeError extends Error {
  readonly failedOperations: string[];

  constructor(failedOperations: string[]) {
    super(`Authenticated user state purge failed: ${failedOperations.join(', ')}`);
    this.failedOperations = failedOperations;
    this.name = 'AuthUserStatePurgeError';
  }
}

async function runPurgeOperations(operations: PurgeOperation[]) {
  const settled = await Promise.allSettled(
    operations.map(async (operation) => {
      await operation.run();
      return operation.name;
    }),
  );

  return settled.flatMap((result, index) =>
    result.status === 'rejected' ? [operations[index].name] : []);
}

async function purgeUserState(userId: string | null) {
  const operations: PurgeOperation[] = [
    {
      name: 'private-media',
      run: purgePrivateSignedReadUrlState,
    },
    {
      name: 'query-cache',
      run: async () => {
        try {
          await queryClient.cancelQueries();
        } finally {
          queryClient.clear();
        }
      },
    },
    {
      name: 'realtime-channels',
      run: () => supabase.removeAllChannels(),
    },
  ];

  if (userId) {
    operations.push(
      {
        name: 'startup-screen-cache',
        run: async () => {
          try {
            await cancelAndDrainStartupQueryCacheWork(userId);
          } finally {
            await clearScreenIndexesForUser(userId);
          }
        },
      },
      {
        name: 'visible-data-cache',
        run: () => clearPersistedVisibleDataSnapshot(userId),
      },
      {
        name: 'entity-cache',
        run: () => clearEntityCacheForUser(userId),
      },
      {
        name: 'outbox',
        run: () => clearOutboxForUser(userId),
      },
    );
  }

  const failedOperations = await runPurgeOperations(operations);

  if (failedOperations.length > 0) {
    logger.error('auth', 'Authenticated user state purge was incomplete.', {
      failedOperations,
    });
    throw new AuthUserStatePurgeError(failedOperations);
  }
}

/**
 * Clears volatile and durable state that must never cross an auth boundary.
 * Concurrent callers for the same user share the same best-effort purge.
 */
export function purgeAuthenticatedUserState(userId: string | null) {
  const purgeKey = userId ?? '<anonymous>';
  const existingPurge = purgeInFlightByUser.get(purgeKey);

  if (existingPurge) {
    return existingPurge;
  }

  const purge = purgeUserState(userId).finally(() => {
    if (purgeInFlightByUser.get(purgeKey) === purge) {
      purgeInFlightByUser.delete(purgeKey);
    }
  });
  purgeInFlightByUser.set(purgeKey, purge);
  return purge;
}
