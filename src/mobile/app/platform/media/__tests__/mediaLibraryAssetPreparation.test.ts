import { describe, expect, it, vi } from 'vitest';

import type { MediaLibraryPickerAsset } from '@/mobile/app/platform/media/mediaLibrarySelectionTypes';

vi.mock('expo-media-library', () => ({
  MediaType: { photo: 'photo', video: 'video' },
}));

vi.mock('@/mobile/app/platform/media/videoThumbnails', () => ({
  generateVideoThumbnailUri: vi.fn(),
}));

import {
  buildAndroidMediaStoreUri,
  buildMediaLibraryAssetTileItems,
  buildMediaTypeFilter,
  buildResponsiveMediaGridLayout,
  buildSelectionCounts,
  buildSelectionOrderById,
} from '@/mobile/app/platform/media/mediaLibraryAssetPreparation';

describe('mediaLibraryAssetPreparation', () => {
  it('uses scoped-storage-safe MediaStore URIs on Android', () => {
    expect(buildAndroidMediaStoreUri({ id: '42', mediaType: 'photo' } as never)).toBe(
      'content://media/external/images/media/42',
    );
    expect(buildAndroidMediaStoreUri({ id: '84', mediaType: 'video' } as never)).toBe(
      'content://media/external/video/media/84',
    );
  });

  it('builds the smallest allowed media filter', () => {
    expect(buildMediaTypeFilter('all', true)).toEqual(['photo', 'video']);
    expect(buildMediaTypeFilter('all', false)).toEqual(['photo']);
    expect(buildMediaTypeFilter('video', false)).toEqual(['photo']);
    expect(buildMediaTypeFilter('video', true)).toEqual(['video']);
  });

  it('counts photos and videos in one pass', () => {
    expect(
      buildSelectionCounts([
        { id: 'photo-1', mediaType: 'photo' },
        { id: 'video-1', mediaType: 'video' },
        { id: 'photo-2', mediaType: 'photo' },
      ] as never),
    ).toEqual({ photos: 2, total: 3, videos: 1 });
  });

  it('indexes selection order once for constant-time tile lookups', () => {
    const selectionOrderById = buildSelectionOrderById([
      'asset-b',
      'asset-a',
      'asset-c',
    ]);

    expect(selectionOrderById.get('asset-a')).toBe(1);
    expect(selectionOrderById.get('asset-b')).toBe(0);
    expect(selectionOrderById.get('asset-c')).toBe(2);
    expect(selectionOrderById.has('asset-missing')).toBe(false);
  });

  it('builds stable-asset tile models with scalar selection state', () => {
    const assets = [
      { id: 'asset-a', mediaType: 'photo' },
      { id: 'asset-b', mediaType: 'photo' },
      { id: 'asset-c', mediaType: 'video' },
    ] as unknown as MediaLibraryPickerAsset[];
    const tileItems = buildMediaLibraryAssetTileItems(assets, ['asset-c', 'asset-a']);

    expect(tileItems.map(({ orderIndex }) => orderIndex)).toEqual([1, -1, 0]);
    expect(tileItems[1]?.asset).toBe(assets[1]);
  });

  it('adapts the media grid from narrow phones to wide screens', () => {
    expect(buildResponsiveMediaGridLayout(320)).toEqual({
      columnCount: 2,
      tileSize: 139,
    });
    expect(buildResponsiveMediaGridLayout(390)).toEqual({
      columnCount: 3,
      tileSize: 112,
    });
    expect(buildResponsiveMediaGridLayout(768)).toEqual({
      columnCount: 6,
      tileSize: 114,
    });
  });
});
