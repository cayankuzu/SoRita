import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  Compass: (props: Record<string, unknown>) => React.createElement('Compass', props),
}));

vi.mock('@/mobile/app/features/discovery/public/components', () => ({
  ListGridTile: (props: Record<string, unknown>) => React.createElement('ListGridTile', props),
  PlaceGridTile: (props: Record<string, unknown>) => React.createElement('PlaceGridTile', props),
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
    listMarkerLists: [],
    listRef,
    onClearSearch: vi.fn(),
    onContentReady: vi.fn(),
    onEndReached: vi.fn(),
    onFollowUser: vi.fn(),
    onListPress: vi.fn(),
    onOwnerPress: vi.fn(),
    onPlacePress: vi.fn(),
    onRefresh: vi.fn(),
    onRetry: vi.fn(),
    onScrollOffsetChange: vi.fn(),
    pendingFollowRequests: [],
    refreshing: false,
    searchQuery: '',
    tab: 'lists' as const,
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
          <ExploreResultsPage {...backgroundProps} tab="places" />
        </>,
      );
    });

    const lists = renderer.root.findAll(
      (node) => String(node.type) === 'VirtualizedDiscoveryGrid',
    );
    expect(lists[0]?.props.listRef).toBe(activeRef);
    expect(lists[1]?.props.listRef).toBe(backgroundRef);
    expect(lists[0]?.props.onEndReached).toBe(activeProps.onEndReached);
    expect(lists[1]?.props.onEndReached).toBeUndefined();
    expect(lists[1]?.props.onRefresh).toBeUndefined();
  });
});
