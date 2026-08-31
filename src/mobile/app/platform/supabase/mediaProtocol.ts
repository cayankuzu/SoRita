import { env } from '@/mobile/app/platform/config/env';

export type PublicMediaBucket = 'profile-media' | 'place-media';
export type PrivateMediaBucket = 'place-media-private';
export type MediaBucket = PublicMediaBucket | PrivateMediaBucket;
export type StorageAssetRef = {
  bucket: MediaBucket;
  path: string;
};

export const PRIVATE_PLACE_MEDIA_BUCKET: PrivateMediaBucket = 'place-media-private';

const STORAGE_ASSET_SCHEME = 'sorita-storage://';
const TRUSTED_MEDIA_HOSTS = new Set([
  'maps.googleapis.com',
  (() => {
    try {
      return new URL(env.supabaseUrl).hostname;
    } catch {
      return '';
    }
  })(),
].filter(Boolean));

export function isAllowedMediaUri(uri: string) {
  if (/^(asset|content|file|ph):\/\//i.test(uri)) {
    return true;
  }

  try {
    const parsed = new URL(uri);
    return parsed.protocol === 'https:' && TRUSTED_MEDIA_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function assertAllowedMediaUri(uri: string) {
  if (!isAllowedMediaUri(uri)) {
    throw new Error('Media URL host is not trusted.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertOwnedStoragePath(value: unknown, expectedUserId: string) {
  if (
    typeof value !== 'string'
    || value.length > 512
    || !value.startsWith(`${expectedUserId}/`)
    || !/^[a-zA-Z0-9/_.,-]+$/.test(value)
    || value.includes('..')
  ) {
    throw new Error('Media service returned an invalid storage path.');
  }

  return value;
}

function assertSignedStorageUploadUrl(value: unknown) {
  if (typeof value !== 'string') {
    throw new Error('Media service returned an invalid signed upload URL.');
  }

  try {
    const signedUrl = new URL(value);
    const expectedOrigin = new URL(env.supabaseUrl).origin;

    if (
      signedUrl.protocol !== 'https:'
      || signedUrl.origin !== expectedOrigin
      || !signedUrl.pathname.startsWith('/storage/v1/object/upload/')
    ) {
      throw new Error('untrusted');
    }
  } catch {
    throw new Error('Media service returned an invalid signed upload URL.');
  }

  return value;
}

export function parsePreparedUpload(
  value: unknown,
  expectedUserId: string,
  expectedUploadSessionId: string,
) {
  if (!isRecord(value)) {
    throw new Error('Media service returned an invalid upload preparation.');
  }

  if (value.uploadSessionId !== expectedUploadSessionId) {
    throw new Error('Media service returned an invalid upload session.');
  }

  return {
    objectPath: assertOwnedStoragePath(value.objectPath, expectedUserId),
    signedUrl: assertSignedStorageUploadUrl(value.signedUrl),
    uploadSessionId: expectedUploadSessionId,
  };
}

export function parseFinalizedPublicUpload(
  value: unknown,
  bucket: PublicMediaBucket,
  expectedUserId: string,
) {
  if (!isRecord(value) || value.verified !== true || typeof value.publicUrl !== 'string') {
    throw new Error('Media service returned an invalid upload finalization.');
  }

  const objectPath = assertOwnedStoragePath(value.objectPath, expectedUserId);
  const publicUrl = new URL(value.publicUrl);
  const expectedOrigin = new URL(env.supabaseUrl).origin;
  const expectedPathPrefix = `/storage/v1/object/public/${bucket}/`;

  if (
    publicUrl.protocol !== 'https:'
    || publicUrl.origin !== expectedOrigin
    || !publicUrl.pathname.startsWith(expectedPathPrefix)
  ) {
    throw new Error('Media service returned an invalid public media URL.');
  }

  return { objectPath, publicUrl: value.publicUrl };
}

export function parseFinalizedPrivateUpload(value: unknown, expectedUserId: string) {
  if (!isRecord(value) || value.verified !== true) {
    throw new Error('Media service returned an invalid upload finalization.');
  }

  const objectPath = assertOwnedStoragePath(value.objectPath, expectedUserId);
  const storageUri = typeof value.storageUri === 'string' ? value.storageUri : undefined;

  if (storageUri) {
    const storageRef = parseStorageAssetUri(storageUri);

    if (storageRef?.bucket !== PRIVATE_PLACE_MEDIA_BUCKET || storageRef.path !== objectPath) {
      throw new Error('Media service returned an invalid private media reference.');
    }
  }

  return { objectPath, storageUri };
}

export function buildStorageAssetUri(bucket: MediaBucket, path: string) {
  return `${STORAGE_ASSET_SCHEME}${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export function isStorageAssetUri(value?: string | null) {
  return Boolean(value?.startsWith(STORAGE_ASSET_SCHEME));
}

export function parseStorageAssetUri(value: string): StorageAssetRef | null {
  if (!isStorageAssetUri(value)) {
    return null;
  }

  try {
    const parsedUrl = new URL(value);
    const bucket = parsedUrl.hostname as MediaBucket;

    if (!['profile-media', 'place-media', PRIVATE_PLACE_MEDIA_BUCKET].includes(bucket)) {
      return null;
    }

    const path = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));

    if (!path || path.includes('..')) {
      return null;
    }

    return { bucket, path };
  } catch {
    return null;
  }
}

export function getStorageAssetRef(
  fallbackBucket: MediaBucket,
  url?: string | null,
): StorageAssetRef | null {
  if (!url) {
    return null;
  }

  const storageAssetRef = parseStorageAssetUri(url);

  if (storageAssetRef) {
    return storageAssetRef;
  }

  try {
    const normalizedUrl = new URL(url);
    const pathMatch = normalizedUrl.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);

    if (!pathMatch) {
      return null;
    }

    const [, bucketName, encodedPath] = pathMatch;

    if (bucketName !== fallbackBucket) {
      return null;
    }

    return {
      bucket: fallbackBucket,
      path: decodeURIComponent(encodedPath),
    };
  } catch {
    return null;
  }
}

export function isPublicPlaceMediaAsset(value?: string | null) {
  return getStorageAssetRef('place-media', value)?.bucket === 'place-media';
}
