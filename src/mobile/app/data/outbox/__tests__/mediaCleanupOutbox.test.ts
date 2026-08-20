import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearAllOutboxEntries,
  readOutboxEntries,
} from '@/mobile/app/data/outbox/outboxStorage';

const deleteStorageAssetsByUrlsMock = vi.fn();
const trackEventMock = vi.fn();
const warnMock = vi.fn();

vi.mock('@/mobile/app/platform/supabase/media', () => ({
  deleteStorageAssetsByUrls: deleteStorageAssetsByUrlsMock,
}));

vi.mock('@/mobile/app/platform/analytics/analyticsEvents', () => ({
  trackEvent: trackEventMock,
}));

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: { warn: warnMock },
}));

describe('mediaCleanupOutbox', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearAllOutboxEntries();
  });

  it('deletes deduplicated assets immediately when cleanup succeeds', async () => {
    deleteStorageAssetsByUrlsMock.mockResolvedValue(undefined);
    const { deleteStorageAssetsWithRetry } = await import('@/mobile/app/data/outbox/mediaCleanupOutbox');

    await deleteStorageAssetsWithRetry({
      bucket: 'place-media',
      urls: ['asset-1', 'asset-1', null],
      userId: 'user-1',
    });

    expect(deleteStorageAssetsByUrlsMock).toHaveBeenCalledWith({
      bucket: 'place-media',
      urls: ['asset-1'],
    });
    await expect(readOutboxEntries('user-1')).resolves.toEqual([]);
  });

  it('queues failed cleanup and emits an orphan metric', async () => {
    deleteStorageAssetsByUrlsMock.mockRejectedValue(new Error('network failed'));
    const { deleteStorageAssetsWithRetry } = await import('@/mobile/app/data/outbox/mediaCleanupOutbox');

    await deleteStorageAssetsWithRetry({
      bucket: 'profile-media',
      urls: ['asset-1'],
      userId: 'user-1',
    });

    await expect(readOutboxEntries('user-1')).resolves.toEqual([
      expect.objectContaining({
        kind: 'media-cleanup',
        payloadRef: { bucket: 'profile-media', urls: ['asset-1'] },
      }),
    ]);
    expect(trackEventMock).toHaveBeenCalledWith({
      name: 'media_orphan_cleanup_queued',
      params: { bucket: 'profile-media', count: 1 },
    });
    expect(warnMock).toHaveBeenCalled();
  });

  it('does nothing for an empty cleanup set', async () => {
    const { deleteStorageAssetsWithRetry, queueStorageAssetsCleanup } = await import('@/mobile/app/data/outbox/mediaCleanupOutbox');

    await deleteStorageAssetsWithRetry({
      bucket: 'place-media',
      urls: [null, undefined],
      userId: 'user-1',
    });

    expect(deleteStorageAssetsByUrlsMock).not.toHaveBeenCalled();
    await expect(queueStorageAssetsCleanup({
      bucket: 'place-media',
      urls: [null, undefined],
      userId: 'user-1',
    })).resolves.toBeUndefined();
    await expect(readOutboxEntries('user-1')).resolves.toEqual([]);
  });

  it('starts post-commit cleanup without blocking the caller', async () => {
    let resolveDelete!: () => void;
    deleteStorageAssetsByUrlsMock.mockReturnValue(new Promise<void>((resolve) => {
      resolveDelete = resolve;
    }));
    const { scheduleStorageAssetsCleanup } = await import(
      '@/mobile/app/data/outbox/mediaCleanupOutbox'
    );

    expect(scheduleStorageAssetsCleanup({
      bucket: 'place-media',
      urls: ['old.jpg'],
      userId: 'user-1',
    })).toBeUndefined();
    expect(deleteStorageAssetsByUrlsMock).toHaveBeenCalledOnce();
    resolveDelete();
    await Promise.resolve();
  });
});
