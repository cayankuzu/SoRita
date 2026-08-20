import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearOutboxForUser,
  enqueueOutboxEntry,
  readDueOutboxEntries,
  readOutboxEntries,
  removeOutboxEntry,
  updateOutboxEntry,
} from '@/mobile/app/data/outbox/outboxStorage';

describe('outboxStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('persists entries by user and dedupes idempotency keys', async () => {
    const first = await enqueueOutboxEntry({
      id: 'entry-1',
      idempotencyKey: 'intent-1',
      kind: 'user-block-state',
      payloadRef: { blocked: true, targetUserId: 'target-1' },
      userId: 'user-1',
    });
    await enqueueOutboxEntry({
      id: 'entry-2',
      idempotencyKey: 'intent-1',
      kind: 'user-block-state',
      payloadRef: { blocked: false, targetUserId: 'target-1' },
      userId: 'user-1',
    });

    const entries = await readOutboxEntries('user-1');

    expect(first.id).toBe('entry-1');
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('entry-2');
    expect(entries[0].payloadRef).toEqual({ blocked: false, targetUserId: 'target-1' });
    await expect(readOutboxEntries('user-2')).resolves.toEqual([]);
  });

  it('serializes concurrent writes without losing offline operations', async () => {
    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        enqueueOutboxEntry({
          id: `entry-${index}`,
          idempotencyKey: `intent-${index}`,
          kind: 'notification-read' as const,
          payloadRef: { notificationId: `notification-${index}` },
          userId: 'user-1',
        }),
      ),
    );

    const entries = await readOutboxEntries('user-1');
    expect(entries).toHaveLength(12);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(12);
  });

  it('treats a removed successful dependency as satisfied', async () => {
    await enqueueOutboxEntry({
      id: 'dependent-1',
      dependencies: ['completed-and-removed'],
      kind: 'notification-read',
      payloadRef: { notificationId: 'notification-1' },
      userId: 'user-1',
    });

    const dueEntries = await readDueOutboxEntries('user-1');
    expect(dueEntries.map((entry) => entry.id)).toEqual(['dependent-1']);
  });

  it('returns only due entries whose dependencies are done', async () => {
    await enqueueOutboxEntry({
      id: 'report-1',
      kind: 'moderation-report',
      payloadRef: { reason: 'spam', targetType: 'place', placeId: 'place-1' },
      state: 'done',
      userId: 'user-1',
    });
    await enqueueOutboxEntry({
      dependencies: ['report-1'],
      id: 'comment-1',
      kind: 'comment-create',
      nextAttemptAt: '2026-01-01T00:00:00.000Z',
      payloadRef: { content: 'Nice', placeId: 'place-1' },
      userId: 'user-1',
    });
    await enqueueOutboxEntry({
      id: 'future-1',
      kind: 'notification-read',
      nextAttemptAt: '2027-01-01T00:00:00.000Z',
      payloadRef: { notificationId: 'notification-1' },
      userId: 'user-1',
    });

    const dueEntries = await readDueOutboxEntries(
      'user-1',
      new Date('2026-07-14T00:00:00.000Z'),
    );

    expect(dueEntries.map((entry) => entry.id)).toEqual(['comment-1']);
  });

  it('updates, removes, and clears entries', async () => {
    await enqueueOutboxEntry({
      id: 'entry-1',
      kind: 'user-block-state',
      payloadRef: { blocked: true, targetUserId: 'target' },
      userId: 'user-1',
    });

    await updateOutboxEntry('user-1', 'entry-1', {
      attempt: 1,
      lastError: 'timeout',
      state: 'failed',
    });
    expect(await readOutboxEntries('user-1')).toMatchObject([
      { attempt: 1, id: 'entry-1', lastError: 'timeout', state: 'failed' },
    ]);

    await removeOutboxEntry('user-1', 'entry-1');
    await expect(readOutboxEntries('user-1')).resolves.toEqual([]);

    await enqueueOutboxEntry({
      id: 'entry-2',
      kind: 'notification-read',
      payloadRef: { notificationId: 'notification-2' },
      userId: 'user-1',
    });
    await clearOutboxForUser('user-1');
    await expect(readOutboxEntries('user-1')).resolves.toEqual([]);
  });
});
