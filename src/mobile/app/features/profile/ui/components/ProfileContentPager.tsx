import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';
import {
  ListGridTile,
  PlaceGridTile,
} from '@/mobile/app/features/discovery/public/components';
import {
  SwipeableTabPager,
} from '@/mobile/app/shared/components/navigation/SwipeableTabPager';
import { StaticDiscoveryGrid } from '@/mobile/app/shared/components/ui/StaticDiscoveryGrid';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { getMarkerColorForMemberships } from '@/mobile/app/shared/utils/markerColors';

export type ProfileContentTab = 'lists' | 'places' | 'gallery';
export type ProfileGridItem = PlaceList | PlaceFeedCardItem;

type ProfileContentPagerProps = {
  activeTab: ProfileContentTab;
  dataByTab: Record<ProfileContentTab, ProfileGridItem[]>;
  emptyStateForTab: (tab: ProfileContentTab) => React.ReactElement;
  enabled?: boolean;
  filteredLists: PlaceList[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onContentHeightChange: (tab: ProfileContentTab, height: number) => void;
  onListPress: (list: PlaceList) => void;
  onPageProgressChange: (pageOffset: number) => void;
  onPlacePress: (tab: Exclude<ProfileContentTab, 'lists'>, index: number) => void;
  onTabChange: (tab: ProfileContentTab) => void;
  onTabPreviewChange: (tab: ProfileContentTab) => void;
  pagerHeight: number;
  shouldShowErrorState: boolean;
  showPrivacyBadge?: boolean;
  tabs: Array<{ key: ProfileContentTab; label: string }>;
};

export function ProfileContentPager({
  activeTab,
  dataByTab,
  emptyStateForTab,
  enabled = true,
  filteredLists,
  hasNextPage,
  isFetchingNextPage,
  onContentHeightChange,
  onListPress,
  onPageProgressChange,
  onPlacePress,
  onTabChange,
  onTabPreviewChange,
  pagerHeight,
  shouldShowErrorState,
  showPrivacyBadge = false,
  tabs,
}: ProfileContentPagerProps) {
  const tabKeys = React.useMemo(() => tabs.map((tab) => tab.key), [tabs]);
  const getTabLabel = React.useCallback(
    (tab: ProfileContentTab) =>
      tabs.find((candidate) => candidate.key === tab)?.label ?? tab,
    [tabs],
  );

  return (
    <View
      style={[styles.pagerShell, { height: pagerHeight }]}
      testID="profile-content-pager"
    >
      <SwipeableTabPager
        activeTab={activeTab}
        enabled={enabled && tabKeys.length > 1}
        getTabLabel={getTabLabel}
        keepAlive={false}
        layoutMode="fill"
        lazy
        tabs={tabKeys}
        onPageProgressChange={onPageProgressChange}
        onChange={onTabChange}
        onPreviewTabChange={onTabPreviewChange}
        renderPage={(tab, _preview, active) => (
          <StaticDiscoveryGrid<ProfileGridItem>
            data={shouldShowErrorState ? [] : dataByTab[tab]}
            contentContainerStyle={styles.gridContent}
            onContentHeightChange={(height) => onContentHeightChange(tab, height)}
            ListEmptyComponent={emptyStateForTab(tab)}
            ListFooterComponent={
              !shouldShowErrorState && active && hasNextPage && isFetchingNextPage ? (
                <View style={styles.loadMoreStatus}>
                  <ActivityIndicator color={colors.primary} size="small" />
                  <Text style={styles.loadMoreLabel}>
                    {tr.common.loadingMore}
                  </Text>
                </View>
              ) : null
            }
            keyExtractor={(item, index) =>
              tab === 'lists'
                ? (item as PlaceList).id
                : (item as PlaceFeedCardItem).key || `${tab}:${index}`
            }
            renderItem={({ item, index }) => {
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
            }}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  gridContent: {
    paddingTop: 0,
  },
  pagerShell: {
    backgroundColor: colors.background,
    width: '100%',
  },
  loadMoreStatus: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  loadMoreLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
});
