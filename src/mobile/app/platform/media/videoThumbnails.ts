import { requireOptionalNativeModule } from 'expo-modules-core';

import { logger } from '@/mobile/app/platform/feedback/logger';

const VIDEO_THUMBNAIL_QUALITY = 0.72;

type ExpoVideoThumbnailsModule = {
  getThumbnail: (
    sourceFilename: string,
    options: {
      quality: number;
      time: number;
    },
  ) => Promise<{ uri: string }>;
};

let cachedVideoThumbnailsModule: ExpoVideoThumbnailsModule | null | undefined;
let didWarnAboutMissingModule = false;

function getVideoThumbnailsModule() {
  if (cachedVideoThumbnailsModule !== undefined) {
    return cachedVideoThumbnailsModule;
  }

  cachedVideoThumbnailsModule =
    requireOptionalNativeModule<ExpoVideoThumbnailsModule>('ExpoVideoThumbnails');

  if (!cachedVideoThumbnailsModule && !didWarnAboutMissingModule) {
    didWarnAboutMissingModule = true;
    logger.warn('media', 'ExpoVideoThumbnails native module is unavailable in this build.');
  }

  return cachedVideoThumbnailsModule;
}

export async function generateVideoThumbnailUri(uri: string, timeMs = 0) {
  const videoThumbnails = getVideoThumbnailsModule();

  if (!videoThumbnails?.getThumbnail) {
    return undefined;
  }

  try {
    const result = await videoThumbnails.getThumbnail(uri, {
      quality: VIDEO_THUMBNAIL_QUALITY,
      time: Math.max(0, timeMs),
    });

    return result.uri;
  } catch (error) {
    logger.warn('media', 'Video thumbnail could not be generated.', error);
    return undefined;
  }
}
