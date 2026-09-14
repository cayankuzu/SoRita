import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  Image: (props: Record<string, unknown>) => React.createElement('ImageIcon', props),
  RefreshCcw: (props: Record<string, unknown>) => React.createElement('RefreshCcw', props),
  Settings: (props: Record<string, unknown>) => React.createElement('Settings', props),
}));

vi.mock('@/mobile/app/platform/media/MediaLibraryAssetTile', () => ({
  MediaLibraryAssetTile: (props: Record<string, unknown>) =>
    React.createElement('MediaLibraryAssetTile', props),
}));

import { MediaLibrarySelectionContent } from '@/mobile/app/platform/media/MediaLibrarySelectionContent';
import { tr } from '@/mobile/app/shared/i18n/tr';

const baseProps: React.ComponentProps<typeof MediaLibrarySelectionContent> = {
  allowVideos: true,
  assetTileItems: [],
  columnCount: 3,
  disabledFilters: new Set(),
  endCursor: null,
  filter: 'all',
  hasNextPage: false,
  isLoading: false,
  isLoadingMore: false,
  loadAssetsPage: vi.fn().mockResolvedValue(undefined),
  loadFailed: false,
  maxSelection: 6,
  onAssetToggle: vi.fn(),
  onFilterChange: vi.fn(),
  onPreviewError: vi.fn(),
  permissionCanAskAgain: true,
  permissionDenied: false,
  remainingPhotos: 6,
  remainingVideos: 1,
  selectedCounts: { photos: 0, total: 0, videos: 0 },
  tileSize: 100,
  visibleFilters: ['all', 'photo', 'video'],
};

function findLoadingStatus(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.find(
    (node) =>
      node.props.accessibilityRole === 'progressbar' &&
      node.props.accessibilityLabel === tr.common.loading,
  );
}

describe('MediaLibrarySelectionContent accessibility', () => {
  it('announces the initial library load as a busy progress status', () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <MediaLibrarySelectionContent {...baseProps} isLoading />,
      );
    });

    expect(findLoadingStatus(renderer).props.accessibilityState).toEqual({ busy: true });
  });

  it('announces incremental loading without replacing the grid', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    let footerRenderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <MediaLibrarySelectionContent {...baseProps} hasNextPage isLoadingMore />,
      );
    });

    const list = renderer.root.find((node) => String(node.type) === 'FlatList');
    act(() => {
      footerRenderer = TestRenderer.create(list.props.ListFooterComponent);
    });

    expect(findLoadingStatus(footerRenderer).props.accessibilityState).toEqual({ busy: true });
  });
});
