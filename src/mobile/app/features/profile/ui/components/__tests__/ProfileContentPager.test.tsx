import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Platform } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-navigation/bottom-tabs', () => ({
  BottomTabBarHeightContext: React.createContext(0),
}));

vi.mock('@/mobile/app/features/discovery/public/components', () => ({
  ListGridTile: (props: Record<string, unknown>) => React.createElement('ListGridTile', props),
  PlaceGridTile: (props: Record<string, unknown>) => React.createElement('PlaceGridTile', props),
}));

vi.mock('@/mobile/app/shared/components/navigation/SwipeableTabPager', () => ({
  SwipeableTabPager: ({
    activeTab,
    renderPage,
    ...props
  }: {
    activeTab: string;
    renderPage: (tab: string, preview: boolean, active: boolean) => React.ReactNode;
  }) => React.createElement(
    'SwipeableTabPager',
    { ...props, activeTab, renderPage },
    renderPage(activeTab, false, true),
  ),
}));

vi.mock('@/mobile/app/shared/components/ui/VirtualizedDiscoveryGrid', () => ({
  VirtualizedDiscoveryGrid: ({
    data,
    ListHeaderComponent,
    renderItem,
    ...props
  }: Record<string, unknown> & {
    data: unknown[];
    ListHeaderComponent?: React.ReactNode;
    renderItem: (info: { index: number; item: unknown }) => React.ReactNode;
  }) => React.createElement(
    'VirtualizedDiscoveryGrid',
    { ...props, data, ListHeaderComponent, renderItem },
    ListHeaderComponent,
    data.slice(0, 6).map((item, index) => React.createElement(
      React.Fragment,
      { key: index },
      renderItem({ index, item }),
    )),
  ),
}));

import {
  getProfileHeaderCollapseOffset,
  ProfileContentPager,
  resolveProfileTabScrollSyncOffset,
} from '@/mobile/app/features/profile/ui/components/ProfileContentPager';

