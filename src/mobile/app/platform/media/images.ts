import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

import type { PlaceMedia } from '@/mobile/app/data/contracts/entities';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { openMediaLibrarySelection } from '@/mobile/app/platform/media/mediaLibrarySelectionController';
import { openMediaPickerPrompt } from '@/mobile/app/platform/media/mediaPickerPromptController';
import {
  getLocalMediaFileExtension,
  persistLocalUriToFile,
} from '@/mobile/app/platform/media/localFiles';
import type {
  MediaPickerPromptOptions,
  PickedImageSource,
} from '@/mobile/app/platform/media/mediaPickerTypes';
import type { MediaLibraryPickerAsset } from '@/mobile/app/platform/media/mediaLibrarySelectionTypes';
import { inferPlaceMediaType } from '@/mobile/app/shared/utils/placeMedia';

const PICKED_MEDIA_DIR = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? ''}picked-media/`;

export const PLACE_MEDIA_MAX_VIDEO_DURATION_SECONDS = 180;
export const PLACE_MEDIA_MAX_VIDEO_DURATION_MS = PLACE_MEDIA_MAX_VIDEO_DURATION_SECONDS * 1000;

type PickImagesOptions = {
  allowMultiple?: boolean;
  allowVideos?: boolean;
  maxSelection?: number;
  saveToGallery?: boolean;
};

export type PickPlaceMediaResult = {
  items: PlaceMedia[];
  rejectedVideoCount: number;
};

function buildPickedMediaPath(uri: string, fileName?: string | null) {
  const extension = getLocalMediaFileExtension(fileName || uri);
  const uniqueKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${PICKED_MEDIA_DIR}${uniqueKey}.${extension}`;
}

function buildPickerOptions(source: PickedImageSource, options: PickImagesOptions = {}) {
  const allowMultiple = Boolean(options.allowMultiple && source === 'library');

  return {
    allowsEditing: !allowMultiple,
    allowsMultipleSelection: allowMultiple,
    base64: false,
    defaultTab: source === 'library' ? ('photos' as const) : undefined,
    legacy: Platform.OS === 'android' && source === 'library' ? !allowMultiple : false,
    mediaTypes: options.allowVideos
      ? (['images', 'videos'] as ImagePicker.MediaType[])
      : (['images'] as ImagePicker.MediaType[]),
    orderedSelection: allowMultiple,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    quality: 0.9,
    selectionLimit: allowMultiple ? 0 : 1,
    shouldDownloadFromNetwork: true,
    videoMaxDuration: options.allowVideos ? PLACE_MEDIA_MAX_VIDEO_DURATION_SECONDS : undefined,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
  };
}

async function requestImagePermission(source: PickedImageSource) {
  return source === 'camera'
    ? ImagePicker.requestCameraPermissionsAsync()
    : ImagePicker.requestMediaLibraryPermissionsAsync();
}

async function launchImagePicker(source: PickedImageSource, options: PickImagesOptions) {
  return source === 'camera'
    ? ImagePicker.launchCameraAsync(buildPickerOptions(source, options))
    : ImagePicker.launchImageLibraryAsync(buildPickerOptions(source, options));
}

async function saveMediaToGallery(uri: string) {
  try {
    if (
      typeof MediaLibrary.isAvailableAsync !== 'function' ||
      typeof MediaLibrary.requestPermissionsAsync !== 'function' ||
      typeof MediaLibrary.saveToLibraryAsync !== 'function'
    ) {
      logger.warn(
        'media',
        'Selected media could not be saved to gallery because ExpoMediaLibrary is unavailable in this build.',
      );
      return;
    }

    const isAvailable = await MediaLibrary.isAvailableAsync();

    if (!isAvailable) {
      logger.warn(
        'media',
        'Selected media could not be saved to gallery because ExpoMediaLibrary is unavailable in this build.',
      );
      return;
    }

    const permission = await MediaLibrary.requestPermissionsAsync(true);

    if (!permission.granted) {
      logger.warn('media', 'Selected media was not saved to gallery because permission was denied.');
      return;
    }

    await MediaLibrary.saveToLibraryAsync(uri);
  } catch (error) {
    logger.warn('media', 'Selected media could not be saved to gallery.', error);
  }
}

function promptForImageSource(options?: MediaPickerPromptOptions) {
  return openMediaPickerPrompt(options);
}

async function persistPickedAssetUri(asset: ImagePicker.ImagePickerAsset) {
  const assetUri = asset.uri;

  return persistLocalUriToFile({
    base64Value: asset.base64,
    targetPath: buildPickedMediaPath(assetUri, asset.fileName),
    uri: assetUri,
  });
}

async function persistCustomLibraryAssetUri(asset: MediaLibraryPickerAsset) {
  return persistLocalUriToFile({
    targetPath: buildPickedMediaPath(asset.uri, asset.filename),
    uri: asset.uri,
  });
}

function shouldSavePickedAssetToGallery(
  source: PickedImageSource,
  saveToGallery: boolean | undefined,
) {
  return source === 'camera' && saveToGallery !== false;
}

