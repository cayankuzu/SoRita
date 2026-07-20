import {
  readDueOutboxEntries,
  removeOutboxEntry,
  updateOutboxEntry,
  type JsonValue,
  type OutboxEntry,
} from '@/mobile/app/data/outbox/outboxStorage';
import { trackEvent } from '@/mobile/app/platform/analytics/analyticsEvents';
import type { MediaBucket } from '@/mobile/app/platform/supabase/media';

const MAX_BACKOFF_MS = 60 * 60 * 1000;

type OutboxRuntimeDependencies = {
  blockUser: (currentUserId: string, targetUserId: string) => Promise<void>;
  createPlaceComment: (
    placeId: string,
    userId: string,
    content: string,
    parentCommentId?: string | null,
    commentId?: string,
  ) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  updateLists?: (lists: JsonValue[]) => Promise<void>;
  deleteStorageAssetsByUrls: (params: {
    bucket: MediaBucket;
    urls: string[];
  }) => Promise<void>;
  now: () => Date;
  submitModerationReport: (payload: {
    commentId?: string;
    details?: string;
    listId?: string;
    placeId?: string;
    reason: string;
    reporterUserId: string;
    targetType: 'comment' | 'list' | 'place' | 'user';
    targetUserId?: string;
  }) => Promise<void>;
  unblockUser: (currentUserId: string, targetUserId: string) => Promise<void>;
};

const defaultDependencies: OutboxRuntimeDependencies = {
  blockUser: async (...args) => {
    const repository = await import('@/mobile/app/data/repositories/usersRepository');
    return repository.blockUser(...args);
  },
  createPlaceComment: async (...args) => {
    const repository = await import('@/mobile/app/data/repositories/placesRepository');
    return repository.createPlaceComment(...args);
  },
  deleteStorageAssetsByUrls: async (params) => {
    const media = await import('@/mobile/app/platform/supabase/media');
    return media.deleteStorageAssetsByUrls(params);
  },
  markNotificationRead: async (notificationId) => {
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');
    return repository.markNotificationRead(notificationId);
  },
  updateLists: async (lists) => {
    const repository = await import('@/mobile/app/data/repositories/listsRepository');
    return repository.updateLists(
      lists as unknown as Parameters<typeof repository.updateLists>[0],
    );
  },
  now: () => new Date(),
  submitModerationReport: async (payload) => {
    const repository = await import('@/mobile/app/data/repositories/moderationReports');
    return repository.submitModerationReport(payload as Parameters<typeof repository.submitModerationReport>[0]);
  },
  unblockUser: async (...args) => {
    const repository = await import('@/mobile/app/data/repositories/usersRepository');
    return repository.unblockUser(...args);
  },
};

function readObject(payload: JsonValue) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid outbox payload.');
  }

  return payload;
}

function readRequiredString(payload: Record<string, JsonValue>, key: string) {
  const value = payload[key];

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid outbox ${key}.`);
  }

  return value;
}

function readOptionalString(payload: Record<string, JsonValue>, key: string) {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

async function replayEntry(entry: OutboxEntry, dependencies: OutboxRuntimeDependencies) {
  const payload = readObject(entry.payloadRef);

  if (entry.kind === 'notification-read') {
    await dependencies.markNotificationRead(readRequiredString(payload, 'notificationId'));
    return;
  }

  if (entry.kind === 'comment-create') {
    const parentCommentId = payload.parentCommentId;
    await dependencies.createPlaceComment(
      readRequiredString(payload, 'placeId'),
      entry.userId,
      readRequiredString(payload, 'content'),
      typeof parentCommentId === 'string' ? parentCommentId : null,
      readRequiredString(payload, 'commentId'),
    );
    return;
  }

  if (entry.kind === 'lists-update') {
    const lists = payload.lists;

    if (!Array.isArray(lists) || lists.length === 0) {
      throw new Error('Invalid outbox lists payload.');
    }

    await (dependencies.updateLists ?? defaultDependencies.updateLists)!(lists);
    return;
  }

  if (entry.kind === 'media-cleanup') {
    const bucket = readRequiredString(payload, 'bucket');
    const urls = payload.urls;
    const mediaUrls = Array.isArray(urls)
      ? urls.filter((url): url is string => typeof url === 'string' && url.length > 0)
      : [];

    if (
      !['place-media', 'place-media-private', 'profile-media'].includes(bucket) ||
      !Array.isArray(urls) ||
      mediaUrls.length !== urls.length
    ) {
      throw new Error('Invalid outbox media cleanup payload.');
    }

    await dependencies.deleteStorageAssetsByUrls({
      bucket: bucket as MediaBucket,
      urls: mediaUrls,
    });
    return;
  }

  if (entry.kind === 'user-block-state') {
    const targetUserId = readRequiredString(payload, 'targetUserId');
    const blocked = payload.blocked;

    if (typeof blocked !== 'boolean') {
      throw new Error('Invalid outbox blocked state.');
    }

    if (blocked) {
      await dependencies.blockUser(entry.userId, targetUserId);
    } else {
      await dependencies.unblockUser(entry.userId, targetUserId);
    }
    return;
  }

  if (entry.kind === 'moderation-report') {
    const targetType = readRequiredString(payload, 'targetType');

    if (!['comment', 'list', 'place', 'user'].includes(targetType)) {
      throw new Error('Invalid outbox moderation target.');
    }

    await dependencies.submitModerationReport({
      commentId: readOptionalString(payload, 'commentId'),
      details: readOptionalString(payload, 'details'),
      listId: readOptionalString(payload, 'listId'),
      placeId: readOptionalString(payload, 'placeId'),
      reason: readRequiredString(payload, 'reason'),
      reporterUserId: entry.userId,
      targetType: targetType as 'comment' | 'list' | 'place' | 'user',
      targetUserId: readOptionalString(payload, 'targetUserId'),
    });
    return;
  }

  throw new Error(`Unsupported outbox operation: ${entry.kind}`);
}

function getNextAttemptAt(now: Date, attempt: number) {
  const backoffMs = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.min(attempt, 12));
  return new Date(now.getTime() + backoffMs).toISOString();
}

const syncInFlightByUser = new Map<string, Promise<number>>();

export function synchronizeOutbox(
  userId: string,
  dependencies: OutboxRuntimeDependencies = defaultDependencies,
) {
  const existing = syncInFlightByUser.get(userId);

  if (existing) {
    return existing;
  }

  const operation = (async () => {
    const dueEntries = await readDueOutboxEntries(userId, dependencies.now());
    let syncedCount = 0;

    for (const entry of dueEntries) {
      const attempt = entry.attempt + 1;
      await updateOutboxEntry(userId, entry.id, { attempt, state: 'running' });

      try {
        await replayEntry(entry, dependencies);
        await removeOutboxEntry(userId, entry.id);
        syncedCount += 1;
      } catch (error) {
        await updateOutboxEntry(userId, entry.id, {
          attempt,
          lastError: error instanceof Error ? error.message.slice(0, 300) : 'Unknown sync error',
          nextAttemptAt: getNextAttemptAt(dependencies.now(), attempt),
          state: 'failed',
        });
      }
    }

    trackEvent({
      name: 'outbox_synced',
      params: {
        count: syncedCount,
        status: syncedCount === dueEntries.length ? 'success' : 'error',
      },
    });
    return syncedCount;
  })().finally(() => {
    syncInFlightByUser.delete(userId);
  });

  syncInFlightByUser.set(userId, operation);
  return operation;
}
