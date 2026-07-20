import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';

const { connectionStatusMock, preparePlaceMediaUploadMock } = vi.hoisted(() => ({
  connectionStatusMock: vi.fn(),
  preparePlaceMediaUploadMock: vi.fn(),
}));

vi.mock('@/mobile/app/data/uploads/preparedPlaceMediaUploads', () => ({
  isLocalPlaceMediaUri: (uri?: string) => Boolean(uri?.startsWith('file://')),
  preparePlaceMediaUpload: preparePlaceMediaUploadMock,
}));

vi.mock('@/mobile/app/data/outbox/mediaCleanupOutbox', () => ({
  scheduleStorageAssetsCleanup: vi.fn(),
}));

vi.mock('@/mobile/app/platform/network/connectivityStatus', () => ({
  getCurrentConnectionStatus: connectionStatusMock,
}));

vi.mock('@/shared/utils/id', () => ({
  createUuid: () => 'preparation-1',
}));

import { usePreparedPlaceMediaUploads } from '@/mobile/app/features/map/application/usePreparedPlaceMediaUploads';

const list = {
  id: 'list-1',
  userId: 'user-1',
  name: 'Saved',
  places: [],
  isPublic: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('usePreparedPlaceMediaUploads', () => {
  beforeEach(() => {
    connectionStatusMock.mockReset();
    connectionStatusMock.mockReturnValue('online');
    preparePlaceMediaUploadMock.mockReset();
  });

  it('prepares only local videos for the selected owner', async () => {
    renderHook(() => usePreparedPlaceMediaUploads({
      lists: [list],
      media: [
        {
          durationMs: 60_000,
          thumbnailUrl: 'file:///video-thumb.jpg',
          type: 'video',
          url: 'file:///video.mp4',
        },
        { type: 'photo', url: 'file:///photo.jpg' },
        { type: 'video', url: 'https://cdn.example.com/video.mp4' },
      ],
      selectedListIds: ['list-1'],
      visible: true,
    }));

    await waitFor(() => expect(preparePlaceMediaUploadMock).toHaveBeenCalledTimes(2));
    expect(preparePlaceMediaUploadMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      durationMs: 60_000,
      mediaType: 'video',
      prefix: 'drafts/preparation-1/0',
      uri: 'file:///video.mp4',
      userId: 'user-1',
    }));
    expect(preparePlaceMediaUploadMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      mediaType: 'photo',
      prefix: 'drafts/preparation-1/0-thumbnail',
      uri: 'file:///video-thumb.jpg',
    }));
  });

  it('does not start preparation while hidden or offline', () => {
    connectionStatusMock.mockReturnValue('offline');
    renderHook(() => usePreparedPlaceMediaUploads({
      lists: [list],
      media: [{ type: 'video', url: 'file:///video.mp4' }],
      selectedListIds: [],
      visible: true,
    }));
    connectionStatusMock.mockReturnValue('online');
    renderHook(() => usePreparedPlaceMediaUploads({
      lists: [list],
      media: [{ type: 'video', url: 'file:///video.mp4' }],
      selectedListIds: [],
      visible: false,
    }));
    expect(preparePlaceMediaUploadMock).not.toHaveBeenCalled();
  });
});
