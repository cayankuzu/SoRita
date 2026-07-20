import { enqueueDurableOutboxEntry } from '@/mobile/app/data/outbox/enqueueDurableOutboxEntry';
import { trackEvent } from '@/mobile/app/platform/analytics/analyticsEvents';
import { logger } from '@/mobile/app/platform/feedback/logger';
import {
  deleteStorageAssetsByUrls,
  type MediaBucket,
} from '@/mobile/app/platform/supabase/media';

function normalizeUrls(urls: Array<string | null | undefined>) {
  return Array.from(new Set(urls.filter((url): url is string => Boolean(url))));
}

export async function queueStorageAssetsCleanup(params: {
  bucket: MediaBucket;
  urls: Array<string | null | undefined>;
  userId: string;
}) {
  const urls = normalizeUrls(params.urls);

  if (urls.length === 0) {
    return;
  }

  await enqueueDurableOutboxEntry({
    kind: 'media-cleanup',
    payloadRef: { bucket: params.bucket, urls },
    userId: params.userId,
  });
}

export async function deleteStorageAssetsWithRetry(params: {
  bucket: MediaBucket;
  urls: Array<string | null | undefined>;
  userId: string;
}) {
  const urls = normalizeUrls(params.urls);

  if (urls.length === 0) {
    return;
  }

  try {
    await deleteStorageAssetsByUrls({ bucket: params.bucket, urls });
  } catch (error) {
    await queueStorageAssetsCleanup({ ...params, urls });
    trackEvent({
      name: 'media_orphan_cleanup_queued',
      params: { bucket: params.bucket, count: urls.length },
    });
    logger.warn('media', 'Storage cleanup queued for retry.', error);
  }
}

export function scheduleStorageAssetsCleanup(params: {
  bucket: MediaBucket;
  urls: Array<string | null | undefined>;
  userId: string;
}) {
  void deleteStorageAssetsWithRetry(params).catch((error) => {
    logger.warn('media', 'Storage cleanup could not be scheduled.', error);
  });
}
