import { useEffect } from 'react';
import { totalMemory } from 'expo-device';
import { setVideoCacheSizeAsync } from 'expo-video';

import { logger } from '@/mobile/app/platform/feedback/logger';
import {
  VIDEO_CACHE_DEFAULT_BYTES,
  VIDEO_CACHE_LOW_MEMORY_BYTES,
} from '@/mobile/app/shared/performance/budgets';

const LOW_MEMORY_THRESHOLD_BYTES = 4 * 1024 * 1024 * 1024;
let configured = false;

function getVideoCacheBudget() {
  return totalMemory != null && totalMemory < LOW_MEMORY_THRESHOLD_BYTES
    ? VIDEO_CACHE_LOW_MEMORY_BYTES
    : VIDEO_CACHE_DEFAULT_BYTES;
}

export function VideoCacheController() {
  useEffect(() => {
    if (configured) {
      return;
    }

    configured = true;
    void setVideoCacheSizeAsync(getVideoCacheBudget()).catch((error) => {
      configured = false;
      logger.debug('video-cache', 'Failed to configure video cache budget', error);
    });
  }, []);

  return null;
}

export const videoCacheControllerInternals = {
  getVideoCacheBudget,
  LOW_MEMORY_THRESHOLD_BYTES,
};
