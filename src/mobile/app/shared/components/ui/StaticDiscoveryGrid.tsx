import React from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';

type StaticDiscoveryGridRenderInfo<ItemT> = {
  item: ItemT;
  index: number;
};

type StaticDiscoveryGridProps<ItemT> = {
  data: ItemT[];
  keyExtractor: (item: ItemT, index: number) => string;
  renderItem: (
    info: StaticDiscoveryGridRenderInfo<ItemT>,
  ) => React.ReactElement | null;
  ListEmptyComponent?: React.ReactElement | null;
  ListFooterComponent?: React.ReactElement | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
  onContentHeightChange?: (height: number) => void;
};

export function StaticDiscoveryGrid<ItemT>({
  data,
  keyExtractor,
  renderItem,
  ListEmptyComponent = null,
  ListFooterComponent = null,
  contentContainerStyle,
  onContentHeightChange,
}: StaticDiscoveryGridProps<ItemT>) {
  const { columnCount, columnGap, screenPadding, width } = useAppLayout();
  const bottomPadding = 20;
  const columnWidth = Math.max(
    120,
    Math.floor(
      (width - screenPadding * 2 - columnGap * (columnCount - 1)) / columnCount,
    ),
  );
  const columns = React.useMemo(
    () =>
      Array.from({ length: columnCount }, (_, columnIndex) =>
        data
          .map((item, index) => ({ index, item }))
          .filter(({ index }) => index % columnCount === columnIndex),
      ),
    [columnCount, data],
  );
  const handleContentLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      onContentHeightChange?.(Math.ceil(event.nativeEvent.layout.height));
    },
    [onContentHeightChange],
  );

  if (data.length === 0) {
    return (
      <View
        onLayout={handleContentLayout}
        style={[
          styles.content,
          styles.emptyContent,
          { paddingBottom: bottomPadding },
          contentContainerStyle,
        ]}
      >
        {ListEmptyComponent}
        {ListFooterComponent}
      </View>
    );
  }

  return (
    <View
      onLayout={handleContentLayout}
      style={[
        styles.content,
        { paddingBottom: bottomPadding },
        contentContainerStyle,
      ]}
    >
      <View
        style={[
          styles.grid,
          { gap: columnGap, paddingHorizontal: screenPadding },
        ]}
      >
        {columns.map((columnItems, columnIndex) => (
          <View
            key={`column:${columnIndex}`}
            style={[styles.column, { width: columnWidth }]}
          >
            {columnItems.map(({ item, index }) => (
              <View key={keyExtractor(item, index)} style={styles.cell}>
                {renderItem({ item, index })}
              </View>
            ))}
          </View>
        ))}
      </View>
      {ListFooterComponent}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 16,
  },
  emptyContent: {
    minHeight: 224,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  column: {
    gap: 8,
  },
  cell: {
    width: '100%',
  },
});
