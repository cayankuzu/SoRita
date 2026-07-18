import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { NativeModules, Platform } from 'react-native';

import { logger } from '@/mobile/app/platform/feedback/logger';

const GALLERY_DOWNLOAD_DIR = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ''}gallery-downloads/`;

type SoritaGallerySaverModule = {
  saveToGallery: (uri: string, fileName?: string | null, mimeType?: string | null) => Promise<string>;
};

function getMimeTypeExtension(mimeType?: string | null) {
  if (!mimeType) {
    return null;
  }

  const normalizedMimeType = mimeType.trim().toLowerCase();

  if (normalizedMimeType === 'image/jpeg') {
    return 'jpg';
  }

  if (normalizedMimeType.startsWith('image/')) {
    return normalizedMimeType.split('/')[1] || 'jpg';
  }

  if (normalizedMimeType.startsWith('video/')) {
    return normalizedMimeType.split('/')[1] || 'mp4';
  }

  return null;
}

function resolveFileExtension({
  fileName,
  mimeType,
  uri,
}: {
  fileName?: string | null;
  mimeType?: string | null;
  uri: string;
}) {
  const normalizedSource = (fileName || uri).split('?')[0] || '';
  const explicitExtension = normalizedSource.split('.').pop()?.toLowerCase();

  if (explicitExtension && explicitExtension.length <= 5) {
    return explicitExtension;
  }

  return getMimeTypeExtension(mimeType) || 'jpg';
}

async function ensureParentDirectory(targetPath: string) {
  const parentDirectory = targetPath.split('/').slice(0, -1).join('/');

  if (!parentDirectory) {
    return;
  }

  const directoryInfo = await FileSystem.getInfoAsync(parentDirectory);

  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(parentDirectory, { intermediates: true });
  }
}

async function ensureGalleryPermission() {
  try {
    if (
      typeof MediaLibrary.isAvailableAsync !== 'function' ||
      typeof MediaLibrary.requestPermissionsAsync !== 'function' ||
      typeof MediaLibrary.saveToLibraryAsync !== 'function'
    ) {
      logger.warn('gallery', 'Media library APIs are unavailable in this build.');
      return false;
    }

    const isAvailable = await MediaLibrary.isAvailableAsync();

    if (!isAvailable) {
      logger.warn('gallery', 'Media library is unavailable on this device.');
      return false;
    }

    const permission = await MediaLibrary.requestPermissionsAsync(true);

    if (!permission.granted) {
      logger.warn('gallery', 'Gallery save permission was denied.');
      return false;
    }

    return true;
  } catch (error) {
    logger.warn('gallery', 'Failed to request gallery save permission.', error);
    return false;
  }
}

function isRemoteUri(uri: string) {
  return uri.startsWith('http://') || uri.startsWith('https://');
}

function getNativeAndroidGallerySaver() {
  if (Platform.OS !== 'android') {
    return null;
  }

  const candidate = (NativeModules as Record<string, unknown>).SoritaGallerySaver as
    | SoritaGallerySaverModule
    | undefined;

  return candidate && typeof candidate.saveToGallery === 'function' ? candidate : null;
}

function buildDownloadTargetPath(uri: string, fileName?: string | null, mimeType?: string | null) {
  const extension = resolveFileExtension({ fileName, mimeType, uri });
  const uniqueKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${GALLERY_DOWNLOAD_DIR}${uniqueKey}.${extension}`;
}

export async function saveUriToGallery(params: {
  fileName?: string | null;
  mimeType?: string | null;
  uri?: string | null;
}) {
  const { fileName, mimeType, uri } = params;

  if (!uri) {
    return false;
  }

  let localUri = uri;
  let shouldCleanup = false;

  try {
    if (isRemoteUri(uri)) {
      const targetPath = buildDownloadTargetPath(uri, fileName, mimeType);
      await ensureParentDirectory(targetPath);

      const downloadResult = await FileSystem.downloadAsync(uri, targetPath);
      localUri = downloadResult.uri;
      shouldCleanup = true;
    }

    const nativeAndroidGallerySaver = getNativeAndroidGallerySaver();

    if (nativeAndroidGallerySaver) {
      await nativeAndroidGallerySaver.saveToGallery(localUri, fileName, mimeType);
      return true;
    }

    const hasPermission = await ensureGalleryPermission();

    if (!hasPermission) {
      return false;
    }

    await MediaLibrary.saveToLibraryAsync(localUri);
    return true;
  } catch (error) {
    logger.warn('gallery', 'Media could not be saved to gallery.', error);
    return false;
  } finally {
    if (shouldCleanup) {
      await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined);
    }
  }
}
