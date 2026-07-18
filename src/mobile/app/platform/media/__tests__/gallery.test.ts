import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NativeModules } from 'react-native';

const downloadAsyncMock = vi.fn();
const requestPermissionsAsyncMock = vi.fn();
const isAvailableAsyncMock = vi.fn();
const saveToLibraryAsyncMock = vi.fn();
const getInfoAsyncMock = vi.fn();
const makeDirectoryAsyncMock = vi.fn();
const deleteAsyncMock = vi.fn();

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///documents/',
  deleteAsync: deleteAsyncMock,
  downloadAsync: downloadAsyncMock,
  getInfoAsync: getInfoAsyncMock,
  makeDirectoryAsync: makeDirectoryAsyncMock,
}));

vi.mock('expo-media-library', () => ({
  isAvailableAsync: isAvailableAsyncMock,
  requestPermissionsAsync: requestPermissionsAsyncMock,
  saveToLibraryAsync: saveToLibraryAsyncMock,
}));

describe('platform/media/gallery', () => {
  beforeEach(() => {
    delete (NativeModules as Record<string, unknown>).SoritaGallerySaver;
    downloadAsyncMock.mockReset();
    requestPermissionsAsyncMock.mockReset();
    isAvailableAsyncMock.mockReset();
    saveToLibraryAsyncMock.mockReset();
    getInfoAsyncMock.mockReset();
    makeDirectoryAsyncMock.mockReset();
    deleteAsyncMock.mockReset();

    isAvailableAsyncMock.mockResolvedValue(true);
    requestPermissionsAsyncMock.mockResolvedValue({ granted: true });
    saveToLibraryAsyncMock.mockResolvedValue(undefined);
    getInfoAsyncMock.mockResolvedValue({ exists: true });
    makeDirectoryAsyncMock.mockResolvedValue(undefined);
    deleteAsyncMock.mockResolvedValue(undefined);
  });

  it('uses the native Android gallery saver when available', async () => {
    const saveToGalleryMock = vi.fn().mockResolvedValue('content://media/external/images/media/7');
    (NativeModules as Record<string, unknown>).SoritaGallerySaver = {
      saveToGallery: saveToGalleryMock,
    };

    const { saveUriToGallery } = await import('@/mobile/app/platform/media/gallery');

    const result = await saveUriToGallery({
      fileName: 'preview.jpg',
      mimeType: 'image/jpeg',
      uri: 'file:///documents/local-photo.jpg',
    });

    expect(result).toBe(true);
    expect(saveToGalleryMock).toHaveBeenCalledWith(
      'file:///documents/local-photo.jpg',
      'preview.jpg',
      'image/jpeg',
    );
    expect(saveToLibraryAsyncMock).not.toHaveBeenCalled();
    expect(requestPermissionsAsyncMock).not.toHaveBeenCalled();
  });

  it('saves a local file directly into the gallery', async () => {
    const { saveUriToGallery } = await import('@/mobile/app/platform/media/gallery');

    const result = await saveUriToGallery({
      uri: 'file:///documents/local-photo.jpg',
    });

    expect(result).toBe(true);
    expect(downloadAsyncMock).not.toHaveBeenCalled();
    expect(saveToLibraryAsyncMock).toHaveBeenCalledWith('file:///documents/local-photo.jpg');
  });

  it('downloads remote media before saving it into the gallery', async () => {
    downloadAsyncMock.mockResolvedValue({
      uri: 'file:///cache/gallery-downloads/remote-media.mp4',
    });

    const { saveUriToGallery } = await import('@/mobile/app/platform/media/gallery');

    const result = await saveUriToGallery({
      mimeType: 'video/mp4',
      uri: 'https://cdn.example.com/media/video',
    });

    expect(result).toBe(true);
    expect(downloadAsyncMock).toHaveBeenCalledWith(
      'https://cdn.example.com/media/video',
      expect.stringMatching(/^file:\/\/\/cache\/gallery-downloads\/.+\.mp4$/),
    );
    expect(saveToLibraryAsyncMock).toHaveBeenCalledWith('file:///cache/gallery-downloads/remote-media.mp4');
    expect(deleteAsyncMock).toHaveBeenCalledWith('file:///cache/gallery-downloads/remote-media.mp4', {
      idempotent: true,
    });
  });

  it('returns false when gallery permission is denied', async () => {
    requestPermissionsAsyncMock.mockResolvedValueOnce({ granted: false });

    const { saveUriToGallery } = await import('@/mobile/app/platform/media/gallery');

    const result = await saveUriToGallery({
      uri: 'file:///documents/local-photo.jpg',
    });

    expect(result).toBe(false);
    expect(saveToLibraryAsyncMock).not.toHaveBeenCalled();
  });
});
