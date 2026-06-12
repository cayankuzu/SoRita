import * as FileSystem from 'expo-file-system/legacy';

import { env } from '@/mobile/app/platform/config/env';
import { createSignedEdgeHeaders } from '@/mobile/app/platform/security/requestSigning';
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

const TEMP_UPLOAD_DIR = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ''}media-upload-cache/`;

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

async function readLocalMediaAsBase64(uri: string) {
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

function getFunctionUrl(functionName: string) {
  const baseUrl = env.supabaseUrl.replace(/\/+$/, '');
  return `${baseUrl}/functions/v1/${functionName}`;
}

async function wait(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function getAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  if (!session?.access_token) {
    throw new Error('Aktif oturum bulunamadi. Lutfen tekrar giris yap.');
  }

  return session.access_token;
}

async function refreshAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.refreshSession();

  if (error) {
    throw new Error(error.message);
  }

  if (!session?.access_token) {
    throw new Error('Oturum yenilenemedi. Lutfen tekrar giris yap.');
  }

  return session.access_token;
}

async function readMediaFunctionError(response: Response) {
  const responseText = await response.text().catch(() => '');
  const trimmedResponseText = responseText.trim();

  if (trimmedResponseText) {
    try {
      const payload = JSON.parse(trimmedResponseText);

      if (payload && typeof payload === 'object') {
        if ('error' in payload && typeof payload.error === 'string' && payload.error.trim()) {
          return payload.error;
        }

        if ('message' in payload && typeof payload.message === 'string' && payload.message.trim()) {
          return payload.message;
        }
      }
    } catch {
      return trimmedResponseText;
    }
  }

  return response.statusText || `Media request failed (${response.status})`;
}

async function performMediaFunctionRequest<TPayload extends Record<string, unknown>>(
  payload: TPayload,
  accessToken: string,
) {
  const bodyText = JSON.stringify(payload);
  const signedHeaders = await createSignedEdgeHeaders({
    accessToken,
    bodyText,
  });

  return fetch(getFunctionUrl(env.supabaseMediaAssetsFunctionName), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: env.supabasePublishableKey,
      'Content-Type': 'application/json',
      ...signedHeaders,
    },
    body: bodyText,
  });
}

function isRetriableMediaStatus(status: number) {
  return status === 502 || status === 503 || status === 504;
}

const MAX_MEDIA_REQUEST_ATTEMPTS = 3;

async function callMediaFunction<TPayload extends Record<string, unknown>, TResult>(
  payload: TPayload,
): Promise<TResult> {
  let accessToken = await getAccessToken();
  let refreshedSessionAfterUnauthorized = false;

  for (let attempt = 0; attempt < MAX_MEDIA_REQUEST_ATTEMPTS; attempt += 1) {
    const response = await performMediaFunctionRequest(payload, accessToken);

    if (response.ok) {
      return (await response.json()) as TResult;
    }

    if (response.status === 401 && !refreshedSessionAfterUnauthorized) {
      accessToken = await refreshAccessToken();
      refreshedSessionAfterUnauthorized = true;
      continue;
    }

    if (isRetriableMediaStatus(response.status) && attempt < MAX_MEDIA_REQUEST_ATTEMPTS - 1) {
      await wait(300 * (attempt + 1));
      continue;
    }

    throw new Error(await readMediaFunctionError(response));
  }

  throw new Error('Media request failed');
}

export async function uploadImageAsset(params: {
  bucket: 'profile-media' | 'place-media';
  userId: string;
  uri?: string;
  prefix: string;
}) {
  const { bucket, uri, prefix } = params;

  if (!uri) {
    return undefined;
  }

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }

  const extension = getFileExtension(uri);
  const base64File = await readLocalMediaAsBase64(uri);
  const result = await callMediaFunction<
    {
      action: 'upload';
      bucket: 'profile-media' | 'place-media';
      contentType: string;
      extension: string;
      fileBase64: string;
      prefix: string;
    },
    { publicUrl: string }
  >({
    action: 'upload',
    bucket,
    contentType: getContentType(extension),
    extension,
    fileBase64: base64File,
    prefix,
  });

  return result.publicUrl;
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

  await callMediaFunction<
    {
      action: 'delete';
      bucket: 'profile-media' | 'place-media';
      paths: string[];
    },
    { success: true }
  >({
    action: 'delete',
    bucket: params.bucket,
    paths,
  });
}