export async function pickImages(
  source: PickedImageSource = 'library',
  options: PickImagesOptions = {},
) {
  const permission = await requestImagePermission(source);

  if (!permission.granted) {
    return [] as string[];
  }

  const result = await launchImagePicker(source, {
    ...options,
    allowVideos: false,
  });

  if (result.canceled || result.assets.length === 0) {
    return [] as string[];
  }

  const localUris = (
    await Promise.all(
      result.assets.map(async (selectedAsset) => {
        const localUri = await persistPickedAssetUri(selectedAsset);

        if (localUri && shouldSavePickedAssetToGallery(source, options.saveToGallery)) {
          await saveMediaToGallery(localUri);
        }

        return localUri;
      }),
    )
  ).filter((uri): uri is string => Boolean(uri));

  return localUris;
}

export async function pickSingleImage(
  source: PickedImageSource = 'library',
  options: PickImagesOptions = {},
) {
  const [firstImage] = await pickImages(source, {
    ...options,
    allowMultiple: false,
    maxSelection: 1,
  });
  return firstImage || null;
}

export async function pickImagesFromPrompt(options: MediaPickerPromptOptions = {}) {
  const selection = await promptForImageSource(options);

  if (!selection) {
    return [] as string[];
  }

  return pickImages(selection.source, {
    allowMultiple: options.allowMultiple,
    maxSelection: options.maxSelection,
    saveToGallery: selection.saveToGallery,
  });
}

export async function pickSingleImageFromPrompt(options: MediaPickerPromptOptions = {}) {
  const [firstImage] = await pickImagesFromPrompt({
    ...options,
    allowMultiple: false,
    maxSelection: 1,
  });

  if (!firstImage) {
    return null;
  }

  return firstImage;
}

export async function pickPlaceMedia(
  source: PickedImageSource = 'library',
  options: PickImagesOptions = {},
): Promise<PickPlaceMediaResult> {
  const permission = await requestImagePermission(source);

  if (!permission.granted) {
    return { items: [], rejectedVideoCount: 0 };
  }

  const result = await launchImagePicker(source, {
    ...options,
    allowVideos: true,
  });

  if (result.canceled || result.assets.length === 0) {
    return { items: [], rejectedVideoCount: 0 };
  }

  let rejectedVideoCount = 0;
  const pickedItems = (
    await Promise.all(
      result.assets.map(async (selectedAsset) => {
        const type = inferPlaceMediaType({
          mimeType: selectedAsset.mimeType,
          url: selectedAsset.uri,
        });
        const durationMs = selectedAsset.duration ?? undefined;

        if (type === 'video' && durationMs && durationMs > PLACE_MEDIA_MAX_VIDEO_DURATION_MS) {
          rejectedVideoCount += 1;
          return null;
        }

        const localUri = await persistPickedAssetUri(selectedAsset);

        if (!localUri) {
          return null;
        }

        if (shouldSavePickedAssetToGallery(source, options.saveToGallery)) {
          await saveMediaToGallery(localUri);
        }

        return {
          durationMs,
          fileName: selectedAsset.fileName ?? undefined,
          height: selectedAsset.height || undefined,
          mimeType: selectedAsset.mimeType ?? undefined,
          type,
          url: localUri,
          width: selectedAsset.width || undefined,
        } satisfies PlaceMedia;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => Boolean(item?.url));

  return {
    items: pickedItems,
    rejectedVideoCount,
  };
}

export async function pickPlaceMediaFromPrompt(options: MediaPickerPromptOptions = {}) {
  const selection = await promptForImageSource({
    ...options,
    allowVideos: true,
  });

  if (!selection) {
    return { items: [], rejectedVideoCount: 0 } satisfies PickPlaceMediaResult;
  }

  if (selection.source === 'library') {
    const librarySelection = await openMediaLibrarySelection({
      allowVideos: true,
      initialFilter: options.allowVideos ? 'all' : 'photo',
      maxSelection: options.maxSelection,
      remainingPhotos: options.remainingPhotos,
      remainingVideos: options.remainingVideos,
    });

    if (!librarySelection || librarySelection.length === 0) {
      return { items: [], rejectedVideoCount: 0 } satisfies PickPlaceMediaResult;
    }

    let rejectedVideoCount = 0;
    const items = (
      await Promise.all(
        librarySelection.map(async (asset) => {
          const type = asset.mediaType === 'video' ? 'video' : 'photo';
          const durationMs =
            type === 'video' && asset.duration > 0 ? Math.round(asset.duration * 1000) : undefined;

          if (type === 'video' && durationMs && durationMs > PLACE_MEDIA_MAX_VIDEO_DURATION_MS) {
            rejectedVideoCount += 1;
            return null;
          }

          const localUri = await persistCustomLibraryAssetUri(asset);

          if (!localUri) {
            return null;
          }

          return {
            durationMs,
            fileName: asset.filename ?? undefined,
            height: asset.height || undefined,
            type,
            url: localUri,
            width: asset.width || undefined,
          } satisfies PlaceMedia;
        }),
      )
    ).filter((item): item is NonNullable<typeof item> => Boolean(item?.url));

    return { items, rejectedVideoCount } satisfies PickPlaceMediaResult;
  }

  return pickPlaceMedia(selection.source, {
    allowMultiple: options.allowMultiple,
    allowVideos: true,
    maxSelection: options.maxSelection,
    saveToGallery: selection.saveToGallery,
  });
}
