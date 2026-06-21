import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestMediaLibraryPermissionsAsyncMock = vi.fn();
const requestCameraPermissionsAsyncMock = vi.fn();
const requestMediaLibrarySavePermissionsAsyncMock = vi.fn();
const isMediaLibraryAvailableAsyncMock = vi.fn();
const launchImageLibraryAsyncMock = vi.fn();
const launchCameraAsyncMock = vi.fn();
const saveToLibraryAsyncMock = vi.fn();
const getInfoAsyncMock = vi.fn();
const makeDirectoryAsyncMock = vi.fn();
const deleteAsyncMock = vi.fn();
const copyAsyncMock = vi.fn();
const readAsStringAsyncMock = vi.fn();
const writeAsStringAsyncMock = vi.fn();

vi.mock('expo-image-picker', () => ({
  UIImagePickerControllerQualityType: {
    High: 'high',
  },
  UIImagePickerPreferredAssetRepresentationMode: {
    Compatible: 'compatible',
  },
  requestCameraPermissionsAsync: requestCameraPermissionsAsyncMock,
  requestMediaLibraryPermissionsAsync: requestMediaLibraryPermissionsAsyncMock,
  launchCameraAsync: launchCameraAsyncMock,
  launchImageLibraryAsync: launchImageLibraryAsyncMock,
}));

vi.mock('expo-media-library', () => ({
  isAvailableAsync: isMediaLibraryAvailableAsyncMock,
  requestPermissionsAsync: requestMediaLibrarySavePermissionsAsyncMock,
  saveToLibraryAsync: saveToLibraryAsyncMock,
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

describe('platform/media/images', () => {
  beforeEach(() => {
    requestMediaLibraryPermissionsAsyncMock.mockReset();
    requestCameraPermissionsAsyncMock.mockReset();
    requestMediaLibrarySavePermissionsAsyncMock.mockReset();
    isMediaLibraryAvailableAsyncMock.mockReset();
    launchImageLibraryAsyncMock.mockReset();
    launchCameraAsyncMock.mockReset();
    saveToLibraryAsyncMock.mockReset();
    getInfoAsyncMock.mockReset();
    makeDirectoryAsyncMock.mockReset();
    deleteAsyncMock.mockReset();
    copyAsyncMock.mockReset();
    readAsStringAsyncMock.mockReset();
    writeAsStringAsyncMock.mockReset();

    requestMediaLibraryPermissionsAsyncMock.mockResolvedValue({ granted: true });
    requestCameraPermissionsAsyncMock.mockResolvedValue({ granted: true });
    requestMediaLibrarySavePermissionsAsyncMock.mockResolvedValue({ granted: true });
    isMediaLibraryAvailableAsyncMock.mockResolvedValue(true);
    saveToLibraryAsyncMock.mockResolvedValue(undefined);
    getInfoAsyncMock.mockResolvedValue({ exists: true });
    makeDirectoryAsyncMock.mockResolvedValue(undefined);
    deleteAsyncMock.mockResolvedValue(undefined);
    copyAsyncMock.mockResolvedValue(undefined);
    writeAsStringAsyncMock.mockResolvedValue(undefined);
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
        allowsEditing: true,
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
    expect(requestMediaLibrarySavePermissionsAsyncMock).toHaveBeenCalledWith(true);
    expect(isMediaLibraryAvailableAsyncMock).toHaveBeenCalledTimes(1);
    expect(launchCameraAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allowsEditing: true,
        base64: false,
        quality: 0.9,
      }),
    );
    expect(saveToLibraryAsyncMock).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/documents\/picked-media\/.+\.jpg$/),
    );
    expect(result).toMatch(/^file:\/\/\/documents\/picked-media\/.+\.jpg$/);
  });

  it('skips gallery saving when the media library native module is unavailable', async () => {
    isMediaLibraryAvailableAsyncMock.mockResolvedValueOnce(false);
    launchCameraAsyncMock.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/camera-shot.jpg', base64: 'Y2FtZXJh' }],
    });

    const { pickSingleImage } = await import('@/mobile/app/platform/media/images');
    const result = await pickSingleImage('camera');

    expect(result).toMatch(/^file:\/\/\/documents\/picked-media\/.+\.jpg$/);
    expect(requestMediaLibrarySavePermissionsAsyncMock).not.toHaveBeenCalled();
    expect(saveToLibraryAsyncMock).not.toHaveBeenCalled();
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
});
