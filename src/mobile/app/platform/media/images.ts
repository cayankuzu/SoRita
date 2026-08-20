import { Image, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';

import {
  inferPlaceMediaType,
  type PlaceMedia,
} from '@/mobile/app/contracts/placeMedia';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { saveUriToGallery } from '@/mobile/app/platform/media/gallery';
import {
  isPlaceMediaFileSizeExceeded,
  readLocalMediaFileSize,
} from '@/mobile/app/platform/media/placeMediaSize';
import { openMediaLibrarySelection } from '@/mobile/app/platform/media/mediaLibrarySelectionController';
import {
  PLACE_MEDIA_MAX_ACCEPTED_VIDEO_DURATION_MS,
  PLACE_MEDIA_MAX_VIDEO_DURATION_MS,
  PLACE_MEDIA_MAX_VIDEO_DURATION_SECONDS,
} from '@/mobile/app/platform/media/mediaConstants';
import { openMediaPickerPrompt } from '@/mobile/app/platform/media/mediaPickerPromptController';
import { openVideoCameraCapture } from '@/mobile/app/platform/media/videoCameraCaptureController';
import {
  getLocalMediaFileExtension,
  persistLocalUriToFile,
} from '@/mobile/app/platform/media/localFiles';
import type {
  CameraCaptureMode,
  MediaPickerPromptOptions,
  PickedImageSource,
} from '@/mobile/app/platform/media/mediaPickerTypes';
import type { MediaLibraryPickerAsset } from '@/mobile/app/platform/media/mediaLibrarySelectionTypes';
import { generateVideoThumbnailUri } from '@/mobile/app/platform/media/videoThumbnails';

const PICKED_MEDIA_DIR = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? ''}picked-media/`;
const PLACE_MEDIA_MAX_LANDSCAPE_WIDTH = 1280;
const PLACE_MEDIA_MAX_LANDSCAPE_HEIGHT = 720;
const PLACE_MEDIA_MAX_PORTRAIT_WIDTH = 720;
const PLACE_MEDIA_MAX_PORTRAIT_HEIGHT = 1280;
const PLACE_MEDIA_IMAGE_COMPRESSION = 0.86;
const PLACE_MEDIA_THUMBNAIL_LONG_EDGE_PX = 640;
const PLACE_MEDIA_THUMBNAIL_COMPRESSION = 0.76;
const IOS_MEDIA_PROMPT_DISMISS_DELAY_MS = 320;

type PickImagesOptions = {
  allowMultiple?: boolean;
  allowVideos?: boolean;
  cameraCaptureMode?: CameraCaptureMode;
  cropAspect?: [number, number];
  cropShape?: ImagePicker.CropShape;
  maxSelection?: number;
  saveToGallery?: boolean;
};

export type PickPlaceMediaResult = {
  items: PlaceMedia[];
  rejectedOversizeCount: number;
  rejectedVideoCount: number;
};

function shouldUseNativeEditing(options: PickImagesOptions = {}) {
  return !options.allowMultiple && Boolean(options.cropAspect || options.cropShape);
}

function shouldUseNativeSingleImageLibraryFlow(options: MediaPickerPromptOptions = {}) {
  return !options.allowMultiple && Boolean(options.cropAspect || options.cropShape);
}

function buildPickedMediaPath(uri: string, fileName?: string | null) {
  const extension = getLocalMediaFileExtension(fileName || uri);
  const uniqueKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${PICKED_MEDIA_DIR}${uniqueKey}.${extension}`;
}

