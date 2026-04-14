import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

import { supabase } from '@/mobile/app/platform/supabase/client';

function getContentType(extension: string) {
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'jpg':
    case 'jpeg':
    default:
      return 'image/jpeg';
  }
}

function getFileExtension(uri: string) {
  const cleanUri = uri.split('?')[0] || uri;
  const extension = cleanUri.split('.').pop()?.toLowerCase();
  return extension && extension.length <= 5 ? extension : 'jpg';
}

function getStoragePathFromPublicUrl(
  bucket: 'profile-media' | 'place-media',
  url?: string | null,
) {
  if (!url) {
    return null;
  }

  try {
    const normalizedUrl = new URL(url);
    const pathMatch = normalizedUrl.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);

    if (!pathMatch) {
      return null;
    }

    const [, bucketName, encodedPath] = pathMatch;

    if (bucketName !== bucket) {
      return null;
    }

    return decodeURIComponent(encodedPath);
  } catch {
    return null;
  }
}

export async function uploadImageAsset(params: {
  bucket: 'profile-media' | 'place-media';
  userId: string;
  uri?: string;
  prefix: string;
}) {
  const { bucket, userId, uri, prefix } = params;

  if (!uri) {
    return undefined;
  }

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }

  const extension = getFileExtension(uri);
  const fileName = `${userId}/${prefix}-${Date.now()}.${extension}`;
  const base64File = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const { error } = await supabase.storage.from(bucket).upload(fileName, decode(base64File), {
    contentType: getContentType(extension),
    upsert: true,
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
}

export async function deleteStorageAssetsByUrls(params: {
  bucket: 'profile-media' | 'place-media';
  urls: Array<string | null | undefined>;
}) {
  const paths = Array.from(
    new Set(
      params.urls
        .map((url) => getStoragePathFromPublicUrl(params.bucket, url))
        .filter((path): path is string => Boolean(path)),
    ),
  );

  if (!paths.length) {
    return;
  }

  const { error } = await supabase.storage.from(params.bucket).remove(paths);

  if (error) {
    throw error;
  }
}
