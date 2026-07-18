import React from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { FlatList, StyleSheet } from 'react-native';
import type { ListRenderItem } from 'react-native';

import { layout, spacing } from '@/mobile/app/shared/theme/tokens';

const PROFILE_OUTER_DATA = ['profile-content'] as const;

type ProfileOuterItem = (typeof PROFILE_OUTER_DATA)[number];

type ProfilePagedScrollContainerProps = {
  header: React.ReactElement;
  listRef?: React.RefObject<FlatList<ProfileOuterItem> | null>;
  pager: React.ReactElement;
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
  onRefresh,
  refreshing = false,
}: ProfilePagedScrollContainerProps) {
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

  return (
    <FlatList
      ref={listRef}
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
      onRefresh={onRefresh}
      overScrollMode="always"
      refreshing={refreshing}
      removeClippedSubviews={false}
      renderItem={renderPagerItem}
      showsVerticalScrollIndicator={false}
      style={styles.list}
      windowSize={3}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  list: {
    flex: 1,
  },
});
