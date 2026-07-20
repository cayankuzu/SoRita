import React from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  type LayoutChangeEvent,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { colors, layout, spacing } from '@/mobile/app/shared/theme/tokens';

const PROFILE_OUTER_DATA = ['profile-content'] as const;

type ProfileOuterItem = (typeof PROFILE_OUTER_DATA)[number];

type ProfilePagedScrollContainerProps = {
  header: React.ReactElement;
  listRef?: React.RefObject<FlatList<ProfileOuterItem> | null>;
  pager: React.ReactElement;
  pagerHeight?: number;
  onEndReached?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
};

const renderPagerItemFactory =
  (pager: React.ReactElement): ListRenderItem<ProfileOuterItem> =>
  () =>
    pager;

export function ProfilePagedScrollContainer({
  header,
  listRef,
  pager,
  pagerHeight,
  onEndReached,
  onRefresh,
  refreshing = false,
}: ProfilePagedScrollContainerProps) {
  const internalListRef = React.useRef<FlatList<ProfileOuterItem> | null>(null);
  const contentHeightRef = React.useRef(0);
  const viewportHeightRef = React.useRef(0);
  const scrollOffsetRef = React.useRef(0);
  const previousPagerHeightRef = React.useRef(pagerHeight);
  const bottomTabBarHeight = React.useContext(BottomTabBarHeightContext);
  const bottomPadding =
    spacing.card +
    Math.max(
      typeof bottomTabBarHeight === 'number' ? bottomTabBarHeight : 0,
      layout.tabBarHeight,
    );
  const renderPagerItem = React.useMemo(
    () => renderPagerItemFactory(pager),
    [pager],
  );
  const setListNode = React.useCallback(
    (node: FlatList<ProfileOuterItem> | null) => {
      internalListRef.current = node;
      if (listRef) {
        listRef.current = node;
      }
    },
    [listRef],
  );
  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    viewportHeightRef.current = event.nativeEvent.layout.height;
  }, []);
  const handleScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetRef.current = Math.max(0, event.nativeEvent.contentOffset.y);
    },
    [],
  );

  React.useLayoutEffect(() => {
    const previousHeight = previousPagerHeightRef.current;
    previousPagerHeightRef.current = pagerHeight;

    if (
      previousHeight == null ||
      pagerHeight == null ||
      pagerHeight >= previousHeight
    ) {
      return;
    }

    const projectedContentHeight = Math.max(
      0,
      contentHeightRef.current - (previousHeight - pagerHeight),
    );
    const nextMaximumOffset = Math.max(
      0,
      projectedContentHeight - viewportHeightRef.current,
    );

    if (scrollOffsetRef.current <= nextMaximumOffset + 1) {
      return;
    }

    scrollOffsetRef.current = nextMaximumOffset;
    internalListRef.current?.scrollToOffset({
      animated: false,
      offset: nextMaximumOffset,
    });
  }, [pagerHeight]);

  return (
    <FlatList
      ref={setListNode}
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: bottomPadding,
        },
      ]}
      data={PROFILE_OUTER_DATA}
      keyExtractor={(item) => item}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      nestedScrollEnabled
      onContentSizeChange={(_width, height) => {
        contentHeightRef.current = height;
      }}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.72}
      onLayout={handleLayout}
      onScroll={handleScroll}
      overScrollMode="always"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        ) : undefined
      }
      removeClippedSubviews={false}
      renderItem={renderPagerItem}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      style={styles.list}
      testID="profile-outer-scroll"
      windowSize={3}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  list: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
