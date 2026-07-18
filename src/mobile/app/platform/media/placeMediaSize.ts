import * as FileSystem from 'expo-file-system/legacy';

import type { PlaceMedia } from '@/mobile/app/contracts/placeMedia';
import {
  PLACE_MEDIA_MAX_VIDEO_DURATION_SECONDS,
  PLACE_MEDIA_TARGET_VIDEO_BITRATE,
} from '@/mobile/app/platform/media/mediaConstants';

const PLACE_MEDIA_AUDIO_BITRATE_HEADROOM = 192_000;
const PLACE_MEDIA_CONTAINER_HEADROOM_RATIO = 1.15;
const PLACE_MEDIA_UPLOAD_SIZE_HEADROOM_SECONDS = 5;
const BYTES_IN_MB = 1024 * 1024;

const estimated720pVideoBytes = Math.ceil(
  ((PLACE_MEDIA_TARGET_VIDEO_BITRATE + PLACE_MEDIA_AUDIO_BITRATE_HEADROOM) *
    (PLACE_MEDIA_MAX_VIDEO_DURATION_SECONDS + PLACE_MEDIA_UPLOAD_SIZE_HEADROOM_SECONDS) *
    PLACE_MEDIA_CONTAINER_HEADROOM_RATIO) /
    8,
);

export const PLACE_MEDIA_MAX_FILE_SIZE_BYTES = estimated720pVideoBytes;
export const PLACE_MEDIA_MAX_FILE_SIZE_MB = Math.ceil(
  PLACE_MEDIA_MAX_FILE_SIZE_BYTES / BYTES_IN_MB,
);

function isRemoteUri(uri: string) {
  return uri.startsWith('http://') || uri.startsWith('https://');
}

export function isPlaceMediaFileSizeExceeded(fileSizeBytes?: number | null) {
  return typeof fileSizeBytes === 'number' && fileSizeBytes > PLACE_MEDIA_MAX_FILE_SIZE_BYTES;
}

export async function readLocalMediaFileSize(uri?: string | null) {
  if (!uri || isRemoteUri(uri)) {
    return null;
  }

  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);

    if (fileInfo.exists && typeof fileInfo.size === 'number') {
      return fileInfo.size;
    }
  } catch {
    // Ignore unreadable local URIs; save-time checks will fall back to upload validation.
  }

  return null;
}

export async function findFirstOversizedPlaceMedia(media: PlaceMedia[]) {
  for (const [index, item] of media.entries()) {
    const fileSizeBytes = await readLocalMediaFileSize(item.url);

    if (isPlaceMediaFileSizeExceeded(fileSizeBytes)) {
      return {
        fileSizeBytes,
        index,
        item,
      };
    }
  }

  return null;
}
