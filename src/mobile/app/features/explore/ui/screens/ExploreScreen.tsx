import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useScrollToTop } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import type { FlatList } from 'react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import {
  openStackScreen,
  useAppNavigation,
} from '@/mobile/app/app-shell/navigation/navigation';
import { useExploreFollowToggle } from '@/mobile/app/features/explore/application/useExploreFollowToggle';
import { useExploreScreenState } from '@/mobile/app/features/explore/application/useExploreScreenState';
import {
  warmListDetailData,
  warmUserProfileData,
} from '@/mobile/app/app-shell/startup/startupDataWarmup';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import { PlaceFeedScreen } from '@/mobile/app/features/places/public/feed';
import { ExploreHeaderControls } from '@/mobile/app/features/explore/ui/components/ExploreHeaderControls';
import { ExplorePagerLayout } from '@/mobile/app/features/explore/ui/components/ExplorePagerLayout';
import {
  ExploreResultsPage,
  type ExploreGridItem,
} from '@/mobile/app/features/explore/ui/components/ExploreResultsPage';
import type {
  ExploreFeedMode,
  ExploreTabType,
} from '@/mobile/app/features/explore/ui/components/exploreScreenTypes';
import { UnfollowConfirmModal } from '@/mobile/app/shared/components/feedback/UnfollowConfirmModal';
import { OverlayHost } from '@/mobile/app/shared/components/navigation/OverlayHost';
import { SwipeableTabPager } from '@/mobile/app/shared/components/navigation/SwipeableTabPager';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import {
  MosaicGridSkeleton,
} from '@/mobile/app/shared/components/ui/SkeletonPlaceholder';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { useTabReselect } from '@/mobile/app/shared/hooks/useTabReselect';
import { useScrollAwayHeader } from '@/mobile/app/shared/hooks/useScrollAwayHeader';
import { useTabScrollMemory } from '@/mobile/app/shared/hooks/useTabScrollMemory';
import { useScreenPerformanceMetric } from '@/mobile/app/shared/performance/useScreenPerformanceMetric';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { spacing } from '@/mobile/app/shared/theme/tokens';

const EXPLORE_PAGER_TABS = ['lists', 'places', 'photos', 'people'] as const;
const EXPLORE_TAB_LABELS: Record<ExploreTabType, string> = {
  lists: tr.explore.tabs.lists,
  people: tr.explore.tabs.people,
  photos: tr.explore.tabs.photos,
  places: tr.explore.tabs.places,
};

type ExploreBrowseHeaderProps = {
  activeTab: ExploreTabType;
  onRetry: () => void;
  onSearchQueryChange: (value: string) => void;
  onTabChange: (tab: ExploreTabType) => void;
  resultCount?: number;
  resultsHidden: boolean;
  resultsPending: boolean;
  resultsPreviewing: boolean;
  screenPadding: number;
  searchQuery: string;
  showPartialDataNotice: boolean;
};

const ExploreBrowseHeader = React.memo(function ExploreBrowseHeader({
  activeTab,
  onRetry,
  onSearchQueryChange,
  onTabChange,
  resultCount,
  resultsHidden,
  resultsPending,
  resultsPreviewing,
  screenPadding,
  searchQuery,
  showPartialDataNotice,
}: ExploreBrowseHeaderProps) {
  return (
    <View>
      <ExploreHeaderControls
        activeTab={activeTab}
        resultCount={resultCount}
        resultsHidden={resultsHidden}
        resultsPending={resultsPending}
        resultsPreviewing={resultsPreviewing}
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        onTabChange={onTabChange}
      />
      {showPartialDataNotice ? (
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
            onAction={onRetry}
          />
        </View>
      ) : null}
    </View>
  );
});

