import * as FileSystem from 'expo-file-system/legacy';

export function getLocalMediaFileExtension(uri: string) {
  const cleanUri = uri.split('?')[0] || uri;
  const extension = cleanUri.split('.').pop()?.toLowerCase();
  return extension && extension.length <= 5 ? extension : 'jpg';
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

export async function persistLocalUriToFile(params: {
  base64Value?: string | null;
  targetPath: string;
  uri?: string | null;
}) {
  const { base64Value, targetPath, uri } = params;

  if (!uri) {
    return undefined;
  }

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }

  try {
    await ensureParentDirectory(targetPath);

    const currentTargetInfo = await FileSystem.getInfoAsync(targetPath);

    if (currentTargetInfo.exists) {
      await FileSystem.deleteAsync(targetPath, { idempotent: true });
    }

    try {
      await FileSystem.copyAsync({
        from: uri,
        to: targetPath,
      });

      return targetPath;
    } catch {
      const readableBase64Value =
        base64Value ||
        (await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        }));

      await FileSystem.writeAsStringAsync(targetPath, readableBase64Value, {
        encoding: FileSystem.EncodingType.Base64,
      });

      return targetPath;
    }
  } catch {
    await FileSystem.deleteAsync(targetPath, { idempotent: true }).catch(() => undefined);
    return undefined;
  }
}
