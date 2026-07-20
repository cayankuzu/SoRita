import { beforeEach, describe, expect, it, vi } from 'vitest';

import { synchronizeOutbox } from '@/mobile/app/data/outbox/outboxRuntime';
import {
  clearAllOutboxEntries,
  enqueueOutboxEntry,
  readOutboxEntries,
} from '@/mobile/app/data/outbox/outboxStorage';

describe('outboxRuntime', () => {
  const afterEnqueue = () => new Date(Date.now() + 1_000);

  beforeEach(async () => {
    await clearAllOutboxEntries();
  });

  it('replays idempotent comments and notification reads, then removes them', async () => {
    await enqueueOutboxEntry({
      idempotencyKey: 'comment:create:1',
      kind: 'comment-create',
      payloadRef: {
        commentId: 'comment-1',
        content: 'hello',
        parentCommentId: null,
        placeId: 'place-1',
      },
      userId: 'user-1',
    });
    await enqueueOutboxEntry({
      idempotencyKey: 'notification:read:1',
      kind: 'notification-read',
      payloadRef: { notificationId: 'notification-1' },
      userId: 'user-1',
    });
    const createPlaceComment = vi.fn().mockResolvedValue(undefined);
    const markNotificationRead = vi.fn().mockResolvedValue(undefined);

    await expect(synchronizeOutbox('user-1', {
      blockUser: vi.fn(),
      createPlaceComment,
      deleteStorageAssetsByUrls: vi.fn(),
      markNotificationRead,
      now: afterEnqueue,
      submitModerationReport: vi.fn(),
      unblockUser: vi.fn(),
    })).resolves.toBe(2);

    expect(createPlaceComment).toHaveBeenCalledWith(
      'place-1',
      'user-1',
      'hello',
      null,
      'comment-1',
    );
    expect(markNotificationRead).toHaveBeenCalledWith('notification-1');
    await expect(readOutboxEntries('user-1')).resolves.toEqual([]);
  });

  it('persists a bounded retry after a replay failure', async () => {
    await enqueueOutboxEntry({
      kind: 'notification-read',
      payloadRef: { notificationId: 'notification-1' },
      userId: 'user-1',
    });
    const now = afterEnqueue();

    await expect(synchronizeOutbox('user-1', {
      blockUser: vi.fn(),
      createPlaceComment: vi.fn(),
      deleteStorageAssetsByUrls: vi.fn(),
      markNotificationRead: vi.fn().mockRejectedValue(new Error('offline')),
      now: () => now,
      submitModerationReport: vi.fn(),
      unblockUser: vi.fn(),
    })).resolves.toBe(0);

    const [entry] = await readOutboxEntries('user-1');
    expect(entry).toMatchObject({ attempt: 1, lastError: 'offline', state: 'failed' });
    expect(new Date(entry.nextAttemptAt).getTime()).toBeGreaterThan(now.getTime());
  });

  it('replays durable list updates used by offline place saves', async () => {
    const lists = [{ id: 'list-1', name: 'Saved', places: [], userId: 'user-1' }];
    await enqueueOutboxEntry({
      idempotencyKey: 'lists-update:list-1',
      kind: 'lists-update',
      payloadRef: { lists },
      userId: 'user-1',
    });
    const updateLists = vi.fn().mockResolvedValue(undefined);

    await expect(synchronizeOutbox('user-1', {
      blockUser: vi.fn(),
      createPlaceComment: vi.fn(),
      deleteStorageAssetsByUrls: vi.fn(),
      markNotificationRead: vi.fn(),
      now: afterEnqueue,
      submitModerationReport: vi.fn(),
      unblockUser: vi.fn(),
      updateLists,
    })).resolves.toBe(1);

    expect(updateLists).toHaveBeenCalledWith(lists);
  });

  it('replays the latest block state and privacy-safe moderation report', async () => {
    await enqueueOutboxEntry({
      idempotencyKey: 'block-state',
      kind: 'user-block-state',
      payloadRef: { blocked: true, targetUserId: 'target-1' },
      userId: 'user-1',
    });
    await enqueueOutboxEntry({
      idempotencyKey: 'report-1',
      kind: 'moderation-report',
      payloadRef: {
        details: 'details',
        reason: 'spam',
        targetType: 'place',
        placeId: 'place-1',
      },
      userId: 'user-1',
    });
    const blockUser = vi.fn().mockResolvedValue(undefined);
    const submitModerationReport = vi.fn().mockResolvedValue(undefined);

    await expect(synchronizeOutbox('user-1', {
      blockUser,
      createPlaceComment: vi.fn(),
      deleteStorageAssetsByUrls: vi.fn(),
      markNotificationRead: vi.fn(),
      now: afterEnqueue,
      submitModerationReport,
      unblockUser: vi.fn(),
    })).resolves.toBe(2);

    expect(blockUser).toHaveBeenCalledWith('user-1', 'target-1');
    expect(submitModerationReport).toHaveBeenCalledWith({
      commentId: undefined,
      details: 'details',
      listId: undefined,
      placeId: 'place-1',
      reason: 'spam',
      reporterUserId: 'user-1',
      targetType: 'place',
      targetUserId: undefined,
    });
  });

  it('replays unblock state and rejects malformed durable payloads safely', async () => {
    await enqueueOutboxEntry({
      kind: 'user-block-state',
      payloadRef: { blocked: false, targetUserId: 'target-1' },
      userId: 'user-1',
    });
    await enqueueOutboxEntry({
      kind: 'moderation-report',
      payloadRef: { reason: 'spam', targetType: 'unknown' },
      userId: 'user-1',
    });
    const unblockUser = vi.fn().mockResolvedValue(undefined);

    await expect(synchronizeOutbox('user-1', {
      blockUser: vi.fn(),
      createPlaceComment: vi.fn(),
      deleteStorageAssetsByUrls: vi.fn(),
      markNotificationRead: vi.fn(),
      now: afterEnqueue,
      submitModerationReport: vi.fn(),
      unblockUser,
    })).resolves.toBe(1);

    expect(unblockUser).toHaveBeenCalledWith('user-1', 'target-1');
    const [failed] = await readOutboxEntries('user-1');
    expect(failed).toMatchObject({ state: 'failed' });
  });

  it('retries orphaned media cleanup with the original bucket and URLs', async () => {
    await enqueueOutboxEntry({
      kind: 'media-cleanup',
      payloadRef: {
        bucket: 'place-media-private',
        urls: ['sorita-storage://place-media-private/user-1/place.jpg'],
      },
      userId: 'user-1',
    });
    const deleteStorageAssetsByUrls = vi.fn().mockResolvedValue(undefined);

    await expect(synchronizeOutbox('user-1', {
      blockUser: vi.fn(),
      createPlaceComment: vi.fn(),
      deleteStorageAssetsByUrls,
      markNotificationRead: vi.fn(),
      now: afterEnqueue,
      submitModerationReport: vi.fn(),
      unblockUser: vi.fn(),
    })).resolves.toBe(1);

    expect(deleteStorageAssetsByUrls).toHaveBeenCalledWith({
      bucket: 'place-media-private',
      urls: ['sorita-storage://place-media-private/user-1/place.jpg'],
    });
  });

  it('isolates malformed list and media payloads while continuing valid work', async () => {
    await enqueueOutboxEntry({
      kind: 'lists-update',
      payloadRef: { lists: [] },
      userId: 'user-1',
    });
    await enqueueOutboxEntry({
      kind: 'media-cleanup',
      payloadRef: { bucket: 'unknown', urls: ['https://cdn.test/a.jpg'] },
      userId: 'user-1',
    });
    await enqueueOutboxEntry({
      kind: 'media-cleanup',
      payloadRef: { bucket: 'profile-media', urls: 'invalid' },
      userId: 'user-1',
    });
    await enqueueOutboxEntry({
      kind: 'comment-create',
      payloadRef: {
        commentId: 'reply-1',
        content: 'reply',
        parentCommentId: 'parent-1',
        placeId: 'place-1',
      },
      userId: 'user-1',
    });
    const createPlaceComment = vi.fn().mockResolvedValue(undefined);

    await expect(synchronizeOutbox('user-1', {
      blockUser: vi.fn(),
      createPlaceComment,
      deleteStorageAssetsByUrls: vi.fn(),
      markNotificationRead: vi.fn(),
      now: afterEnqueue,
      submitModerationReport: vi.fn(),
      unblockUser: vi.fn(),
    })).resolves.toBe(1);

    expect(createPlaceComment).toHaveBeenCalledWith(
      'place-1', 'user-1', 'reply', 'parent-1', 'reply-1',
    );
    await expect(readOutboxEntries('user-1')).resolves.toHaveLength(3);
  });
});