describe('ProfileContentPager', () => {
  it('keeps the pager tab-key reference stable when tab labels are refreshed', () => {
    const renderPager = (tabs: Array<{ key: 'lists' | 'places' | 'gallery'; label: string }>) => (
      <ProfileContentPager
        activeTab="lists"
        dataByTab={{ gallery: [], lists: [], places: [] }}
        emptyStateForTab={() => <></>}
        filteredLists={[]}
        header={<></>}
        hasNextPage={false}
        isFetchingNextPage={false}
        onListPress={vi.fn()}
        onPageProgressChange={vi.fn()}
        onPlacePress={vi.fn()}
        onTabChange={vi.fn()}
        onTabPreviewChange={vi.fn()}
        shouldShowErrorState={false}
        tabs={tabs}
      />
    );
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(renderPager([
        { key: 'lists', label: 'Listeler (1)' },
        { key: 'places', label: 'Mekanlar (2)' },
        { key: 'gallery', label: 'Galeri (3)' },
      ]));
    });
    act(() => {
      renderer.root.findByProps({ testID: 'profile-stationary-header' }).props.onLayout({
        nativeEvent: { layout: { height: 220 } },
      });
    });

    const initialTabs = renderer.root.find(
      (node) => String(node.type) === 'SwipeableTabPager',
    ).props.tabs;

    act(() => {
      renderer.update(renderPager([
        { key: 'lists', label: 'Listeler (4)' },
        { key: 'places', label: 'Mekanlar (5)' },
        { key: 'gallery', label: 'Galeri (6)' },
      ]));
    });

    const refreshedTabs = renderer.root.find(
      (node) => String(node.type) === 'SwipeableTabPager',
    ).props.tabs;
    expect(refreshedTabs).toBe(initialTabs);
    expect(refreshedTabs).toEqual(['lists', 'places', 'gallery']);

    act(() => {
      renderer.update(renderPager([
        { key: 'gallery', label: 'Galeri (6)' },
        { key: 'lists', label: 'Listeler (4)' },
        { key: 'places', label: 'Mekanlar (5)' },
      ]));
    });

    const reorderedTabs = renderer.root.find(
      (node) => String(node.type) === 'SwipeableTabPager',
    ).props.tabs;
    expect(reorderedTabs).not.toBe(refreshedTabs);
    expect(reorderedTabs).toEqual(['gallery', 'lists', 'places']);
  });

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
    const onRefresh = vi.fn();
    const header = React.createElement('ProfileHeader');
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ProfileContentPager
          activeTab="lists"
          dataByTab={{ gallery: [], lists: [list], places: [] }}
          emptyStateForTab={() => <></>}
          filteredLists={[list]}
          header={header}
          hasNextPage
          isFetchingNextPage
          onListPress={onListPress}
          onPageProgressChange={vi.fn()}
          onPlacePress={vi.fn()}
          onRefresh={onRefresh}
          onTabChange={vi.fn()}
          onTabPreviewChange={vi.fn()}
          refreshing
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

    const stationaryHeader = renderer.root.findByProps({
      testID: 'profile-stationary-header',
    });

    expect(renderer.root.findAll((node) => String(node.type) === 'ProfileHeader')).toHaveLength(1);
    expect(stationaryHeader.find((node) => String(node.type) === 'ProfileHeader')).toBeDefined();
    expect(
      renderer.root.findAll((node) => String(node.type) === 'VirtualizedDiscoveryGrid'),
    ).toHaveLength(0);

    act(() => {
      stationaryHeader.props.onLayout({ nativeEvent: { layout: { height: 236 } } });
    });

    const tile = renderer.root.find((node) => String(node.type) === 'ListGridTile');
    const measuredGrid = renderer.root.find(
      (node) => String(node.type) === 'VirtualizedDiscoveryGrid',
    );
    expect(measuredGrid.props.ListHeaderComponent.props.testID).toBe(
      'profile-header-spacer-lists',
    );
    expect(measuredGrid.props.ListHeaderComponent.props.children).toBeUndefined();
    expect(measuredGrid.props.ListHeaderComponent.props.style).toEqual({ height: 236 });
    expect(measuredGrid.props.progressViewOffset).toBe(236);
    expect(measuredGrid.props.refreshing).toBe(true);
    expect(measuredGrid.props.onRefresh).toBe(onRefresh);

    act(() => {
      renderer.root.findByProps({ testID: 'profile-stationary-header' }).props.onLayout({
        nativeEvent: { layout: { height: 312 } },
      });
    });

    const resizedGrid = renderer.root.find(
      (node) => String(node.type) === 'VirtualizedDiscoveryGrid',
    );
    expect(resizedGrid.props.progressViewOffset).toBe(312);
    expect(resizedGrid.props.ListHeaderComponent.props.style).toEqual({ height: 312 });

    let footerRenderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      footerRenderer = TestRenderer.create(measuredGrid.props.ListFooterComponent);
    });
    const loadMoreStatus = footerRenderer.root.find(
      (node) => node.props.accessibilityRole === 'progressbar',
    );
    expect(loadMoreStatus.props.accessibilityState).toEqual({ busy: true });

    act(() => measuredGrid.props.onScrollOffsetChange(80));

    const translatedHeader = renderer.root.findByProps({
      testID: 'profile-stationary-header',
    });
    const translateY = translatedHeader.props.style[1].transform[0].translateY;
    expect(Number(translateY)).toBe(-80);
    expect(tile.props.showPrivacyBadge).toBe(true);

    act(() => tile.props.onPress());
    expect(onListPress).toHaveBeenCalledWith(list);
  });

  it('shows one accessible refresh status below the absolute header on iOS', () => {
    const originalPlatform = Platform.OS;
    Platform.OS = 'ios';
    const onRefresh = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    try {
      act(() => {
        renderer = TestRenderer.create(
          <ProfileContentPager
            activeTab="lists"
            dataByTab={{ gallery: [], lists: [], places: [] }}
            emptyStateForTab={() => <></>}
            filteredLists={[]}
            header={React.createElement('ProfileHeader')}
            hasNextPage={false}
            isFetchingNextPage={false}
            onListPress={vi.fn()}
            onPageProgressChange={vi.fn()}
            onPlacePress={vi.fn()}
            onRefresh={onRefresh}
            onTabChange={vi.fn()}
            onTabPreviewChange={vi.fn()}
            refreshing
            shouldShowErrorState={false}
            tabs={[{ key: 'lists', label: 'Listeler' }]}
          />,
        );
      });

      act(() => {
        renderer.root.findByProps({ testID: 'profile-stationary-header' }).props.onLayout({
          nativeEvent: { layout: { height: 236 } },
        });
      });

      const grid = renderer.root.find(
        (node) => String(node.type) === 'VirtualizedDiscoveryGrid',
      );
      const refreshStatus = renderer.root.findByProps({
        testID: 'profile-ios-refresh-status',
      });

      expect(grid.props.progressViewOffset).toBeUndefined();
      expect(grid.props.refreshControl.props).toMatchObject({
        onRefresh,
        progressViewOffset: 236,
        refreshing: true,
        tintColor: 'transparent',
      });
      expect(refreshStatus.props.accessibilityLabel).toBe('Yenileniyor...');
      expect(refreshStatus.props.accessibilityRole).toBe('progressbar');
      expect(refreshStatus.props.accessibilityState).toEqual({ busy: true });
      expect(refreshStatus.props.style[1].top).toBeGreaterThan(236);
      expect(
        renderer.root.findAll((node) => String(node.type) === 'ActivityIndicator'),
      ).toHaveLength(1);
    } finally {
      Platform.OS = originalPlatform;
      if (renderer) {
        act(() => renderer.unmount());
      }
    }
  });

  it('keeps a background tab refreshable so a swipe never rebuilds its list', () => {
    const onRefresh = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ProfileContentPager
          activeTab="lists"
          dataByTab={{ gallery: [], lists: [], places: [] }}
          emptyStateForTab={() => <></>}
          filteredLists={[]}
          header={React.createElement('ProfileHeader')}
          hasNextPage={false}
          isFetchingNextPage={false}
          onListPress={vi.fn()}
          onPageProgressChange={vi.fn()}
          onPlacePress={vi.fn()}
          onRefresh={onRefresh}
          onTabChange={vi.fn()}
          onTabPreviewChange={vi.fn()}
          refreshing
          shouldShowErrorState={false}
          tabs={[
            { key: 'lists', label: 'Listeler' },
            { key: 'places', label: 'Mekânlar' },
          ]}
        />,
      );
    });
    act(() => {
      renderer.root.findByProps({ testID: 'profile-stationary-header' }).props.onLayout({
        nativeEvent: { layout: { height: 236 } },
      });
    });

    const pager = renderer.root.find((node) => String(node.type) === 'SwipeableTabPager');
    let background!: TestRenderer.ReactTestRenderer;
    act(() => {
      background = TestRenderer.create(pager.props.renderPage('places', true, false));
    });
    const grid = background.root.find(
      (node) => String(node.type) === 'VirtualizedDiscoveryGrid',
    );

    expect(grid.props.onRefresh).toBe(onRefresh);
    expect(grid.props.refreshing).toBe(false);
    expect(grid.props.onEndReached).toBeUndefined();

    act(() => {
      background.unmount();
      renderer.unmount();
    });
  });

  it('syncs only the shared header collapse without copying a deep content offset', () => {
    const headerHeight = 236;
    const sourceOffset = 1_480;
    const sharedHeaderOffset = getProfileHeaderCollapseOffset(sourceOffset, headerHeight);

    const shortTargetOffset = resolveProfileTabScrollSyncOffset({
      headerHeight,
      sharedHeaderOffset,
      targetMaxOffset: 84,
      targetOffset: 0,
    });
    const shortTabHeaderOffset = getProfileHeaderCollapseOffset(
      shortTargetOffset,
      headerHeight,
    );
    const returningSourceOffset = resolveProfileTabScrollSyncOffset({
      headerHeight,
      sharedHeaderOffset: shortTabHeaderOffset,
      targetOffset: sourceOffset,
    });

    expect(shortTargetOffset).toBe(84);
    expect(shortTargetOffset).not.toBe(sourceOffset);
    expect(returningSourceOffset).toBe(1_328);
    expect(returningSourceOffset - shortTabHeaderOffset).toBe(
      sourceOffset - headerHeight,
    );
  });

  it('keeps a target tab content depth while synchronizing the shared header', () => {
    expect(resolveProfileTabScrollSyncOffset({
      headerHeight: 220,
      sharedHeaderOffset: 48,
      targetMaxOffset: 900,
      targetOffset: 760,
    })).toBe(588);
  });

  it('clamps invalid and oversized header-collapse metrics safely', () => {
    expect(getProfileHeaderCollapseOffset(900, 240)).toBe(240);
    expect(resolveProfileTabScrollSyncOffset({
      headerHeight: 240,
      sharedHeaderOffset: 900,
      targetOffset: Number.NaN,
    })).toBe(240);
  });

  it('keeps a large profile dataset behind the virtualized visible window', () => {
    const lists = Array.from({ length: 500 }, (_, index) => ({
      id: `list-${index}`,
      userId: 'user-1',
      name: `List ${index}`,
      places: [],
      isPublic: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ProfileContentPager
          activeTab="lists"
          dataByTab={{ gallery: [], lists, places: [] }}
          emptyStateForTab={() => <></>}
          filteredLists={lists}
          header={<></>}
          hasNextPage
          isFetchingNextPage={false}
          onEndReached={vi.fn()}
          onListPress={vi.fn()}
          onPageProgressChange={vi.fn()}
          onPlacePress={vi.fn()}
          onRefresh={vi.fn()}
          onTabChange={vi.fn()}
          onTabPreviewChange={vi.fn()}
          shouldShowErrorState={false}
          tabs={[
            { key: 'lists', label: 'Listeler' },
            { key: 'places', label: 'Mekanlar' },
            { key: 'gallery', label: 'Galeri' },
          ]}
        />,
      );
    });

    const stationaryHeader = renderer.root.findByProps({
      testID: 'profile-stationary-header',
    });
    act(() => {
      stationaryHeader.props.onLayout({ nativeEvent: { layout: { height: 236 } } });
    });

    const grid = renderer.root.find(
      (node) => String(node.type) === 'VirtualizedDiscoveryGrid',
    );
    const mountedTiles = renderer.root.findAll(
      (node) => String(node.type) === 'ListGridTile',
    );

    expect(grid.props.data).toHaveLength(500);
    expect(grid.props.onEndReached).toEqual(expect.any(Function));
    expect(mountedTiles).toHaveLength(6);
    expect(mountedTiles.length).toBeLessThan(grid.props.data.length);
  });
});
