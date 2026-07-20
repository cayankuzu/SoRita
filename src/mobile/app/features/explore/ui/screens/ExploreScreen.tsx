import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useScrollToTop } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import type { FlatList } from 'react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import {
  openStackScreen,
  useAppNavigation,
} from '@/mobile/app/app-shell/navigation/navigation';
import { useExploreScreenState } from '@/mobile/app/features/explore/application/useExploreScreenState';
import { ExploreFeedView } from '@/mobile/app/features/explore/ui/components/ExploreFeedView';
import { ExploreHeaderControls } from '@/mobile/app/features/explore/ui/components/ExploreHeaderControls';
import {
  ExploreResultsPage,
  type ExploreGridItem,
} from '@/mobile/app/features/explore/ui/components/ExploreResultsPage';
import type {
  ExploreFeedMode,
  ExploreTabType,
} from '@/mobile/app/features/explore/ui/components/exploreScreenTypes';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { SwipeableTabPager } from '@/mobile/app/shared/components/navigation/SwipeableTabPager';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import {
  ListGridTileSkeleton,
  SkeletonGroup,
} from '@/mobile/app/shared/components/ui/SkeletonPlaceholder';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { useTabScrollMemory } from '@/mobile/app/shared/hooks/useTabScrollMemory';
import { useScreenPerformanceMetric } from '@/mobile/app/shared/performance/useScreenPerformanceMetric';
import { tr } from '@/mobile/app/shared/i18n/tr';

const EXPLORE_PAGER_TABS = ['lists', 'places', 'photos', 'people'] as const;
const EXPLORE_TAB_LABELS: Record<ExploreTabType, string> = {
  lists: tr.explore.tabs.lists,
  people: tr.explore.tabs.people,
  photos: tr.explore.tabs.photos,
  places: tr.explore.tabs.places,
};

