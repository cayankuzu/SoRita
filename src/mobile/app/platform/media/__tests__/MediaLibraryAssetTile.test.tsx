import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

const { thumbnailRenderMock } = vi.hoisted(() => ({
  thumbnailRenderMock: vi.fn(),
}));

vi.mock('@/mobile/app/shared/components/media/MediaThumbnailView', () => ({
  MediaThumbnailView: (props: Record<string, unknown>) => {
    thumbnailRenderMock(props);
    return React.createElement('MediaThumbnailView', props);
  },
}));

import { MediaLibraryAssetTile } from '@/mobile/app/platform/media/MediaLibraryAssetTile';
import type { MediaLibraryPickerAsset } from '@/mobile/app/platform/media/mediaLibrarySelectionTypes';

const asset: MediaLibraryPickerAsset = {
  creationTime: 1,
  duration: 0,
  filename: 'photo.jpg',
  height: 1200,
  id: 'asset-1',
  mediaType: 'photo',
  previewUri: 'file://photo-preview.jpg',
  uri: 'file://photo.jpg',
  width: 1200,
};

describe('MediaLibraryAssetTile render profile', () => {
  it('skips unchanged tile work and rerenders only when its selection order changes', () => {
    const onPress = vi.fn();
    const onPreviewError = vi.fn();
    const renderTile = (orderIndex: number) => (
      <MediaLibraryAssetTile
        asset={asset}
        onPress={onPress}
        onPreviewError={onPreviewError}
        orderIndex={orderIndex}
        size={112}
      />
    );
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(renderTile(-1));
    });
    expect(thumbnailRenderMock).toHaveBeenCalledTimes(1);

    act(() => {
      renderer.update(renderTile(-1));
    });
    expect(thumbnailRenderMock).toHaveBeenCalledTimes(1);

    act(() => {
      renderer.update(renderTile(0));
    });
    expect(thumbnailRenderMock).toHaveBeenCalledTimes(2);

    const pressable = renderer.root.findByType(
      'Pressable' as unknown as React.ElementType,
    );
    act(() => pressable.props.onPress());
    expect(onPress).toHaveBeenCalledWith(asset);
  });
});
