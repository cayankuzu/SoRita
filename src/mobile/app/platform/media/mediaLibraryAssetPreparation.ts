import { Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

import type {
  MediaLibraryPickerAsset,
  MediaLibrarySelectionFilter,
} from '@/mobile/app/platform/media/mediaLibrarySelectionTypes';
import { generateVideoThumbnailUri } from '@/mobile/app/platform/media/videoThumbnails';

const PREVIEW_BUILD_CONCURRENCY = 4;

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

function buildAndroidMediaStorePreviewUri(
  asset: Pick<MediaLibrary.Asset, 'id' | 'mediaType'>,
) {
  if (Platform.OS !== 'android') {
    return null;
  }

  if (asset.mediaType === 'video') {
    return `content://media/external/video/media/${asset.id}`;
  }

  if (asset.mediaType === 'photo') {
    return `content://media/external/images/media/${asset.id}`;
  }

  return null;
}

async function buildPickerAssetPreview(
  asset: MediaLibrary.Asset,
): Promise<MediaLibraryPickerAsset | null> {
  if (asset.mediaType !== 'photo' && asset.mediaType !== 'video') {
    return null;
  }

  const androidPreviewUri = buildAndroidMediaStorePreviewUri(asset);
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
  const resolvedAssetUri = localUri || asset.uri;
  let previewUri = resolvedAssetUri;

  if (asset.mediaType === 'video') {
    previewUri =
      (await generateVideoThumbnailUri(resolvedAssetUri, 0)) ||
      androidPreviewUri ||
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