function buildPickedMediaPathWithExtension(extension: string) {
  const safeExtension = extension.trim().replace(/^\.+/, '').toLowerCase() || 'jpg';
  const uniqueKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${PICKED_MEDIA_DIR}${uniqueKey}.${safeExtension}`;
}

function buildJpegFileName(fileName?: string | null) {
  const baseName = (fileName || 'place-photo').replace(/\.[^.]+$/, '').trim() || 'place-photo';
  return `${baseName}.jpg`;
}

function readImageDimensions(
  uri: string,
  fallbackWidth?: number | null,
  fallbackHeight?: number | null,
) {
  if (typeof fallbackWidth === 'number' && fallbackWidth > 0 && typeof fallbackHeight === 'number' && fallbackHeight > 0) {
    return Promise.resolve({ height: fallbackHeight, width: fallbackWidth });
  }

  return new Promise<{ height: number; width: number } | null>((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ height, width }),
      () => resolve(null),
    );
  });
}

function calculateMediaImageResize(width: number, height: number) {
  const isLandscape = width >= height;
  const maxWidth = isLandscape ? PLACE_MEDIA_MAX_LANDSCAPE_WIDTH : PLACE_MEDIA_MAX_PORTRAIT_WIDTH;
  const maxHeight = isLandscape ? PLACE_MEDIA_MAX_LANDSCAPE_HEIGHT : PLACE_MEDIA_MAX_PORTRAIT_HEIGHT;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);

  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

async function optimizePickedImageAsset(params: {
  fileName?: string | null;
  height?: number | null;
  mimeType?: string | null;
  uri: string;
  width?: number | null;
}) {
  const dimensions = await readImageDimensions(params.uri, params.width, params.height);
  const targetSize =
    dimensions && dimensions.width > 0 && dimensions.height > 0
      ? calculateMediaImageResize(dimensions.width, dimensions.height)
      : null;

  try {
    const optimized = await manipulateAsync(
      params.uri,
      targetSize ? [{ resize: targetSize }] : [],
      {
        compress: PLACE_MEDIA_IMAGE_COMPRESSION,
        format: SaveFormat.JPEG,
      },
    );
    const finalUri =
      (await persistLocalUriToFile({
        targetPath: buildPickedMediaPathWithExtension('jpg'),
        uri: optimized.uri,
      })) || optimized.uri;

    if (params.uri !== finalUri) {
      await FileSystem.deleteAsync(params.uri, { idempotent: true }).catch(() => undefined);
    }

    if (optimized.uri !== finalUri) {
      await FileSystem.deleteAsync(optimized.uri, { idempotent: true }).catch(() => undefined);
    }

    return {
      fileName: buildJpegFileName(params.fileName),
      height: optimized.height || targetSize?.height || dimensions?.height || undefined,
      mimeType: 'image/jpeg',
      uri: finalUri,
      width: optimized.width || targetSize?.width || dimensions?.width || undefined,
    };
  } catch {
    return {
      fileName: params.fileName ?? undefined,
      height: dimensions?.height || undefined,
      mimeType: params.mimeType ?? undefined,
      uri: params.uri,
      width: dimensions?.width || undefined,
    };
  }
}

async function generatePlacePhotoThumbnailUri(params: {
  height?: number;
  uri: string;
  width?: number;
}) {
  const dimensions = await readImageDimensions(params.uri, params.width, params.height);

  if (!dimensions) {
    return undefined;
  }

  const longestEdge = Math.max(dimensions.width, dimensions.height);
  if (longestEdge <= PLACE_MEDIA_THUMBNAIL_LONG_EDGE_PX) {
    return undefined;
  }

  const scale = PLACE_MEDIA_THUMBNAIL_LONG_EDGE_PX / longestEdge;
  const targetSize = {
    height: Math.max(1, Math.round(dimensions.height * scale)),
    width: Math.max(1, Math.round(dimensions.width * scale)),
  };

  try {
    const thumbnail = await manipulateAsync(
      params.uri,
      [{ resize: targetSize }],
      {
        compress: PLACE_MEDIA_THUMBNAIL_COMPRESSION,
        format: SaveFormat.JPEG,
      },
    );
    const finalUri =
      (await persistLocalUriToFile({
        targetPath: buildPickedMediaPathWithExtension('jpg'),
        uri: thumbnail.uri,
      })) || thumbnail.uri;

    if (thumbnail.uri !== finalUri) {
      await FileSystem.deleteAsync(thumbnail.uri, { idempotent: true }).catch(() => undefined);
    }

    return finalUri;
  } catch (error) {
    logger.debug('media', 'Photo thumbnail generation failed; full image will be used.', error);
    return undefined;
  }
}

function buildPickerOptions(source: PickedImageSource, options: PickImagesOptions = {}) {
  const allowMultiple = Boolean(options.allowMultiple && source === 'library');
  const isVideoCameraCapture = source === 'camera' && options.cameraCaptureMode === 'video';
  const useNativeEditing = !allowMultiple && !isVideoCameraCapture && shouldUseNativeEditing(options);
  const useLegacyLibraryPicker =
    Platform.OS === 'android' && source === 'library' && !allowMultiple && !useNativeEditing;
  const shouldTranscodeIosLibraryVideo =
    Platform.OS === 'ios' && source === 'library' && Boolean(options.allowVideos);
  // On Android, mixed camera media types fall back to image capture, so video recording
  // must be requested explicitly when the user chooses the camera video path.
  const mediaTypes =
    source === 'camera' && options.cameraCaptureMode === 'video'
      ? (['videos'] as ImagePicker.MediaType[])
      : source === 'camera' && options.cameraCaptureMode === 'photo'
        ? (['images'] as ImagePicker.MediaType[])
        : options.allowVideos
          ? (['images', 'videos'] as ImagePicker.MediaType[])
          : (['images'] as ImagePicker.MediaType[]);

  return {
    aspect: useNativeEditing ? options.cropAspect : undefined,
    allowsEditing: useNativeEditing,
    allowsMultipleSelection: allowMultiple,
    base64: false,
    defaultTab: source === 'library' ? ('photos' as const) : undefined,
    // Native Android crop flow is unstable with some DocumentsUI/legacy picker providers.
    // Keep the modern picker for single-image crop flows and reserve legacy only for plain picks.
    legacy: useLegacyLibraryPicker,
    mediaTypes,
    orderedSelection: allowMultiple,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    quality: 0.9,
    selectionLimit: allowMultiple ? options.maxSelection ?? 0 : 1,
    shape: useNativeEditing ? options.cropShape : undefined,
    shouldDownloadFromNetwork: true,
    videoExportPreset: shouldTranscodeIosLibraryVideo
      ? ImagePicker.VideoExportPreset.H264_1280x720
      : undefined,
    videoMaxDuration:
      options.allowVideos || isVideoCameraCapture
        ? PLACE_MEDIA_MAX_VIDEO_DURATION_SECONDS
        : undefined,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.IFrame1280x720,
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
  const saved = await saveUriToGallery({ uri });

  if (!saved) {
    logger.warn('media', 'Selected media could not be saved to gallery.');
  }
}

async function waitForIosMediaPromptDismissal() {
  if (Platform.OS !== 'ios') {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, IOS_MEDIA_PROMPT_DISMISS_DELAY_MS);
  });
}

async function promptForImageSource(options?: MediaPickerPromptOptions) {
  // iOS can only present one modal view controller at a time. When "Add
  // media" is tapped, React batches the caller's own state update (e.g.
  // setIsAddingMedia(true)) together with this prompt's visible=true change
  // into the same commit, so the picker sheet's presentation request can
  // race with the host modal's own re-render and silently no-op, leaving the
  // UI stuck on its loading state. Deferring by a tick lets the host modal's
  // update settle first so the picker sheet reliably appears.
  await waitForIosMediaPromptDismissal();
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

async function resolveCustomLibraryAssetSourceUri(asset: MediaLibraryPickerAsset) {
  if (asset.localUri) {
    return asset.localUri;
  }

  if (Platform.OS !== 'ios') {
    return asset.uri;
  }

  try {
    const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.id, {
      shouldDownloadFromNetwork: true,
    });

    return assetInfo.localUri || assetInfo.uri || asset.uri;
  } catch {
    return asset.uri;
  }
}

async function persistCustomLibraryAssetUri(asset: MediaLibraryPickerAsset) {
  const sourceUri = await resolveCustomLibraryAssetSourceUri(asset);

  return persistLocalUriToFile({
    targetPath: buildPickedMediaPath(sourceUri, asset.filename),
    uri: sourceUri,
  });
}

async function pickImagesFromCustomLibrarySelection(
  options: MediaPickerPromptOptions = {},
) {
  const librarySelection = await openMediaLibrarySelection({
    allowVideos: false,
    disabledFilters: ['all', 'video'],
    initialFilter: 'photo',
    maxSelection: options.maxSelection ?? (options.allowMultiple ? undefined : 1),
    remainingPhotos: options.remainingPhotos,
    remainingVideos: 0,
    visibleFilters: ['all', 'photo', 'video'],
  });

  if (!librarySelection || librarySelection.length === 0) {
    return [] as string[];
  }

  const persistedUris = (
    await Promise.all(
      librarySelection.map(async (asset) => {
        if (asset.mediaType !== 'photo') {
          return null;
        }

        const localUri = await persistCustomLibraryAssetUri(asset);

        if (!localUri) {
          return null;
        }

        const normalizedImage = await optimizePickedImageAsset({
          fileName: asset.filename,
          height: asset.height,
          uri: localUri,
          width: asset.width,
        });

        return normalizedImage.uri;
      }),
    )
  ).filter((uri): uri is string => Boolean(uri));

  return persistedUris;
}

function shouldSavePickedAssetToGallery(
  source: PickedImageSource,
  saveToGallery: boolean | undefined,
) {
  return source === 'camera' && saveToGallery !== false;
}

function isInAppVideoCameraCapture(
  source: PickedImageSource,
  options: PickImagesOptions,
) {
  return source === 'camera' && options.cameraCaptureMode === 'video';
}

async function normalizePickedImage(params: {
  fileName?: string | null;
  height?: number | null;
  mimeType?: string | null;
  uri: string;
  width?: number | null;
}) {
  return optimizePickedImageAsset({
    fileName: params.fileName,
    height: params.height,
    mimeType: params.mimeType,
    uri: params.uri,
    width: params.width,
  });
}

async function normalizePickedPlaceMedia(params: {
  fileName?: string | null;
  height?: number | null;
  mimeType?: string | null;
  type: PlaceMedia['type'];
  uri: string;
  width?: number | null;
}) {
  if (params.type !== 'photo') {
    return {
      fileName: params.fileName ?? undefined,
      height: params.height || undefined,
      mimeType: params.mimeType ?? undefined,
      uri: params.uri,
      width: params.width || undefined,
    };
  }

  return normalizePickedImage(params);
}

async function capturePlaceVideoWithInAppCamera(
  options: PickImagesOptions = {},
): Promise<PickPlaceMediaResult> {
  const capture = await openVideoCameraCapture({
    maxDurationSeconds: PLACE_MEDIA_MAX_VIDEO_DURATION_SECONDS,
  });

  if (!capture?.uri) {
    return { items: [], rejectedOversizeCount: 0, rejectedVideoCount: 0 };
  }

  const captureFileName = capture.uri.split('/').pop() || '';
  const fallbackFileName = captureFileName.includes('.')
    ? captureFileName
    : 'camera-capture.mp4';
  const localUri = await persistLocalUriToFile({
    targetPath: buildPickedMediaPath(capture.uri, fallbackFileName),
    uri: capture.uri,
  });

  if (!localUri) {
    return { items: [], rejectedOversizeCount: 0, rejectedVideoCount: 0 };
  }

  const fileSizeBytes = await readLocalMediaFileSize(localUri);

  if (isPlaceMediaFileSizeExceeded(fileSizeBytes)) {
    return { items: [], rejectedOversizeCount: 1, rejectedVideoCount: 0 };
  }

  if (shouldSavePickedAssetToGallery('camera', options.saveToGallery)) {
    await saveMediaToGallery(localUri);
  }

  const durationMs = Math.min(capture.durationMs, PLACE_MEDIA_MAX_VIDEO_DURATION_MS);
  const thumbnailUrl = await generateVideoThumbnailUri(localUri, 0);

  return {
    items: [
      {
        durationMs,
        thumbnailTimeMs: 0,
        thumbnailUrl,
        type: 'video',
        url: localUri,
      } satisfies PlaceMedia,
    ],
    rejectedOversizeCount: 0,
    rejectedVideoCount: 0,
  };
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

        if (!localUri) {
          return null;
        }

        const normalizedImage = await normalizePickedImage({
          fileName: selectedAsset.fileName,
          height: selectedAsset.height,
          mimeType: selectedAsset.mimeType,
          uri: localUri,
          width: selectedAsset.width,
        });

        if (shouldSavePickedAssetToGallery(source, options.saveToGallery)) {
          await saveMediaToGallery(normalizedImage.uri);
        }

        return normalizedImage.uri;
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

  if (!firstImage) {
    return null;
  }

  return firstImage;
}

export async function pickImagesFromPrompt(options: MediaPickerPromptOptions = {}) {
  const selection = await promptForImageSource(options);

  if (!selection) {
    return [] as string[];
  }

  await waitForIosMediaPromptDismissal();

  if (selection.source === 'library') {
    if (shouldUseNativeSingleImageLibraryFlow(options)) {
      return pickImages('library', {
        allowMultiple: Boolean(options.allowMultiple),
        cropAspect: options.cropAspect,
        cropShape: options.cropShape,
        maxSelection: options.maxSelection ?? (options.allowMultiple ? undefined : 1),
        saveToGallery: selection.saveToGallery,
      });
    }

    return pickImagesFromCustomLibrarySelection(options);
  }

  return pickImages(selection.source, {
    allowMultiple: options.allowMultiple,
    cameraCaptureMode: selection.cameraCaptureMode,
    cropAspect: options.cropAspect,
    cropShape: options.cropShape,
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
  if (isInAppVideoCameraCapture(source, options)) {
    return capturePlaceVideoWithInAppCamera(options);
  }

  const permission = await requestImagePermission(source);

  if (!permission.granted) {
    return { items: [], rejectedOversizeCount: 0, rejectedVideoCount: 0 };
  }

  const result = await launchImagePicker(source, {
    ...options,
    allowVideos: true,
  });

  if (result.canceled || result.assets.length === 0) {
    return { items: [], rejectedOversizeCount: 0, rejectedVideoCount: 0 };
  }

  let rejectedOversizeCount = 0;
  let rejectedVideoCount = 0;
  const pickedItems = (
    await Promise.all(
      result.assets.map(async (selectedAsset) => {
        const type = inferPlaceMediaType({
          mimeType: selectedAsset.mimeType,
          url: selectedAsset.uri,
        });
        const durationMs = selectedAsset.duration ?? undefined;

        if (
          type === 'video' &&
          durationMs &&
          durationMs > PLACE_MEDIA_MAX_ACCEPTED_VIDEO_DURATION_MS
        ) {
          rejectedVideoCount += 1;
          return null;
        }

        const localUri = await persistPickedAssetUri(selectedAsset);

        if (!localUri) {
          return null;
        }

        const normalizedMedia = await normalizePickedPlaceMedia({
          fileName: selectedAsset.fileName,
          height: selectedAsset.height,
          mimeType: selectedAsset.mimeType,
          type,
          uri: localUri,
          width: selectedAsset.width,
        });

        const fileSizeBytes =
          type === 'video' && typeof selectedAsset.fileSize === 'number'
            ? selectedAsset.fileSize
            : await readLocalMediaFileSize(normalizedMedia.uri);

        if (isPlaceMediaFileSizeExceeded(fileSizeBytes)) {
          rejectedOversizeCount += 1;
          return null;
        }

        if (shouldSavePickedAssetToGallery(source, options.saveToGallery)) {
          await saveMediaToGallery(normalizedMedia.uri);
        }

        const thumbnailUrl = type === 'video'
          ? await generateVideoThumbnailUri(normalizedMedia.uri, 0)
          : await generatePlacePhotoThumbnailUri({
              height: normalizedMedia.height,
              uri: normalizedMedia.uri,
              width: normalizedMedia.width,
            });

        return {
          durationMs,
          fileName: normalizedMedia.fileName,
          height: normalizedMedia.height,
          mimeType: normalizedMedia.mimeType,
          thumbnailTimeMs: type === 'video' ? 0 : undefined,
          thumbnailUrl,
          type,
          url: normalizedMedia.uri,
          width: normalizedMedia.width,
        } satisfies PlaceMedia;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => Boolean(item?.url));

  return {
    items: pickedItems,
    rejectedOversizeCount,
    rejectedVideoCount,
  };
}

export async function pickPlaceMediaFromPrompt(options: MediaPickerPromptOptions = {}) {
  const allowVideos = options.allowVideos ?? true;
  const selection = await promptForImageSource({
    ...options,
    allowVideos,
    cameraCaptureModes:
      options.cameraCaptureModes ?? (allowVideos ? ['photo', 'video'] : ['photo']),
  });

  if (!selection) {
    return { items: [], rejectedOversizeCount: 0, rejectedVideoCount: 0 } satisfies PickPlaceMediaResult;
  }

  await waitForIosMediaPromptDismissal();

  if (selection.source === 'library') {
    const librarySelection = await openMediaLibrarySelection({
      allowVideos,
      initialFilter: allowVideos ? 'all' : 'photo',
      maxSelection: options.maxSelection,
      remainingPhotos: options.remainingPhotos,
      remainingVideos: options.remainingVideos,
    });

    if (!librarySelection || librarySelection.length === 0) {
      return { items: [], rejectedOversizeCount: 0, rejectedVideoCount: 0 } satisfies PickPlaceMediaResult;
    }

    let rejectedOversizeCount = 0;
    let rejectedVideoCount = 0;
    const items = (
      await Promise.all(
        librarySelection.map(async (asset) => {
          const type = asset.mediaType === 'video' ? 'video' : 'photo';
          const durationMs =
            type === 'video' && asset.duration > 0 ? Math.round(asset.duration * 1000) : undefined;

          if (
            type === 'video' &&
            durationMs &&
            durationMs > PLACE_MEDIA_MAX_ACCEPTED_VIDEO_DURATION_MS
          ) {
            rejectedVideoCount += 1;
            return null;
          }

          const localUri = await persistCustomLibraryAssetUri(asset);

          if (!localUri) {
            return null;
          }

          const normalizedMedia = await normalizePickedPlaceMedia({
            fileName: asset.filename,
            height: asset.height,
            type,
            uri: localUri,
            width: asset.width,
          });

          const fileSizeBytes = await readLocalMediaFileSize(normalizedMedia.uri);

          if (isPlaceMediaFileSizeExceeded(fileSizeBytes)) {
            rejectedOversizeCount += 1;
            return null;
          }

          const thumbnailUrl = type === 'video'
            ? await generateVideoThumbnailUri(normalizedMedia.uri, 0)
            : await generatePlacePhotoThumbnailUri({
                height: normalizedMedia.height,
                uri: normalizedMedia.uri,
                width: normalizedMedia.width,
              });

          return {
            durationMs,
            fileName: normalizedMedia.fileName,
            height: normalizedMedia.height,
            mimeType: normalizedMedia.mimeType,
            thumbnailTimeMs: type === 'video' ? 0 : undefined,
            thumbnailUrl,
            type,
            url: normalizedMedia.uri,
            width: normalizedMedia.width,
          } satisfies PlaceMedia;
        }),
      )
    ).filter((item): item is NonNullable<typeof item> => Boolean(item?.url));

    return { items, rejectedOversizeCount, rejectedVideoCount } satisfies PickPlaceMediaResult;
  }

  return pickPlaceMedia(selection.source, {
    allowMultiple: options.allowMultiple,
    allowVideos,
    cameraCaptureMode: selection.cameraCaptureMode,
    maxSelection: options.maxSelection,
    saveToGallery: selection.saveToGallery,
  });
}
