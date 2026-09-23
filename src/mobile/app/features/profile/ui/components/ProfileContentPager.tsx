import React from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';
import {
  ListGridTile,
  PlaceGridTile,
} from '@/mobile/app/features/discovery/public/components';
import {
  SwipeableTabPager,
} from '@/mobile/app/shared/components/navigation/SwipeableTabPager';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { VirtualizedDiscoveryGrid } from '@/mobile/app/shared/components/ui/VirtualizedDiscoveryGrid';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  fontWeight,
  layout,
  radius,
  spacing,
  textStyle,
  zIndex,
} from '@/mobile/app/shared/theme/tokens';
import { getMarkerColorForMemberships } from '@/mobile/app/shared/utils/markerColors';

export type ProfileContentTab = 'lists' | 'places' | 'gallery';
export type ProfileGridItem = PlaceList | PlaceFeedCardItem;

type ProfileTabScrollSyncParams = {
  headerHeight: number;
  sharedHeaderOffset: number;
  targetMaxOffset?: number;
  targetOffset: number;
};

function normalizeScrollMetric(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function getProfileHeaderCollapseOffset(offset: number, headerHeight: number) {
  return Math.min(normalizeScrollMetric(offset), normalizeScrollMetric(headerHeight));
}

/**
 * Treats a list offset as two independent parts: the shared profile-header
 * collapse and the tab-owned content depth. This keeps the same content in view
 * while allowing every tab to display the same header state.
 */
export function resolveProfileTabScrollSyncOffset({
  headerHeight,
  sharedHeaderOffset,
  targetMaxOffset,
  targetOffset,
}: ProfileTabScrollSyncParams) {
  const safeHeaderHeight = normalizeScrollMetric(headerHeight);
  const safeTargetMaxOffset = targetMaxOffset == null || !Number.isFinite(targetMaxOffset)
    ? Number.POSITIVE_INFINITY
    : normalizeScrollMetric(targetMaxOffset);
  const safeTargetOffset = Math.min(
    normalizeScrollMetric(targetOffset),
    safeTargetMaxOffset,
  );

  if (safeHeaderHeight === 0) {
    return safeTargetOffset;
  }

  const targetContentOffset = Math.max(0, safeTargetOffset - safeHeaderHeight);

  return Math.min(
    getProfileHeaderCollapseOffset(sharedHeaderOffset, safeHeaderHeight) +
      targetContentOffset,
    safeTargetMaxOffset,
  );
}

type ProfileContentPagerProps = {
  activeTab: ProfileContentTab;
  dataByTab: Record<ProfileContentTab, ProfileGridItem[]>;
  emptyStateForTab: (tab: ProfileContentTab) => React.ReactElement;
  enabled?: boolean;
  filteredLists: PlaceList[];
  // Collapses as the active list scrolls.
  header: React.ReactElement;
  // Sits under the header and never scrolls away: the tab bar.
  stickyHeader?: React.ReactElement;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  listRef?: React.RefObject<FlatList<ProfileGridItem> | null>;
  onEndReached?: () => void;
  onListPress: (list: PlaceList) => void;
  onPageProgressChange: (pageOffset: number) => void;
  onPlacePress: (tab: Exclude<ProfileContentTab, 'lists'>, index: number) => void;
  onRefresh?: () => void;
  onTabChange: (tab: ProfileContentTab) => void;
  onTabPreviewChange: (tab: ProfileContentTab) => void;
  refreshing?: boolean;
  shouldShowErrorState: boolean;
  showPrivacyBadge?: boolean;
  tabs: Array<{ key: ProfileContentTab; label: string }>;
};

type ProfileContentPageProps = {
  active: boolean;
  collapseRange: number;
  data: ProfileGridItem[];
  emptyState: React.ReactElement;
  filteredLists: PlaceList[];
  footerClearance: number;
  hasNextPage: boolean;
  headerSpacerHeight: number;
  isFetchingNextPage: boolean;
  onEndReached?: () => void;
  onListRef: (tab: ProfileContentTab, node: FlatList<ProfileGridItem> | null) => void;
  onListPress: (list: PlaceList) => void;
  onPlacePress: (tab: Exclude<ProfileContentTab, 'lists'>, index: number) => void;
  onRefresh?: () => void;
  onScrollBoundsChange: (tab: ProfileContentTab, maxOffset: number) => void;
  onScrollOffsetChange: (tab: ProfileContentTab, offset: number) => void;
  refreshing: boolean;
  showPrivacyBadge: boolean;
  tab: ProfileContentTab;
};

const ProfileContentPage = React.memo(function ProfileContentPage({
  active,
  collapseRange,
  data,
  emptyState,
  filteredLists,
  footerClearance,
  hasNextPage,
  headerSpacerHeight,
  isFetchingNextPage,
  onEndReached,
  onListRef,
  onListPress,
  onPlacePress,
  onRefresh,
  onScrollBoundsChange,
  onScrollOffsetChange,
  refreshing,
  showPrivacyBadge,
  tab,
}: ProfileContentPageProps) {
  const keyExtractor = React.useCallback(
    (item: ProfileGridItem, index: number) =>
      tab === 'lists'
        ? (item as PlaceList).id
        : (item as PlaceFeedCardItem).key || `${tab}:${index}`,
    [tab],
  );
  const renderItem = React.useCallback(
    ({ item, index }: { item: ProfileGridItem; index: number }) => {
      if (tab === 'lists') {
        const list = item as PlaceList;

        return (
          <ListGridTile
            list={list}
            fillWidth
            showPrivacyBadge={showPrivacyBadge}
            allListsForMarkerColor={filteredLists}
            onPress={() => onListPress(list)}
          />
        );
      }

      const placeItem = item as PlaceFeedCardItem;

      return (
        <PlaceGridTile
          place={placeItem.place}
          fillWidth
          mode={tab === 'gallery' ? 'photo' : 'place'}
          listCoverImage={placeItem.listCoverImage}
          listEmoji={placeItem.listEmoji}
          listIsPublic={placeItem.listIsPublic}
          listName={placeItem.listName}
          markerColor={getMarkerColorForMemberships(
            placeItem.memberships,
            placeItem.listIsPublic,
          )}
          onPress={() => onPlacePress(tab, index)}
        />
      );
    },
    [filteredLists, onListPress, onPlacePress, showPrivacyBadge, tab],
  );
  const showLoadMoreStatus = active && hasNextPage && isFetchingNextPage;
  const showIOSRefreshStatus = Platform.OS === 'ios' && active && refreshing;
  const iosRefreshControl = React.useMemo(
    () =>
      Platform.OS === 'ios' && active && onRefresh ? (
        <RefreshControl
          onRefresh={onRefresh}
          progressViewOffset={headerSpacerHeight}
          refreshing={refreshing}
          tintColor="transparent"
        />
      ) : undefined,
    [active, headerSpacerHeight, onRefresh, refreshing],
  );
  const footer = React.useMemo(
    () => (
      <View
        accessible={showLoadMoreStatus || undefined}
        accessibilityLabel={showLoadMoreStatus ? tr.common.loadingMore : undefined}
        accessibilityLiveRegion={showLoadMoreStatus ? 'polite' : 'none'}
        accessibilityRole={showLoadMoreStatus ? 'progressbar' : undefined}
        accessibilityState={showLoadMoreStatus ? { busy: true } : undefined}
        style={[styles.listFooter, { minHeight: footerClearance }]}
      >
        {showLoadMoreStatus ? (
          <>
            <ActivityIndicator color={colors.primary} size="small" />
            <AppText style={styles.loadMoreLabel}>{tr.common.loadingMore}</AppText>
          </>
        ) : null}
      </View>
    ),
    [footerClearance, showLoadMoreStatus],
  );
  const setListRef = React.useCallback(
    (node: FlatList<ProfileGridItem> | null) => onListRef(tab, node),
    [onListRef, tab],
  );
  const handleScrollOffsetChange = React.useCallback(
    (offset: number) => onScrollOffsetChange(tab, offset),
    [onScrollOffsetChange, tab],
  );
  const contentHeightRef = React.useRef(0);
  const viewportHeightRef = React.useRef(0);
  const [viewportHeight, setViewportHeight] = React.useState(0);
  const emitScrollBounds = React.useCallback(() => {
    if (contentHeightRef.current <= 0 || viewportHeightRef.current <= 0) {
      return;
    }

    onScrollBoundsChange(
      tab,
      Math.max(0, contentHeightRef.current - viewportHeightRef.current),
    );
  }, [onScrollBoundsChange, tab]);
  const handleContentSizeChange = React.useCallback(
    (_width: number, height: number) => {
      contentHeightRef.current = normalizeScrollMetric(height);
      emitScrollBounds();
    },
    [emitScrollBounds],
  );
  const handlePageLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      viewportHeightRef.current = normalizeScrollMetric(event.nativeEvent.layout.height);
      setViewportHeight(viewportHeightRef.current);
      emitScrollBounds();
    },
    [emitScrollBounds],
  );
  const headerSpacer = React.useMemo(
    () => (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ height: headerSpacerHeight }}
        testID={`profile-header-spacer-${tab}`}
      />
    ),
    [headerSpacerHeight, tab],
  );

  return (
    <View onLayout={handlePageLayout} style={styles.page}>
      <VirtualizedDiscoveryGrid<ProfileGridItem>
        data={data}
        keyExtractor={keyExtractor}
        listKey={`profile:${tab}`}
        listRef={setListRef}
        ListEmptyComponent={emptyState}
        ListFooterComponent={footer}
        ListHeaderComponent={headerSpacer}
        // Tall enough to scroll the header fully away even when the tab holds
        // a few items; otherwise switching to a short tab dragged the header
        // back down and the screen jumped.
        contentContainerStyle={[
          styles.gridContent,
          viewportHeight > 0 ? { minHeight: viewportHeight + collapseRange } : null,
        ]}
        onContentSizeChange={handleContentSizeChange}
        onEndReached={active ? onEndReached : undefined}
        onRefresh={active ? onRefresh : undefined}
        onScrollOffsetChange={handleScrollOffsetChange}
        progressViewOffset={
          Platform.OS === 'android' && active && onRefresh ? headerSpacerHeight : undefined
        }
        refreshControl={iosRefreshControl}
        refreshing={active && refreshing}
        renderItem={renderItem}
      />
      {showIOSRefreshStatus ? (
        <View
          accessible
          accessibilityLabel={tr.common.refreshing}
          accessibilityLiveRegion="polite"
          accessibilityRole="progressbar"
          accessibilityState={{ busy: true }}
          pointerEvents="none"
          style={[styles.iosRefreshStatus, { top: headerSpacerHeight + spacing.sm }]}
          testID="profile-ios-refresh-status"
        >
          <ActivityIndicator
            accessible={false}
            color={colors.primary}
            importantForAccessibility="no"
            size="small"
          />
          <AppText style={styles.iosRefreshStatusText}>{tr.common.refreshing}</AppText>
        </View>
      ) : null}
    </View>
  );
});

