import { Image } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat, type Action } from 'expo-image-manipulator';

import { logger } from '@/mobile/app/platform/feedback/logger';
import {
  getLocalMediaFileExtension,
  persistLocalUriToFile,
} from '@/mobile/app/platform/media/localFiles';
import { createUuid } from '@/shared/utils/id';

// Where picked photos and videos are kept until they are uploaded, and how
// photos are sized for upload: at most 720p, and a lighter copy for grids.
const PICKED_MEDIA_DIR = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? ''}picked-media/`;
const PLACE_MEDIA_MAX_LANDSCAPE_WIDTH = 1280;
const PLACE_MEDIA_MAX_LANDSCAPE_HEIGHT = 720;
const PLACE_MEDIA_MAX_PORTRAIT_WIDTH = 720;
const PLACE_MEDIA_MAX_PORTRAIT_HEIGHT = 1280;
const PLACE_MEDIA_IMAGE_COMPRESSION = 0.86;
const PLACE_MEDIA_THUMBNAIL_LONG_EDGE_PX = 640;
const PLACE_MEDIA_THUMBNAIL_COMPRESSION = 0.76;

function pickedMediaPath(extension: string) {
  return `${PICKED_MEDIA_DIR}${createUuid()}.${extension}`;
}

export function buildPickedMediaPath(uri: string, fileName?: string | null) {
  return pickedMediaPath(getLocalMediaFileExtension(fileName || uri));
}

function buildJpegFileName(fileName?: string | null) {
  const baseName = (fileName || 'place-photo').replace(/\.[^.]+$/, '').trim() || 'place-photo';
  return `${baseName}.jpg`;
}

function readImageDimensions(
  uri: string,
  fallbackWidth?: number | null,
  fallbackHeight?: number | null,
) {
  if (typeof fallbackWidth === 'number' && fallbackWidth > 0 && typeof fallbackHeight === 'number' && fallbackHeight > 0) {
    return Promise.resolve({ height: fallbackHeight, width: fallbackWidth });
  }

  return new Promise<{ height: number; width: number } | null>((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ height, width }),
      () => resolve(null),
    );
  });
}

function calculateMediaImageResize(width: number, height: number) {
  const isLandscape = width >= height;
  const maxWidth = isLandscape ? PLACE_MEDIA_MAX_LANDSCAPE_WIDTH : PLACE_MEDIA_MAX_PORTRAIT_WIDTH;
  const maxHeight = isLandscape ? PLACE_MEDIA_MAX_LANDSCAPE_HEIGHT : PLACE_MEDIA_MAX_PORTRAIT_HEIGHT;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);

  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

// Re-encodes an image as JPEG into the picked-media folder and removes the
// manipulator's temporary copy.
async function writeJpeg(uri: string, actions: Action[], compress: number) {
  const result = await manipulateAsync(uri, actions, { compress, format: SaveFormat.JPEG });
  const finalUri =
    (await persistLocalUriToFile({ targetPath: pickedMediaPath('jpg'), uri: result.uri })) ||
    result.uri;

  if (result.uri !== finalUri) {
    await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
  }

  return { ...result, uri: finalUri };
}

export async function optimizePickedImageAsset(params: {
  fileName?: string | null;
  height?: number | null;
  mimeType?: string | null;
  uri: string;
  width?: number | null;
}) {
  const dimensions = await readImageDimensions(params.uri, params.width, params.height);
  const targetSize =
    dimensions && dimensions.width > 0 && dimensions.height > 0
      ? calculateMediaImageResize(dimensions.width, dimensions.height)
      : null;

  try {
    const optimized = await writeJpeg(
      params.uri,
      targetSize ? [{ resize: targetSize }] : [],
      PLACE_MEDIA_IMAGE_COMPRESSION,
    );

    if (params.uri !== optimized.uri) {
      await FileSystem.deleteAsync(params.uri, { idempotent: true }).catch(() => undefined);
    }

    return {
      fileName: buildJpegFileName(params.fileName),
      height: optimized.height || targetSize?.height || dimensions?.height || undefined,
      mimeType: 'image/jpeg',
      uri: optimized.uri,
      width: optimized.width || targetSize?.width || dimensions?.width || undefined,
    };
  } catch {
    return {
      fileName: params.fileName ?? undefined,
      height: dimensions?.height || undefined,
      mimeType: params.mimeType ?? undefined,
      uri: params.uri,
      width: dimensions?.width || undefined,
    };
  }
}

export async function generatePlacePhotoThumbnailUri(params: {
  height?: number;
  uri: string;
  width?: number;
}) {
  const dimensions = await readImageDimensions(params.uri, params.width, params.height);

  if (!dimensions) {
    return undefined;
  }

  const longestEdge = Math.max(dimensions.width, dimensions.height);
  if (longestEdge <= PLACE_MEDIA_THUMBNAIL_LONG_EDGE_PX) {
    return undefined;
  }

  const scale = PLACE_MEDIA_THUMBNAIL_LONG_EDGE_PX / longestEdge;
  const targetSize = {
    height: Math.max(1, Math.round(dimensions.height * scale)),
    width: Math.max(1, Math.round(dimensions.width * scale)),
  };

  try {
    const thumbnail = await writeJpeg(
      params.uri,
      [{ resize: targetSize }],
      PLACE_MEDIA_THUMBNAIL_COMPRESSION,
    );
    return thumbnail.uri;
  } catch (error) {
    logger.debug('media', 'Photo thumbnail generation failed; full image will be used.', error);
    return undefined;
  }
}
