import { beforeEach, describe, expect, it, vi } from 'vitest';

const platformMock: { OS: 'android' | 'ios' | 'web' } = { OS: 'android' };
const getSizeMock = vi.fn();
const requestMediaLibraryPermissionsAsyncMock = vi.fn();
const requestCameraPermissionsAsyncMock = vi.fn();
const launchImageLibraryAsyncMock = vi.fn();
const launchCameraAsyncMock = vi.fn();
const manipulateAsyncMock = vi.fn();
const getMediaLibraryAssetInfoAsyncMock = vi.fn();
const getInfoAsyncMock = vi.fn();
const makeDirectoryAsyncMock = vi.fn();
const deleteAsyncMock = vi.fn();
const copyAsyncMock = vi.fn();
const readAsStringAsyncMock = vi.fn();
const writeAsStringAsyncMock = vi.fn();
const generateVideoThumbnailUriMock = vi.fn();
const openMediaLibrarySelectionMock = vi.fn();
const openMediaPickerPromptMock = vi.fn();
const openVideoCameraCaptureMock = vi.fn();
const saveUriToGalleryMock = vi.fn();

vi.mock('react-native', () => ({
  Image: {
    getSize: getSizeMock,
  },
  Platform: platformMock,
}));

vi.mock('expo-image-picker', () => ({
  VideoExportPreset: {
    H264_1280x720: 'h264_1280x720',
  },
  UIImagePickerControllerQualityType: {
    IFrame1280x720: 'iframe_1280x720',
  },
  UIImagePickerPreferredAssetRepresentationMode: {
    Compatible: 'compatible',
  },
  requestCameraPermissionsAsync: requestCameraPermissionsAsyncMock,
  requestMediaLibraryPermissionsAsync: requestMediaLibraryPermissionsAsyncMock,
  launchCameraAsync: launchCameraAsyncMock,
  launchImageLibraryAsync: launchImageLibraryAsyncMock,
}));

vi.mock('expo-image-manipulator', () => ({
  SaveFormat: {
    JPEG: 'jpeg',
  },
  manipulateAsync: manipulateAsyncMock,
}));

vi.mock('expo-media-library', () => ({
  getAssetInfoAsync: getMediaLibraryAssetInfoAsyncMock,
}));

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///documents/',
  EncodingType: {
    Base64: 'base64',
  },
  copyAsync: copyAsyncMock,
  deleteAsync: deleteAsyncMock,
  getInfoAsync: getInfoAsyncMock,
  makeDirectoryAsync: makeDirectoryAsyncMock,
  readAsStringAsync: readAsStringAsyncMock,
  writeAsStringAsync: writeAsStringAsyncMock,
}));

vi.mock('@/mobile/app/platform/media/videoThumbnails', () => ({
  generateVideoThumbnailUri: generateVideoThumbnailUriMock,
}));

vi.mock('@/mobile/app/platform/media/mediaLibrarySelectionController', () => ({
  openMediaLibrarySelection: openMediaLibrarySelectionMock,
}));

vi.mock('@/mobile/app/platform/media/mediaPickerPromptController', () => ({
  openMediaPickerPrompt: openMediaPickerPromptMock,
}));

vi.mock('@/mobile/app/platform/media/videoCameraCaptureController', () => ({
  openVideoCameraCapture: openVideoCameraCaptureMock,
}));

vi.mock('@/mobile/app/platform/media/gallery', () => ({
  saveUriToGallery: saveUriToGalleryMock,
}));

