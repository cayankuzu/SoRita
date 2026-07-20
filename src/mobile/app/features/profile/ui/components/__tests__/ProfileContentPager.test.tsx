import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/mobile/app/features/discovery/public/components', () => ({
  ListGridTile: (props: Record<string, unknown>) => React.createElement('ListGridTile', props),
  PlaceGridTile: (props: Record<string, unknown>) => React.createElement('PlaceGridTile', props),
}));

vi.mock('@/mobile/app/shared/components/navigation/SwipeableTabPager', () => ({
  SwipeableTabPager: ({
    activeTab,
    renderPage,
  }: {
    activeTab: string;
    renderPage: (tab: string) => React.ReactNode;
  }) => renderPage(activeTab),
}));

vi.mock('@/mobile/app/shared/components/ui/StaticDiscoveryGrid', () => ({
  StaticDiscoveryGrid: ({
    data,
    renderItem,
  }: {
    data: unknown[];
    renderItem: (info: { index: number; item: unknown }) => React.ReactNode;
  }) => data.map((item, index) => renderItem({ index, item })),
}));

import { ProfileContentPager } from '@/mobile/app/features/profile/ui/components/ProfileContentPager';

describe('ProfileContentPager', () => {
  it('uses one shared list renderer for own and public profile screens', () => {
    const list = {
      id: 'list-1',
      userId: 'user-1',
      name: 'İstanbul',
      places: [],
      isPublic: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const onListPress = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ProfileContentPager
          activeTab="lists"
          dataByTab={{ gallery: [], lists: [list], places: [] }}
          emptyStateForTab={() => <></>}
          filteredLists={[list]}
          hasNextPage={false}
          isFetchingNextPage={false}
          onContentHeightChange={vi.fn()}
          onListPress={onListPress}
          onPageProgressChange={vi.fn()}
          onPlacePress={vi.fn()}
          onTabChange={vi.fn()}
          onTabPreviewChange={vi.fn()}
          pagerHeight={320}
          shouldShowErrorState={false}
          showPrivacyBadge
          tabs={[
            { key: 'lists', label: 'Listeler' },
            { key: 'places', label: 'Mekânlar' },
            { key: 'gallery', label: 'Galeri' },
          ]}
        />,
      );
    });

    const tile = renderer.root.find((node) => String(node.type) === 'ListGridTile');
    expect(tile.props.showPrivacyBadge).toBe(true);

    act(() => tile.props.onPress());
    expect(onListPress).toHaveBeenCalledWith(list);
  });
});
