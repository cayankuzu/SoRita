import * as FileSystem from 'expo-file-system/legacy';

const TEMP_UPLOAD_DIR = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ''}media-upload-cache/`;

export function getContentType(extension: string) {
  switch (extension) {
    case 'mov':
      return 'video/quicktime';
    case 'mp4':
      return 'video/mp4';
    case 'm4v':
      return 'video/x-m4v';
    case 'png':
      return 'image/png';
    case '3gp':
      return 'video/3gpp';
    case 'webp':
      return 'image/webp';
    case 'webm':
      return 'video/webm';
    case 'heic':
      return 'image/heic';
    case 'jpg':
    case 'jpeg':
    default:
      return 'image/jpeg';
  }
}

export function getFileExtension(uri: string) {
  const cleanUri = uri.split('?')[0] || uri;
  const extension = cleanUri.split('.').pop()?.toLowerCase();
  return extension && extension.length <= 8 ? extension : 'jpg';
}

async function ensureTempUploadDirectory() {
  if (!TEMP_UPLOAD_DIR) {
    return null;
  }

  const directoryInfo = await FileSystem.getInfoAsync(TEMP_UPLOAD_DIR);

  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(TEMP_UPLOAD_DIR, { intermediates: true });
  }

  return TEMP_UPLOAD_DIR;
}

function buildTempUploadPath(uri: string) {
  const extension = getFileExtension(uri);
  const uniqueKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${TEMP_UPLOAD_DIR}${uniqueKey}.${extension}`;
}

async function copyToReadableUploadPath(uri: string) {
  const directory = await ensureTempUploadDirectory();

  if (!directory) {
    return null;
  }

  const tempPath = buildTempUploadPath(uri);
  await FileSystem.copyAsync({
    from: uri,
    to: tempPath,
  });
  return tempPath;
}

export async function readLocalMediaAsBase64(uri: string) {
  try {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (readError) {
    let tempPath: string | null = null;

    try {
      tempPath = await copyToReadableUploadPath(uri);

      if (!tempPath) {
        throw readError;
      }

      return await FileSystem.readAsStringAsync(tempPath, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } finally {
      if (tempPath) {
        await FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => undefined);
      }
    }
  }
}

export async function readLocalMediaSize(uri: string) {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);

    if (fileInfo.exists && typeof fileInfo.size === 'number') {
      return fileInfo.size;
    }
  } catch {
    // Fall through to the readable-temp-path fallback below.
  }

  let tempPath: string | null = null;

  try {
    tempPath = await copyToReadableUploadPath(uri);

    if (!tempPath) {
      throw new Error('Media file size could not be determined.');
    }

    const tempFileInfo = await FileSystem.getInfoAsync(tempPath);

    if (!tempFileInfo.exists || typeof tempFileInfo.size !== 'number') {
      throw new Error('Media file size could not be determined.');
    }

    return tempFileInfo.size;
  } finally {
    if (tempPath) {
      await FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => undefined);
    }
  }
}