export function ExploreScreen() {
  const navigation = useAppNavigation();
  const { user } = useAuth();
  const { screenPadding } = useAppLayout();
  const activeListRef = React.useRef<FlatList<ExploreGridItem> | null>(null);
  const [activeTab, setActiveTab] = useState<ExploreTabType>('lists');
  const [visibleTab, setVisibleTab] = useState<ExploreTabType>('lists');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedMode, setFeedMode] = useState<ExploreFeedMode | null>(null);
  const {
    getTabScrollRef,
    getTabScrollRefCallback,
    notifyTabContentReady,
    recordTabScrollOffset,
    restoreTabScrollOffset,
  } = useTabScrollMemory<ExploreTabType>();
  const {
    errorMessage,
    filteredListItems,
    filteredPhotos,
    filteredPlaces,
    filteredUsers,
    followUser,
    following,
    hasPartialDataError,
    isInitialLoading,
    pendingFollowRequests,
    queryStateByTab,
    refreshing,
    retry,
    onRefresh,
  } = useExploreScreenState({
    activeTab,
    user,
    searchQuery,
  });
  const hasAnyBrowseData =
    filteredListItems.length > 0 ||
    filteredPlaces.length > 0 ||
    filteredPhotos.length > 0 ||
    filteredUsers.length > 0;
  useScreenPerformanceMetric({
    hasContent: hasAnyBrowseData,
    hasError: Boolean(errorMessage),
    isLoading: isInitialLoading,
    screen: 'explore',
  });
  useScrollToTop(activeListRef as React.RefObject<FlatList>);
  useEffect(() => {
    activeListRef.current = getTabScrollRef(activeTab) as FlatList<ExploreGridItem> | null;
    restoreTabScrollOffset(activeTab);
  }, [activeTab, getTabScrollRef, restoreTabScrollOffset]);
  const listMarkerLists = useMemo(
    () => filteredListItems.map(({ list }) => list),
    [filteredListItems],
  );
  const dataByTab = useMemo(
    () => ({
      lists: filteredListItems,
      people: filteredUsers,
      photos: filteredPhotos,
      places: filteredPlaces,
    }) satisfies Record<ExploreTabType, ExploreGridItem[]>,
    [filteredListItems, filteredPhotos, filteredPlaces, filteredUsers],
  );

  const scrollActiveListToTop = useCallback(() => {
    activeListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const handleTabChange = useCallback(
    (nextTab: ExploreTabType) => {
      if (nextTab === activeTab) {
        scrollActiveListToTop();
        return;
      }

      restoreTabScrollOffset(nextTab);
      setVisibleTab(nextTab);
      setActiveTab(nextTab);
    },
    [activeTab, restoreTabScrollOffset, scrollActiveListToTop],
  );

  const handleTabPreviewChange = useCallback(
    (nextTab: ExploreTabType) => {
      restoreTabScrollOffset(nextTab);
      setVisibleTab(nextTab);
    },
    [restoreTabScrollOffset],
  );

  const handleFollowUser = useCallback(
    async (targetUserId: string) => {
      const result = await followUser(targetUserId);
      showToast(
        result === 'requested'
          ? tr.explore.toast.followRequestSent
          : result === 'following'
            ? tr.explore.toast.userFollowed
            : tr.explore.toast.followUpdated,
        'success',
      );
    },
    [followUser],
  );
  const openUserProfile = useCallback(
    (userId: string) => {
      openStackScreen(navigation, 'UserProfile', { userId });
    },
    [navigation],
  );
  const openListDetail = useCallback(
    (listId: string) => {
      openStackScreen(navigation, 'ListDetail', { listId });
    },
    [navigation],
  );
  const handleEndReached = useCallback(
    (tab: ExploreTabType) => {
      const tabQuery = queryStateByTab[tab];

      if (!tabQuery.hasNextPage || tabQuery.isFetchingNextPage || errorMessage) {
        return;
      }

      void tabQuery.fetchNextPage?.();
    },
    [errorMessage, queryStateByTab],
  );

  if (!user) {
    return null;
  }

  if (isInitialLoading) {
    return (
      <Screen safeTop={false} padded={false} scroll={false}>
        <View style={loadMoreStyles.content}>
          <ExploreHeaderControls
            activeTab={visibleTab}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onTabChange={handleTabChange}
          />
          <SkeletonGroup style={loadMoreStyles.skeletonGrid}>
            <View style={{ paddingHorizontal: screenPadding, gap: 14 }}>
              <ListGridTileSkeleton />
              <ListGridTileSkeleton />
              <ListGridTileSkeleton />
              <ListGridTileSkeleton />
            </View>
          </SkeletonGroup>
        </View>
      </Screen>
    );
  }

  if (feedMode) {
    const feedItems =
      feedMode.kind === 'places' ? filteredPlaces : filteredPhotos;

    return (
      <ExploreFeedView
        items={feedItems}
        startIndex={feedMode.startIndex}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onBack={() => setFeedMode(null)}
      />
    );
  }

  return (
    <Screen safeTop={false} padded={false} scroll={false}>
      <View style={loadMoreStyles.screen}>
        <ExploreHeaderControls
          activeTab={visibleTab}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onTabChange={handleTabChange}
        />
        {hasPartialDataError && hasAnyBrowseData ? (
          <View
            style={[
              loadMoreStyles.noticeWrap,
              { paddingHorizontal: screenPadding },
            ]}
          >
            <InlineNotice
              tone="warning"
              title={tr.explore.partialDataTitle}
              description={tr.explore.partialDataDescription}
              actionLabel={tr.common.retry}
              onAction={() => {
                void retry();
              }}
            />
          </View>
        ) : null}
        <SwipeableTabPager
          activeTab={activeTab}
          enabled={!refreshing && !feedMode}
          getTabLabel={(tab) => EXPLORE_TAB_LABELS[tab]}
          keepAlive
          tabs={EXPLORE_PAGER_TABS}
          onChange={handleTabChange}
          onPreviewTabChange={handleTabPreviewChange}
          renderPage={(tab, _preview, active) => {
            const tabQuery = queryStateByTab[tab];

            return (
              <ExploreResultsPage
                active={active}
                data={dataByTab[tab]}
                errorMessage={
                  active && errorMessage && !hasAnyBrowseData
                    ? errorMessage
                    : null
                }
                following={following}
                hasNextPage={tabQuery.hasNextPage}
                isFetchingNextPage={tabQuery.isFetchingNextPage}
                listMarkerLists={listMarkerLists}
                listRef={getTabScrollRefCallback(tab)}
                onContentReady={() => notifyTabContentReady(tab)}
                onEndReached={() => handleEndReached(tab)}
                onFollowUser={(targetUserId) => {
                  void handleFollowUser(targetUserId);
                }}
                onListPress={openListDetail}
                onOwnerPress={openUserProfile}
                onPlacePress={(pageTab, index) =>
                  setFeedMode({
                    kind: pageTab === 'photos' ? 'photos' : 'places',
                    startIndex: index,
                  })
                }
                onRefresh={onRefresh}
                onRetry={retry}
                onScrollOffsetChange={(offset) =>
                  recordTabScrollOffset(tab, offset)
                }
                pendingFollowRequests={pendingFollowRequests}
                refreshing={refreshing}
                searchQuery={searchQuery}
                tab={tab}
              />
            );
          }}
        />
      </View>
    </Screen>
  );
}

const loadMoreStyles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  noticeWrap: {
    paddingBottom: 12,
  },
  content: {
    paddingBottom: 20,
  },
  skeletonGrid: {
    gap: 14,
  },
});
