import React from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { spacing } from '@/mobile/app/shared/theme/tokens';
import { buildAdaptiveFlatListProps } from '@/mobile/app/shared/utils/flatList';
import { getResponsiveGridLayout } from '@/mobile/app/shared/utils/layout';

type VirtualizedDiscoveryGridRenderInfo<ItemT> = {
  columnCount: number;
  item: ItemT;
  index: number;
};

type VirtualizedDiscoveryGridProps<ItemT> = {
  data: ItemT[];
  keyExtractor: (item: ItemT, index: number) => string;
  renderItem: (
    info: VirtualizedDiscoveryGridRenderInfo<ItemT>,
  ) => React.ReactElement | null;
  listKey?: string;
  columnStrategy?: 'discovery' | 'gallery';
  listRef?: React.Ref<FlatList<ItemT>>;
  ListEmptyComponent?: React.ReactElement | null;
  ListFooterComponent?: React.ReactElement | null;
  ListHeaderComponent?: React.ReactElement | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
  containsNativeMaps?: boolean;
  extraData?: unknown;
  onContentSizeChange?: (width: number, height: number) => void;
  // Keep this set, or unset, for the life of the list. On Android, adding or
  // removing it wraps the scroll view in a different parent, which rebuilds
  // the list at its top without a scroll event.
  onRefresh?: () => void;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  onScrollOffsetChange?: (offset: number) => void;
  progressViewOffset?: number;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  refreshing?: boolean;
  scrollEnabled?: boolean;
};

export function VirtualizedDiscoveryGrid<ItemT>({
  data,
  keyExtractor,
  renderItem,
  listKey,
  columnStrategy = 'discovery',
  listRef,
  ListEmptyComponent = null,
  ListFooterComponent = null,
  ListHeaderComponent = null,
  contentContainerStyle,
  containsNativeMaps = true,
  extraData,
  onContentSizeChange,
  onEndReached,
  onEndReachedThreshold = 0.55,
  onRefresh,
  onScrollOffsetChange,
  progressViewOffset,
  refreshControl,
  refreshing = false,
  scrollEnabled = true,
}: VirtualizedDiscoveryGridProps<ItemT>) {
  const appLayout = useAppLayout();
  const { columnGap, height, screenPadding, width } = appLayout;
  const { columnCount, columnWidth } = getResponsiveGridLayout(width, height, {
    gap: columnGap,
    strategy: columnStrategy,
  });
  const visibleAnchorIndexRef = React.useRef(0);
  const pendingAnchorIndexRef = React.useRef<number | null>(null);
  const previousColumnCountRef = React.useRef(columnCount);
  const internalListRef = React.useRef<FlatList<ItemT> | null>(null);
  // Read through refs so the list's ref callback keeps one identity. A new
  // callback on every page of results made React detach and reattach the
  // same list each time, and owners read that as a new list.
  const columnCountRef = React.useRef(columnCount);
  const dataLengthRef = React.useRef(data.length);
  columnCountRef.current = columnCount;
  dataLengthRef.current = data.length;
  const viewabilityConfig = React.useRef({ itemVisiblePercentThreshold: 20 }).current;

  if (previousColumnCountRef.current !== columnCount) {
    pendingAnchorIndexRef.current = visibleAnchorIndexRef.current;
    previousColumnCountRef.current = columnCount;
  }
  const listProps = React.useMemo(
    () =>
      buildAdaptiveFlatListProps({
        containsNativeMaps,
        itemCount: data.length,
        viewportHeight: height,
        viewportWidth: width,
      }),
    [containsNativeMaps, data.length, height, width],
  );
  const handleScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onScrollOffsetChange?.(event.nativeEvent.contentOffset.y);
    },
    [onScrollOffsetChange],
  );
  const cellWidthStyle = React.useMemo(() => ({ width: columnWidth }), [columnWidth]);
  const bottomClearanceStyle = React.useMemo(
    () => ({ paddingBottom: spacing['2xl'] }),
    [],
  );
  const singleColumnCellStyle = React.useMemo(
    () => columnCount === 1 ? { marginHorizontal: screenPadding } : null,
    [columnCount, screenPadding],
  );
  const rowStyle = React.useMemo(
    () => columnCount > 1
      ? [styles.row, { gap: columnGap, paddingHorizontal: screenPadding }]
      : undefined,
    [columnCount, columnGap, screenPadding],
  );
  const renderCell = React.useCallback(
    ({ item, index }: { item: ItemT; index: number }) => (
      <View style={[styles.cell, cellWidthStyle, singleColumnCellStyle]}>
        {renderItem({ columnCount, item, index })}
      </View>
    ),
    [cellWidthStyle, columnCount, renderItem, singleColumnCellStyle],
  );
  const handleListRef = React.useCallback(
    (node: FlatList<ItemT> | null) => {
      internalListRef.current = node;

      if (typeof listRef === 'function') {
        listRef(node);
      } else if (listRef) {
        listRef.current = node;
      }

      if (!node || pendingAnchorIndexRef.current == null) {
        return;
      }

      const anchorIndex =
        Math.floor(pendingAnchorIndexRef.current / columnCountRef.current) * columnCountRef.current;
      pendingAnchorIndexRef.current = null;
      requestAnimationFrame(() => {
        node.scrollToIndex({
          animated: false,
          index: Math.min(anchorIndex, Math.max(dataLengthRef.current - 1, 0)),
        });
      });
    },
    [listRef],
  );
  const handleScrollToIndexFailed = React.useCallback(
    ({ averageItemLength, index }: { averageItemLength: number; index: number }) => {
      const rowIndex = Math.floor(index / columnCount);
      internalListRef.current?.scrollToOffset({
        animated: false,
        offset: Math.max(0, averageItemLength * rowIndex),
      });
    },
    [columnCount],
  );
  const handleViewableItemsChanged = React.useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null; isViewable: boolean }> }) => {
      const firstVisible = viewableItems.find((item) => item.isViewable && item.index != null);
      if (firstVisible?.index != null) {
        visibleAnchorIndexRef.current = firstVisible.index;
      }
    },
  ).current;

  return (
    <FlatList
      {...listProps}
      ref={handleListRef}
      key={`${listKey ?? 'discovery-grid'}:${columnCount}`}
      data={data}
      extraData={extraData}
      nestedScrollEnabled
      numColumns={columnCount}
      keyExtractor={keyExtractor}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      renderItem={renderCell}
      columnWrapperStyle={rowStyle}
      contentContainerStyle={[
        data.length === 0 ? styles.contentEmpty : null,
        contentContainerStyle,
        bottomClearanceStyle,
      ]}
      progressViewOffset={progressViewOffset}
      refreshControl={refreshControl}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onEndReached={onEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
      onContentSizeChange={onContentSizeChange}
      onScroll={onScrollOffsetChange ? handleScroll : undefined}
      onScrollToIndexFailed={handleScrollToIndexFailed}
      onViewableItemsChanged={handleViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      scrollEnabled={scrollEnabled}
      scrollEventThrottle={onScrollOffsetChange ? 16 : undefined}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={ListFooterComponent}
      showsVerticalScrollIndicator={false}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  contentEmpty: {
    flexGrow: 1,
  },
  row: {
    justifyContent: 'flex-start',
  },
  cell: {
    marginBottom: spacing.sm,
  },
});