describe('platform/media/images', () => {
  beforeEach(() => {
    platformMock.OS = 'android';
    getSizeMock.mockReset();
    requestMediaLibraryPermissionsAsyncMock.mockReset();
    requestCameraPermissionsAsyncMock.mockReset();
    launchImageLibraryAsyncMock.mockReset();
    launchCameraAsyncMock.mockReset();
    manipulateAsyncMock.mockReset();
    getMediaLibraryAssetInfoAsyncMock.mockReset();
    getInfoAsyncMock.mockReset();
    makeDirectoryAsyncMock.mockReset();
    deleteAsyncMock.mockReset();
    copyAsyncMock.mockReset();
    readAsStringAsyncMock.mockReset();
    writeAsStringAsyncMock.mockReset();
    generateVideoThumbnailUriMock.mockReset();
    openMediaLibrarySelectionMock.mockReset();
    openMediaPickerPromptMock.mockReset();
    openVideoCameraCaptureMock.mockReset();
    saveUriToGalleryMock.mockReset();

    requestMediaLibraryPermissionsAsyncMock.mockResolvedValue({ granted: true });
    requestCameraPermissionsAsyncMock.mockResolvedValue({ granted: true });
    getSizeMock.mockImplementation((_uri, onSuccess) => onSuccess(2400, 1350));
    getMediaLibraryAssetInfoAsyncMock.mockResolvedValue({
      localUri: 'file:///cache/library-local.jpg',
      uri: 'ph://asset',
    });
    getInfoAsyncMock.mockResolvedValue({ exists: true });
    makeDirectoryAsyncMock.mockResolvedValue(undefined);
    deleteAsyncMock.mockResolvedValue(undefined);
    copyAsyncMock.mockResolvedValue(undefined);
    writeAsStringAsyncMock.mockResolvedValue(undefined);
    manipulateAsyncMock.mockImplementation(async (uri: string) => ({
      height: 810,
      uri: `${uri}-optimized.jpg`,
      width: 1440,
    }));
    generateVideoThumbnailUriMock.mockResolvedValue(undefined);
    saveUriToGalleryMock.mockResolvedValue(true);
  });

  it('persists the selected image into app storage before returning its path', async () => {
    launchImageLibraryAsyncMock.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'content://media/external/images/123', base64: 'Y29udGVudA==' }],
    });

    const { pickSingleImage } = await import('@/mobile/app/platform/media/images');
    const result = await pickSingleImage();

    expect(launchImageLibraryAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allowsEditing: false,
        base64: false,
        legacy: true,
        mediaTypes: ['images'],
        preferredAssetRepresentationMode: 'compatible',
        quality: 0.9,
        selectionLimit: 1,
        shouldDownloadFromNetwork: true,
      }),
    );
    expect(copyAsyncMock).toHaveBeenCalledWith({
      from: 'content://media/external/images/123',
      to: expect.stringMatching(/^file:\/\/\/documents\/picked-media\/.+\.jpg$/),
    });
    expect(manipulateAsyncMock).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/documents\/picked-media\/.+\.jpg$/),
      [{ resize: { height: 720, width: 1280 } }],
      {
        compress: 0.86,
        format: 'jpeg',
      },
    );
    expect(result).toMatch(/^file:\/\/\/documents\/picked-media\/.+\.jpg$/);
  });

  it('falls back to base64 write when direct copy fails', async () => {
    launchImageLibraryAsyncMock.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'content://media/external/images/123', base64: 'Y29udGVudA==' }],
    });
    getInfoAsyncMock.mockResolvedValueOnce({ exists: false }).mockResolvedValue({ exists: false });
    copyAsyncMock.mockRejectedValueOnce(new Error('copy failed'));

    const { pickSingleImage } = await import('@/mobile/app/platform/media/images');
    const result = await pickSingleImage();

    expect(makeDirectoryAsyncMock).toHaveBeenCalledWith('file:///documents/picked-media', {
      intermediates: true,
    });
    expect(writeAsStringAsyncMock).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/documents\/picked-media\/.+\.jpg$/),
      'Y29udGVudA==',
      { encoding: 'base64' },
    );
    expect(readAsStringAsyncMock).not.toHaveBeenCalled();
    expect(result).toMatch(/^file:\/\/\/documents\/picked-media\/.+\.jpg$/);
  });

  it('can capture a new photo from the camera', async () => {
    launchCameraAsyncMock.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/camera-shot.jpg', base64: 'Y2FtZXJh' }],
    });

    const { pickSingleImage } = await import('@/mobile/app/platform/media/images');
    const result = await pickSingleImage('camera');

    expect(requestCameraPermissionsAsyncMock).toHaveBeenCalledTimes(1);
    expect(launchCameraAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allowsEditing: false,
        base64: false,
        quality: 0.9,
      }),
    );
    expect(saveUriToGalleryMock).toHaveBeenCalledWith({
      uri: expect.stringMatching(/^file:\/\/\/documents\/picked-media\/.+\.jpg$/),
    });
    expect(saveUriToGalleryMock).toHaveBeenCalledTimes(1);
    expect(result).toMatch(/^file:\/\/\/documents\/picked-media\/.+\.jpg$/);
  });

  it('continues when gallery saving fails after camera capture', async () => {
    saveUriToGalleryMock.mockResolvedValueOnce(false);
    launchCameraAsyncMock.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/camera-shot.jpg', base64: 'Y2FtZXJh' }],
    });

    const { pickSingleImage } = await import('@/mobile/app/platform/media/images');
    const result = await pickSingleImage('camera');

    expect(result).toMatch(/^file:\/\/\/documents\/picked-media\/.+\.jpg$/);
    expect(saveUriToGalleryMock).toHaveBeenCalledWith({
      uri: expect.stringMatching(/^file:\/\/\/documents\/picked-media\/.+\.jpg$/),
    });
  });

  it('opens the in-app video recorder for place media capture', async () => {
    openMediaPickerPromptMock.mockResolvedValue({
      cameraCaptureMode: 'video',
      saveToGallery: true,
      source: 'camera',
    });
    openVideoCameraCaptureMock.mockResolvedValue({
      durationMs: 180000,
      uri: 'file:///cache/camera-video.mp4',
    });
    generateVideoThumbnailUriMock.mockResolvedValue('file:///cache/camera-video-thumb.jpg');

    const { pickPlaceMediaFromPrompt } = await import('@/mobile/app/platform/media/images');
    const result = await pickPlaceMediaFromPrompt();

    expect(openMediaPickerPromptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allowVideos: true,
        cameraCaptureModes: ['photo', 'video'],
      }),
    );
    expect(openVideoCameraCaptureMock).toHaveBeenCalledWith({ maxDurationSeconds: 180 });
    expect(launchCameraAsyncMock).not.toHaveBeenCalled();
    expect(requestCameraPermissionsAsyncMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          durationMs: 180000,
          thumbnailTimeMs: 0,
          thumbnailUrl: 'file:///cache/camera-video-thumb.jpg',
          type: 'video',
          url: expect.stringMatching(/^file:\/\/\/documents\/picked-media\/.+\.mp4$/),
        }),
      ],
      rejectedOversizeCount: 0,
      rejectedVideoCount: 0,
    });
    expect(saveUriToGalleryMock).toHaveBeenCalledWith({
      uri: expect.stringMatching(/^file:\/\/\/documents\/picked-media\/.+\.mp4$/),
    });
  });

  it('launches the native camera flow for place photo capture without in-app editing', async () => {
    openMediaPickerPromptMock.mockResolvedValue({
      cameraCaptureMode: 'photo',
      saveToGallery: true,
      source: 'camera',
    });
    launchCameraAsyncMock.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/camera-photo.jpg', base64: 'cGhvdG8=' }],
    });

    const { pickPlaceMediaFromPrompt } = await import('@/mobile/app/platform/media/images');
    const result = await pickPlaceMediaFromPrompt();

    expect(openVideoCameraCaptureMock).not.toHaveBeenCalled();
    expect(launchCameraAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allowsEditing: false,
        mediaTypes: ['images'],
      }),
    );
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          thumbnailUrl: expect.stringMatching(/^file:\/\/\/documents\/picked-media\/.+\.jpg$/),
          type: 'photo',
          url: expect.stringMatching(/^file:\/\/\/documents\/picked-media\/.+\.jpg$/),
        }),
      ],
      rejectedOversizeCount: 0,
      rejectedVideoCount: 0,
    });
    expect(manipulateAsyncMock).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/documents\/picked-media\/.+\.jpg$/),
      [{ resize: { height: 360, width: 640 } }],
      {
        compress: 0.76,
        format: 'jpeg',
      },
    );
  });

  it('returns null when permission is denied or the picker is canceled', async () => {
    requestMediaLibraryPermissionsAsyncMock.mockResolvedValueOnce({ granted: false });

    const { pickSingleImage } = await import('@/mobile/app/platform/media/images');
    await expect(pickSingleImage()).resolves.toBeNull();

    requestMediaLibraryPermissionsAsyncMock.mockResolvedValueOnce({ granted: true });
    launchImageLibraryAsyncMock.mockResolvedValueOnce({
      canceled: true,
      assets: [],
    });

    await expect(pickSingleImage()).resolves.toBeNull();
  });

  it('uses the native library crop flow for single-image prompt selections', async () => {
    openMediaPickerPromptMock.mockResolvedValue({
      saveToGallery: false,
      source: 'library',
    });
    launchImageLibraryAsyncMock.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'content://media/external/images/cover', base64: 'Y292ZXI=' }],
    });

    const { pickSingleImageFromPrompt } = await import('@/mobile/app/platform/media/images');
    const result = await pickSingleImageFromPrompt({
      cropAspect: [16, 9],
      cropShape: 'rectangle',
    });

    expect(openMediaLibrarySelectionMock).not.toHaveBeenCalled();
    expect(launchImageLibraryAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allowsEditing: true,
        aspect: [16, 9],
        legacy: false,
        shape: 'rectangle',
      }),
    );
    expect(copyAsyncMock).toHaveBeenCalledWith({
      from: 'content://media/external/images/cover',
      to: expect.stringMatching(/^file:\/\/\/documents\/picked-media\/.+\.jpg$/),
    });
    expect(result).toMatch(/^file:\/\/\/documents\/picked-media\/.+\.jpg$/);
  });

  it('returns null when the user cancels the native crop flow', async () => {
    openMediaPickerPromptMock.mockResolvedValue({
      saveToGallery: false,
      source: 'library',
    });
    launchImageLibraryAsyncMock.mockResolvedValueOnce({
      canceled: true,
      assets: [],
    });

    const { pickSingleImageFromPrompt } = await import('@/mobile/app/platform/media/images');
    const result = await pickSingleImageFromPrompt({
      cropAspect: [16, 9],
      cropShape: 'rectangle',
    });

    expect(result).toBeNull();
  });

  it('uses the shared library selection flow for plain iOS image prompts', async () => {
    platformMock.OS = 'ios';
    openMediaPickerPromptMock.mockResolvedValue({
      saveToGallery: false,
      source: 'library',
    });
    openMediaLibrarySelectionMock.mockResolvedValue([
      {
        duration: 0,
        filename: 'plain-photo.jpg',
        height: 1200,
        id: 'asset-plain',
        localUri: 'file:///cache/plain-photo.jpg',
        mediaType: 'photo',
        previewUri: 'file:///cache/plain-photo-preview.jpg',
        uri: 'ph://plain-photo',
        width: 1600,
      },
    ]);

    const { pickSingleImageFromPrompt } = await import('@/mobile/app/platform/media/images');
    const result = await pickSingleImageFromPrompt();

    expect(openMediaLibrarySelectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allowVideos: false,
        disabledFilters: ['all', 'video'],
        initialFilter: 'photo',
      }),
    );
    expect(launchImageLibraryAsyncMock).not.toHaveBeenCalled();
    expect(result).toMatch(/^file:\/\/\/documents\/picked-media\/.+\.jpg$/);
  });

  it('uses the shared library selection flow for iOS place media', async () => {
    platformMock.OS = 'ios';
    openMediaPickerPromptMock.mockResolvedValue({
      saveToGallery: false,
      source: 'library',
    });
    openMediaLibrarySelectionMock.mockResolvedValue([
      {
        duration: 12,
        filename: 'place-video.mov',
        height: 1920,
        id: 'asset-video',
        localUri: 'file:///cache/place-video.mov',
        mediaType: 'video',
        previewUri: 'file:///cache/place-video-preview.jpg',
        uri: 'ph://place-video',
        width: 1080,
      },
    ]);
    generateVideoThumbnailUriMock.mockResolvedValue('file:///cache/place-video-thumb.jpg');

    const { pickPlaceMediaFromPrompt } = await import('@/mobile/app/platform/media/images');
    const result = await pickPlaceMediaFromPrompt();

    expect(openMediaLibrarySelectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allowVideos: true,
        initialFilter: 'all',
      }),
    );
    expect(launchImageLibraryAsyncMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          durationMs: 12000,
          thumbnailTimeMs: 0,
          thumbnailUrl: 'file:///cache/place-video-thumb.jpg',
          type: 'video',
          url: expect.stringMatching(/^file:\/\/\/documents\/picked-media\/.+\.mov$/),
        }),
      ],
      rejectedOversizeCount: 0,
      rejectedVideoCount: 0,
    });
  });

  it('accepts the three-second duration tolerance and rejects anything longer', async () => {
    openMediaPickerPromptMock.mockResolvedValue({
      saveToGallery: false,
      source: 'library',
    });
    openMediaLibrarySelectionMock.mockResolvedValue([
      {
        duration: 183,
        filename: 'within-tolerance.mp4',
        height: 720,
        id: 'asset-within-tolerance',
        mediaType: 'video',
        uri: 'content://media/external/video/media/1',
        width: 1280,
      },
      {
        duration: 183.1,
        filename: 'outside-tolerance.mp4',
        height: 720,
        id: 'asset-outside-tolerance',
        mediaType: 'video',
        uri: 'content://media/external/video/media/2',
        width: 1280,
      },
    ]);

    const { pickPlaceMediaFromPrompt } = await import('@/mobile/app/platform/media/images');
    const result = await pickPlaceMediaFromPrompt();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(expect.objectContaining({
      durationMs: 183000,
      type: 'video',
    }));
    expect(result.rejectedVideoCount).toBe(1);
  });

  it('rejects oversized place media before it reaches the editor', async () => {
    openMediaPickerPromptMock.mockResolvedValue({
      saveToGallery: false,
      source: 'library',
    });
    openMediaLibrarySelectionMock.mockResolvedValue([
      {
        duration: 0,
        filename: 'huge-photo.jpg',
        height: 1200,
        id: 'asset-1',
        mediaType: 'photo',
        previewUri: 'content://media/external/images/preview-1',
        uri: 'content://media/external/images/1',
        width: 1600,
      },
    ]);
    getInfoAsyncMock.mockImplementation((uri: string) =>
      Promise.resolve(
        /^file:\/\/\/documents\/picked-media\/.+\.jpg$/.test(uri)
          ? { exists: true, size: 271043501 }
          : { exists: true },
      ),
    );

    const { pickPlaceMediaFromPrompt } = await import('@/mobile/app/platform/media/images');
    const result = await pickPlaceMediaFromPrompt();

    expect(result).toEqual({
      items: [],
      rejectedOversizeCount: 1,
      rejectedVideoCount: 0,
    });
    expect(saveUriToGalleryMock).not.toHaveBeenCalled();
  });
});
