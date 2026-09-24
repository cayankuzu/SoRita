import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  Compass: (props: Record<string, unknown>) => React.createElement('Compass', props),
  Search: (props: Record<string, unknown>) => React.createElement('Search', props),
}));

vi.mock('@/mobile/app/features/discovery/public/components', () => ({
  ListMosaicTile: (props: Record<string, unknown>) => React.createElement('ListMosaicTile', props),
  PlaceMosaicTile: (props: Record<string, unknown>) => React.createElement('PlaceMosaicTile', props),
  UserGridTile: (props: Record<string, unknown>) => React.createElement('UserGridTile', props),
}));

vi.mock('@/mobile/app/shared/components/ui/VirtualizedDiscoveryGrid', () => ({
  VirtualizedDiscoveryGrid: (props: Record<string, unknown>) =>
    React.createElement('VirtualizedDiscoveryGrid', props),
}));

import { ExploreResultsPage } from '@/mobile/app/features/explore/ui/components/ExploreResultsPage';

function createProps(active: boolean, listRef: (node: unknown) => void) {
  return {
    active,
    data: [],
    errorMessage: null,
    following: [],
    hasNextPage: true,
    isFetchingNextPage: false,
    isLoading: false,
    listRef,
    onClearSearch: vi.fn(),
    onContentReady: vi.fn(),
    onEndReached: vi.fn(),
    onFollowUser: vi.fn(),
    onListIntent: vi.fn(),
    onListPress: vi.fn(),
    onOwnerIntent: vi.fn(),
    onOwnerPress: vi.fn(),
    onPlacePress: vi.fn(),
    onRefresh: vi.fn(),
    onRetry: vi.fn(),
    onScrollOffsetChange: vi.fn(),
    pendingFollowRequests: [],
    refreshing: false,
    searchQuery: '',
    searchTooShort: false,
    tab: 'lists' as const,
    topInset: 148,
  };
}

describe('ExploreResultsPage', () => {
  it('keeps a distinct list ref per page and disables background pagination', () => {
    const activeRef = vi.fn();
    const backgroundRef = vi.fn();
    const activeProps = createProps(true, activeRef);
    const backgroundProps = createProps(false, backgroundRef);
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <>
          <ExploreResultsPage {...activeProps} />
          <ExploreResultsPage {...backgroundProps} refreshing tab="places" />
        </>,
      );
    });

    const lists = renderer.root.findAll(
      (node) => String(node.type) === 'VirtualizedDiscoveryGrid',
    );
    expect(lists[0]?.props.listRef).toBe(activeRef);
    expect(lists[1]?.props.listRef).toBe(backgroundRef);
    // The first rows start below the browse header that floats over them.
    expect(lists[0]?.props.ListHeaderComponent.props.style).toEqual({ height: 148 });
    expect(lists[0]?.props.progressViewOffset).toBe(148);
    expect(lists[0]?.props.onEndReached).toBe(activeProps.onEndReached);
    expect(lists[1]?.props.onEndReached).toBeUndefined();
    // A background page keeps its refresh handler, so the swipe that brings it
    // into view does not rebuild its scroll view, but it never shows as busy.
    expect(lists[1]?.props.onRefresh).toBe(backgroundProps.onRefresh);
    expect(lists[1]?.props.refreshing).toBe(false);
    expect(lists[0]?.props.scrollEnabled).toBe(true);
    expect(lists[1]?.props.scrollEnabled).toBe(false);
  });

  it('shows pagination feedback only while a next page is actually loading', () => {
    const props = createProps(true, vi.fn());
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<ExploreResultsPage {...props} />);
    });

    let list = renderer.root.find(
      (node) => String(node.type) === 'VirtualizedDiscoveryGrid',
    );
    expect(list.props.ListFooterComponent).toBeNull();

    act(() => {
      renderer.update(<ExploreResultsPage {...props} isFetchingNextPage />);
    });

    list = renderer.root.find(
      (node) => String(node.type) === 'VirtualizedDiscoveryGrid',
    );
    expect(list.props.ListFooterComponent).not.toBeNull();
    expect(list.props.ListFooterComponent.props.accessibilityLiveRegion).toBe('polite');
    expect(list.props.ListFooterComponent.props.accessibilityState).toEqual({ busy: true });
  });

  it('asks for one more letter instead of reporting nothing found, and shows a grid while a search loads', () => {
    const props = createProps(true, vi.fn());
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ExploreResultsPage {...props} searchQuery="ka" searchTooShort />,
      );
    });
    let empty = renderer.root.find(
      (node) => String(node.type) === 'VirtualizedDiscoveryGrid',
    ).props.ListEmptyComponent;
    let emptyRenderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      emptyRenderer = TestRenderer.create(empty);
    });
    expect(JSON.stringify(emptyRenderer.toJSON())).toContain('Biraz daha yaz');

    act(() => {
      renderer.update(<ExploreResultsPage {...props} isLoading searchQuery="kahve" />);
    });
    empty = renderer.root.find(
      (node) => String(node.type) === 'VirtualizedDiscoveryGrid',
    ).props.ListEmptyComponent;
    act(() => {
      emptyRenderer.update(empty);
    });
    expect(JSON.stringify(emptyRenderer.toJSON())).not.toContain('Sonuç bulunamadı');
  });
});