export function ExploreScreen() {
  const navigation = useAppNavigation();
  const { user } = useAuth();
  const { screenPadding } = useAppLayout();
  const activeListRef = React.useRef<FlatList<ExploreGridItem> | null>(null);
  const [activeTab, setActiveTab] = useState<ExploreTabType>('lists');
  const [visibleTab, setVisibleTab] = useState<ExploreTabType>('lists');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedMode, setFeedMode] = useState<ExploreFeedMode | null>(null);
  const browseHeader = useScrollAwayHeader();
  const revealBrowseHeader = browseHeader.reveal;
  const activeTabRef = React.useRef(activeTab);
  activeTabRef.current = activeTab;
  const {
    getTabScrollRef,
    getTabScrollRefCallback,
    notifyTabContentReady,
    recordTabScrollOffset,
    restoreTabScrollOffset,
  } = useTabScrollMemory<ExploreTabType>();
  const {
    errorMessage,
    debouncedSearchQuery,
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
    searchTooShort,
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
  useTabReselect(Boolean(feedMode), () => setFeedMode(null));
  useEffect(() => {
    activeListRef.current = getTabScrollRef(activeTab) as FlatList<ExploreGridItem> | null;
    restoreTabScrollOffset(activeTab);
    // A new tab starts with the search and tabs in view.
    revealBrowseHeader();
  }, [activeTab, getTabScrollRef, restoreTabScrollOffset, revealBrowseHeader]);
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
      setVisibleTab(nextTab);

      if (nextTab === activeTab) {
        scrollActiveListToTop();
        return;
      }

      restoreTabScrollOffset(nextTab);
      setActiveTab(nextTab);
    },
    [activeTab, restoreTabScrollOffset, scrollActiveListToTop],
  );

  const handleTabPreviewChange = useCallback(
    (nextTab: ExploreTabType) => {
      setVisibleTab(nextTab);
      restoreTabScrollOffset(nextTab);
    },
    [restoreTabScrollOffset],
  );
  const handleRetry = useCallback(() => {
    void retry();
  }, [retry]);

  const { cancelUnfollow, confirmUnfollow, requestFollowToggle, unfollowTarget } =
    useExploreFollowToggle({ followUser, following, people: filteredUsers });
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
  const warmListIntent = useCallback(
    (listId: string) => {
      if (user?.id) {
        void warmListDetailData({ listId, queryClient, viewerId: user.id });
      }
    },
    [user?.id],
  );
  const warmOwnerIntent = useCallback(
    (targetUserId: string) => {
      if (user?.id) {
        void warmUserProfileData({ queryClient, targetUserId, viewerId: user.id });
      }
    },
    [user?.id],
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

  if (!user || isInitialLoading) {
    return (
      <Screen safeTop={false} padded={false} scroll={false}>
        <View style={loadMoreStyles.content}>
          <ExploreHeaderControls
            activeTab={activeTab}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onTabChange={handleTabChange}
          />
          <MosaicGridSkeleton />
        </View>
      </Screen>
    );
  }

  // Opened over the results rather than in their place, so each tab keeps
  // its scroll. The Explore tab's header already clears the status bar.
  const feedOverlay = feedMode ? (
    <PlaceFeedScreen
      safeTop={false}
      title={tr.explore.title}
      items={feedMode.kind === 'places' ? filteredPlaces : filteredPhotos}
      startIndex={feedMode.startIndex}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onBack={() => setFeedMode(null)}
      ownerFor={(item) => item.owner}
      onOwnerPress={(item) =>
        item.owner && openStackScreen(navigation, 'UserProfile', { userId: item.owner.id })
      }
      onOpenListDetail={(item) =>
        openStackScreen(navigation, 'ListDetail', {
          listId: item.listId,
          placeId: item.place.id,
        })
      }
    />
  ) : null;

  return (
    <OverlayHost overlay={feedOverlay}>
      <Screen safeTop={false} padded={false} scroll={false}>
        <ExplorePagerLayout
          headerController={browseHeader}
          header={
            <ExploreBrowseHeader
              activeTab={visibleTab}
              onRetry={handleRetry}
              onSearchQueryChange={setSearchQuery}
              onTabChange={handleTabChange}
              // The count follows the tab being swiped to and never leaves: while
              // a swipe was in flight it used to vanish, the header lost a line,
              // and the whole pager jumped up and back down.
              resultCount={dataByTab[visibleTab].length}
              resultsHidden={searchTooShort}
              // Typing, or the tab's first page still loading: not yet a count.
              resultsPending={
                searchQuery.trim() !== debouncedSearchQuery.trim() ||
                queryStateByTab[visibleTab].isLoading
              }
              resultsPreviewing={visibleTab !== activeTab}
              screenPadding={screenPadding}
              searchQuery={searchQuery}
              showPartialDataNotice={hasPartialDataError && hasAnyBrowseData}
            />
          }
          pager={
            <SwipeableTabPager
              activeTab={activeTab}
              enabled={!refreshing && !feedMode}
              getTabLabel={(tab) => EXPLORE_TAB_LABELS[tab]}
              keepAlive
              lazy
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
                    isLoading={tabQuery.isLoading}
                    listRef={getTabScrollRefCallback(tab)}
                    onContentReady={() => notifyTabContentReady(tab)}
                    onClearSearch={() => setSearchQuery('')}
                    onEndReached={() => handleEndReached(tab)}
                    onFollowUser={requestFollowToggle}
                    onListIntent={warmListIntent}
                    onListPress={openListDetail}
                    onOwnerIntent={warmOwnerIntent}
                    onOwnerPress={openUserProfile}
                    onPlacePress={(pageTab, index) =>
                      setFeedMode({
                        kind: pageTab === 'photos' ? 'photos' : 'places',
                        startIndex: index,
                      })
                    }
                    onRefresh={onRefresh}
                    onRetry={retry}
                    onScrollOffsetChange={(offset) => {
                      recordTabScrollOffset(tab, offset);
                      if (tab === activeTabRef.current) {
                        browseHeader.onScrollOffset(offset);
                      }
                    }}
                    pendingFollowRequests={pendingFollowRequests}
                    refreshing={refreshing}
                    searchQuery={debouncedSearchQuery}
                  searchTooShort={searchTooShort}
                    tab={tab}
                    topInset={browseHeader.height}
                  />
                );
              }}
            />
          }
        />
        <UnfollowConfirmModal
          target={unfollowTarget}
          onClose={cancelUnfollow}
          onConfirm={confirmUnfollow}
        />
      </Screen>
    </OverlayHost>
  );
}

const loadMoreStyles = StyleSheet.create({
  noticeWrap: {
    paddingBottom: spacing.md,
  },
  content: {
    paddingBottom: spacing.lg,
  },
});