export function ProfileContentPager({
  activeTab,
  dataByTab,
  emptyStateForTab,
  enabled = true,
  filteredLists,
  header,
  stickyHeader,
  hasNextPage,
  isFetchingNextPage,
  listRef,
  onEndReached,
  onListPress,
  onPageProgressChange,
  onPlacePress,
  onRefresh,
  onTabChange,
  onTabPreviewChange,
  refreshing = false,
  shouldShowErrorState,
  showPrivacyBadge = false,
  tabs,
}: ProfileContentPagerProps) {
  const bottomTabBarHeight = React.useContext(BottomTabBarHeightContext);
  const listNodesRef = React.useRef(
    new Map<ProfileContentTab, FlatList<ProfileGridItem>>(),
  );
  const listOffsetsRef = React.useRef(new Map<ProfileContentTab, number>());
  const listMaxOffsetsRef = React.useRef(new Map<ProfileContentTab, number>());
  const activeTabRef = React.useRef(activeTab);
  const headerHeightRef = React.useRef(0);
  const collapsibleHeightRef = React.useRef(0);
  const [collapsibleHeight, setCollapsibleHeight] = React.useState(0);
  const sharedHeaderOffsetRef = React.useRef(0);
  const sharedHeaderTranslateY = React.useRef(new Animated.Value(0)).current;
  const [headerHeight, setHeaderHeight] = React.useState(0);
  const tabKeySignature = tabs.map((tab) => tab.key).join('|');
  const tabKeys = React.useMemo(
    () =>
      tabKeySignature
        ? (tabKeySignature.split('|') as ProfileContentTab[])
        : [],
    [tabKeySignature],
  );
  const getTabLabel = React.useCallback(
    (tab: ProfileContentTab) =>
      tabs.find((candidate) => candidate.key === tab)?.label ?? tab,
    [tabs],
  );
  const footerClearance = Math.max(
    0,
    spacing.card +
      Math.max(
        typeof bottomTabBarHeight === 'number' ? bottomTabBarHeight : 0,
        layout.tabBarHeight,
      ) -
      spacing['2xl'],
  );
  activeTabRef.current = activeTab;
  const hasStickyHeader = Boolean(stickyHeader);
  // How far the header may travel: all of it, or everything above the tabs.
  const getCollapseRange = React.useCallback(
    () => (hasStickyHeader ? collapsibleHeightRef.current : headerHeightRef.current),
    [hasStickyHeader],
  );
  const collapseRange = hasStickyHeader ? collapsibleHeight : headerHeight;

  const syncListOffset = React.useCallback((tab: ProfileContentTab) => {
    const node = listNodesRef.current.get(tab);
    if (!node) {
      return;
    }

    const targetOffset = listOffsetsRef.current.get(tab) ?? 0;
    const nextOffset = resolveProfileTabScrollSyncOffset({
      headerHeight: getCollapseRange(),
      sharedHeaderOffset: sharedHeaderOffsetRef.current,
      targetMaxOffset: listMaxOffsetsRef.current.get(tab),
      targetOffset,
    });

    if (Math.abs(nextOffset - targetOffset) < 1) {
      return;
    }

    node.scrollToOffset({
      animated: false,
      offset: nextOffset,
    });
    listOffsetsRef.current.set(tab, nextOffset);
  }, [getCollapseRange]);
  const applySharedHeaderOffset = React.useCallback(
    (nextSharedHeaderOffset: number) => {
      if (Math.abs(nextSharedHeaderOffset - sharedHeaderOffsetRef.current) < 1) {
        return;
      }
      sharedHeaderOffsetRef.current = nextSharedHeaderOffset;
      sharedHeaderTranslateY.setValue(-nextSharedHeaderOffset);
      // Move the other tabs with the header now, not when a swipe reaches
      // them: a neighbour left behind showed its empty header spacer, grey,
      // for the first frames of every swipe.
      listNodesRef.current.forEach((_node, tab) => {
        if (tab !== activeTabRef.current) {
          syncListOffset(tab);
        }
      });
    },
    [sharedHeaderTranslateY, syncListOffset],
  );
  const handleCollapsibleLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = normalizeScrollMetric(event.nativeEvent.layout.height);
      if (nextHeight === 0 || Math.abs(nextHeight - collapsibleHeightRef.current) < 1) {
        return;
      }
      collapsibleHeightRef.current = nextHeight;
      setCollapsibleHeight(nextHeight);
    },
    [],
  );
  const handleHeaderLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeaderHeight = normalizeScrollMetric(event.nativeEvent.layout.height);
      if (nextHeaderHeight === 0 || Math.abs(nextHeaderHeight - headerHeightRef.current) < 1) {
        return;
      }

      headerHeightRef.current = nextHeaderHeight;
      setHeaderHeight(nextHeaderHeight);
      const nextSharedHeaderOffset = getProfileHeaderCollapseOffset(
        listOffsetsRef.current.get(activeTabRef.current) ?? 0,
        getCollapseRange(),
      );
      sharedHeaderOffsetRef.current = nextSharedHeaderOffset;
      sharedHeaderTranslateY.setValue(-nextSharedHeaderOffset);

      tabKeys.forEach((tab) => {
        if (tab !== activeTabRef.current) {
          syncListOffset(tab);
        }
      });
    },
    [getCollapseRange, sharedHeaderTranslateY, syncListOffset, tabKeys],
  );
  const handleListRef = React.useCallback(
    (tab: ProfileContentTab, node: FlatList<ProfileGridItem> | null) => {
      if (node) {
        listNodesRef.current.set(tab, node);
        syncListOffset(tab);
      } else {
        listNodesRef.current.delete(tab);
      }

      if (activeTabRef.current === tab && listRef) {
        listRef.current = node;
      }
    },
    [listRef, syncListOffset],
  );
  const handleScrollOffsetChange = React.useCallback(
    (tab: ProfileContentTab, offset: number) => {
      const nextOffset = normalizeScrollMetric(offset);
      listOffsetsRef.current.set(tab, nextOffset);

      if (activeTabRef.current === tab) {
        applySharedHeaderOffset(getProfileHeaderCollapseOffset(nextOffset, getCollapseRange()));
      }
    },
    [applySharedHeaderOffset, getCollapseRange],
  );
  const handleScrollBoundsChange = React.useCallback(
    (tab: ProfileContentTab, maxOffset: number) => {
      const nextMaxOffset = normalizeScrollMetric(maxOffset);
      listMaxOffsetsRef.current.set(tab, nextMaxOffset);

      syncListOffset(tab);
    },
    [syncListOffset],
  );
  const handleTabPreviewChange = React.useCallback(
    (tab: ProfileContentTab) => {
      syncListOffset(tab);
      onTabPreviewChange(tab);
    },
    [onTabPreviewChange, syncListOffset],
  );

  React.useEffect(() => {
    const activeList = listNodesRef.current.get(activeTab) ?? null;
    if (listRef) {
      listRef.current = activeList;
    }
    syncListOffset(activeTab);
    const nextSharedHeaderOffset = getProfileHeaderCollapseOffset(
      listOffsetsRef.current.get(activeTab) ?? 0,
      getCollapseRange(),
    );
    sharedHeaderOffsetRef.current = nextSharedHeaderOffset;
    sharedHeaderTranslateY.setValue(-nextSharedHeaderOffset);
  }, [activeTab, getCollapseRange, listRef, sharedHeaderTranslateY, syncListOffset]);

  React.useEffect(
    () => () => {
      if (listRef) {
        listRef.current = null;
      }
      listNodesRef.current.clear();
      listOffsetsRef.current.clear();
      listMaxOffsetsRef.current.clear();
    },
    [listRef],
  );

  return (
    <View style={styles.pagerShell} testID="profile-content-pager">
      <Animated.View
        collapsable={false}
        onLayout={handleHeaderLayout}
        style={[
          styles.sharedHeader,
          { transform: [{ translateY: sharedHeaderTranslateY }] },
        ]}
        testID="profile-stationary-header"
      >
        <View collapsable={false} onLayout={handleCollapsibleLayout}>
          {header}
        </View>
        {stickyHeader}
      </Animated.View>
      {headerHeight > 0 ? (
        <SwipeableTabPager
          activeTab={activeTab}
          enabled={enabled && tabKeys.length > 1}
          getTabLabel={getTabLabel}
          keepAlive
          layoutMode="fill"
          lazy
          tabs={tabKeys}
          onPageProgressChange={onPageProgressChange}
          onChange={onTabChange}
          onPreviewTabChange={handleTabPreviewChange}
          renderPage={(tab, _preview, active) => (
            <ProfileContentPage
              active={active}
              collapseRange={collapseRange}
              data={shouldShowErrorState ? [] : dataByTab[tab]}
              emptyState={emptyStateForTab(tab)}
              filteredLists={filteredLists}
              footerClearance={footerClearance}
              hasNextPage={!shouldShowErrorState && hasNextPage}
              headerSpacerHeight={headerHeight}
              isFetchingNextPage={isFetchingNextPage}
              onEndReached={onEndReached}
              onListRef={handleListRef}
              onListPress={onListPress}
              onPlacePress={onPlacePress}
              onRefresh={onRefresh}
              onScrollBoundsChange={handleScrollBoundsChange}
              onScrollOffsetChange={handleScrollOffsetChange}
              refreshing={refreshing}
              showPrivacyBadge={showPrivacyBadge}
              tab={tab}
            />
          )}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gridContent: {
    paddingTop: 0,
  },
  page: {
    flex: 1,
  },
  pagerShell: {
    backgroundColor: colors.background,
    flex: 1,
    overflow: 'hidden',
    width: '100%',
  },
  sharedHeader: {
    backgroundColor: colors.background,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: zIndex.raised,
  },
  listFooter: {
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  iosRefreshStatus: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    position: 'absolute',
    zIndex: zIndex.overlay,
  },
  iosRefreshStatusText: textStyle('metadataText', colors.textMuted, fontWeight.strong),
  loadMoreLabel: textStyle('metadataText', colors.primary, fontWeight.strong),
});
