import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-media-library', () => ({
  MediaType: { photo: 'photo', video: 'video' },
}));

vi.mock('@/mobile/app/platform/media/videoThumbnails', () => ({
  generateVideoThumbnailUri: vi.fn(),
}));

import {
  buildMediaTypeFilter,
  buildSelectionCounts,
} from '@/mobile/app/platform/media/mediaLibraryAssetPreparation';

describe('mediaLibraryAssetPreparation', () => {
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
});
