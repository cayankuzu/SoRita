import React from "react";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import {
  FlatList,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useAppLayout } from "@/mobile/app/shared/hooks/useAppLayout";
import { layout } from "@/mobile/app/shared/theme/tokens";
import { buildAdaptiveFlatListProps } from "@/mobile/app/shared/utils/flatList";

type VirtualizedDiscoveryGridRenderInfo<ItemT> = {
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
  listRef?: React.Ref<FlatList<ItemT>>;
  ListEmptyComponent?: React.ReactElement | null;
  ListFooterComponent?: React.ReactElement | null;
  ListHeaderComponent?: React.ReactElement | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
  containsNativeMaps?: boolean;
  extraData?: unknown;
  onContentSizeChange?: (width: number, height: number) => void;
  onRefresh?: () => void;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  onScrollOffsetChange?: (offset: number) => void;
  refreshing?: boolean;
};

export function VirtualizedDiscoveryGrid<ItemT>({
  data,
  keyExtractor,
  renderItem,
  listKey,
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
  refreshing = false,
}: VirtualizedDiscoveryGridProps<ItemT>) {
  const bottomTabBarHeight = React.useContext(BottomTabBarHeightContext);
  const appLayout = useAppLayout();
  const { columnCount, columnGap, height, screenPadding, width } = appLayout;
  const bottomPadding =
    24 +
    Math.max(
      typeof bottomTabBarHeight === "number" ? bottomTabBarHeight : 0,
      layout.tabBarHeight,
    );
  const columnWidth = Math.max(
    120,
    Math.floor(
      (width - screenPadding * 2 - columnGap * (columnCount - 1)) / columnCount,
    ),
  );
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

  return (
    <FlatList
      {...listProps}
      ref={listRef}
      key={`${listKey ?? "discovery-grid"}:${columnCount}`}
      data={data}
      extraData={extraData}
      numColumns={columnCount}
      keyExtractor={keyExtractor}
      renderItem={({ item, index }) => (
        <View
          style={[
            styles.cell,
            { width: columnWidth },
            columnCount === 1 ? { marginHorizontal: screenPadding } : null,
          ]}
        >
          {renderItem({ item, index })}
        </View>
      )}
      columnWrapperStyle={
        columnCount > 1
          ? [styles.row, { gap: columnGap, paddingHorizontal: screenPadding }]
          : undefined
      }
      contentContainerStyle={[
        styles.content,
        { paddingBottom: bottomPadding },
        data.length === 0 ? styles.contentEmpty : null,
        contentContainerStyle,
      ]}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onEndReached={onEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
      onContentSizeChange={onContentSizeChange}
      onScroll={onScrollOffsetChange ? handleScroll : undefined}
      scrollEventThrottle={onScrollOffsetChange ? 16 : undefined}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={ListFooterComponent}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 20,
  },
  contentEmpty: {
    flexGrow: 1,
  },
  row: {
    justifyContent: "flex-start",
  },
  cell: {
    marginBottom: 10,
  },
});
