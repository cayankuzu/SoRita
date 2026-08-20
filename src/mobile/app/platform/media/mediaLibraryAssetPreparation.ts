import { Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

import type {
  MediaLibraryPickerAsset,
  MediaLibrarySelectionFilter,
} from '@/mobile/app/platform/media/mediaLibrarySelectionTypes';
import { generateVideoThumbnailUri } from '@/mobile/app/platform/media/videoThumbnails';

const PREVIEW_BUILD_CONCURRENCY = 4;
const IOS_NETWORK_PREVIEW_CONCURRENCY = 3;
const iosNetworkPreviewQueue: Array<() => void> = [];
let activeIosNetworkPreviews = 0;

async function withIosNetworkPreviewSlot<T>(operation: () => Promise<T>) {
  if (activeIosNetworkPreviews >= IOS_NETWORK_PREVIEW_CONCURRENCY) {
    await new Promise<void>((resolve) => iosNetworkPreviewQueue.push(resolve));
  }

  activeIosNetworkPreviews += 1;

  try {
    return await operation();
  } finally {
    activeIosNetworkPreviews -= 1;
    iosNetworkPreviewQueue.shift()?.();
  }
}

export function buildMediaTypeFilter(
  filter: MediaLibrarySelectionFilter,
  allowVideos: boolean,
): MediaLibrary.MediaTypeValue[] {
  if (!allowVideos && filter === 'video') {
    return [MediaLibrary.MediaType.photo];
  }

  if (filter === 'photo') {
    return [MediaLibrary.MediaType.photo];
  }

  if (filter === 'video') {
    return [MediaLibrary.MediaType.video];
  }

  return allowVideos
    ? [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video]
    : [MediaLibrary.MediaType.photo];
}

export function buildSelectionCounts(selectedAssets: MediaLibraryPickerAsset[]) {
  return selectedAssets.reduce(
    (totals, asset) => {
      if (asset.mediaType === 'video') {
        totals.videos += 1;
      } else {
        totals.photos += 1;
      }

      totals.total += 1;
      return totals;
    },
    { photos: 0, total: 0, videos: 0 },
  );
}

export function buildAndroidMediaStoreUri(
  asset: Pick<MediaLibrary.Asset, 'id' | 'mediaType'>,
) {
  if (asset.mediaType === 'video') {
    return `content://media/external/video/media/${asset.id}`;
  }

  if (asset.mediaType === 'photo') {
    return `content://media/external/images/media/${asset.id}`;
  }

  return null;
}

export async function hydratePickerAssetFromNetwork(
  asset: MediaLibraryPickerAsset,
): Promise<MediaLibraryPickerAsset> {
  if (Platform.OS !== 'ios') {
    return asset;
  }

  return withIosNetworkPreviewSlot(async () => {
    try {
      const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.id, {
        shouldDownloadFromNetwork: true,
      });
      const localUri = assetInfo.localUri || undefined;

      if (!localUri) {
        return asset;
      }

      const previewUri = asset.mediaType === 'video'
        ? (await generateVideoThumbnailUri(localUri, 0)) || localUri
        : localUri;

      return {
        ...asset,
        duration: assetInfo.duration,
        height: assetInfo.height,
        localUri,
        previewUri,
        uri: localUri,
        width: assetInfo.width,
      };
    } catch {
      return asset;
    }
  });
}

async function buildPickerAssetPreview(
  asset: MediaLibrary.Asset,
): Promise<MediaLibraryPickerAsset | null> {
  if (asset.mediaType !== 'photo' && asset.mediaType !== 'video') {
    return null;
  }

  const androidMediaStoreUri =
    Platform.OS === 'android' ? buildAndroidMediaStoreUri(asset) : null;
  let assetInfo: Awaited<ReturnType<typeof MediaLibrary.getAssetInfoAsync>> | null = null;

  if (Platform.OS !== 'android') {
    try {
      assetInfo = await MediaLibrary.getAssetInfoAsync(asset, {
        shouldDownloadFromNetwork: false,
      });
    } catch {
      assetInfo = null;
    }
  }

  const localUri = assetInfo?.localUri || undefined;
  // Android's file:///storage/emulated/0 paths are blocked by scoped storage
  // on several OS/vendor combinations. MediaStore content URIs retain the
  // permission granted by expo-media-library and work in both ExpoImage and FS.
  const resolvedAssetUri = androidMediaStoreUri || localUri || asset.uri;
  let previewUri = resolvedAssetUri;

  if (asset.mediaType === 'video') {
    previewUri =
      (await generateVideoThumbnailUri(resolvedAssetUri, 0)) ||
      resolvedAssetUri;
  }

  return {
    creationTime: asset.creationTime,
    duration: asset.duration,
    filename: asset.filename,
    height: asset.height,
    id: asset.id,
    localUri,
    mediaType: asset.mediaType,
    previewUri,
    uri: resolvedAssetUri,
    width: asset.width,
  } satisfies MediaLibraryPickerAsset;
}

export async function buildPickerAssetsPage(assets: MediaLibrary.Asset[]) {
  const preparedAssets: MediaLibraryPickerAsset[] = [];

  for (let index = 0; index < assets.length; index += PREVIEW_BUILD_CONCURRENCY) {
    const chunk = assets.slice(index, index + PREVIEW_BUILD_CONCURRENCY);
    const nextChunk = (
      await Promise.all(chunk.map((asset) => buildPickerAssetPreview(asset)))
    ).filter((asset): asset is MediaLibraryPickerAsset => Boolean(asset));

    preparedAssets.push(...nextChunk);

    if (index + PREVIEW_BUILD_CONCURRENCY < assets.length) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return preparedAssets;
}
