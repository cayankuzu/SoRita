import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

import { logger } from '@/mobile/app/platform/feedback/logger';
import { clearAppImagePrefetchQueue } from '@/mobile/app/shared/components/ui/AppImage';

/** Drops speculative work immediately when the operating system reports pressure. */
export function MediaMemoryController() {
  useEffect(() => {
    const subscription = AppState.addEventListener('memoryWarning', () => {
      clearAppImagePrefetchQueue();
      void ExpoImage.clearMemoryCache().catch((error) => {
        logger.debug('image-cache', 'Failed to clear image memory cache', error);
      });
    });

    return () => subscription.remove();
  }, []);

  return null;
}
