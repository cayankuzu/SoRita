import React, { useCallback, useMemo, useState } from 'react';
import { useScrollToTop } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { FlatList } from 'react-native';
import { Compass } from 'lucide-react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import {
  openStackScreen,
  useAppNavigation,
} from '@/mobile/app/app-shell/navigation/navigation';
import type { User } from '@/mobile/app/data/contracts/entities';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';
import {
  ListGridTile,
  PlaceGridTile,
  UserGridTile,
} from '@/mobile/app/features/discovery/public/components';
import { useExploreScreenState } from '@/mobile/app/features/explore/application/useExploreScreenState';
import { ExploreFeedView } from '@/mobile/app/features/explore/ui/components/ExploreFeedView';
import { ExploreHeaderControls } from '@/mobile/app/features/explore/ui/components/ExploreHeaderControls';
import type {
  ExploreFeedMode,
  ExploreTabType,
} from '@/mobile/app/features/explore/ui/components/exploreScreenTypes';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { SwipeableCategoryPager } from '@/mobile/app/shared/components/navigation/SwipeableCategoryPager';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import {
  ListGridTileSkeleton,
  SkeletonGroup,
} from '@/mobile/app/shared/components/ui/SkeletonPlaceholder';
import { VirtualizedDiscoveryGrid } from '@/mobile/app/shared/components/ui/VirtualizedDiscoveryGrid';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { getMarkerColorForMemberships } from '@/mobile/app/shared/utils/markerColors';

type ExploreListItem = {
  list: import('@/mobile/app/data/contracts/entities').PlaceList;
  owner: User | null;
};
type ExploreGridItem = ExploreListItem | PlaceFeedCardItem | User;

const EXPLORE_PAGER_TABS: Array<{ key: ExploreTabType; label: string }> = [
  { key: 'lists', label: tr.explore.tabs.lists },
  { key: 'places', label: tr.explore.tabs.places },
  { key: 'photos', label: tr.explore.tabs.photos },
  { key: 'people', label: tr.explore.tabs.people },
];

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
  useScrollToTop(activeListRef as React.RefObject<FlatList>);
  const listMarkerLists = useMemo(
    () => filteredListItems.map(({ list }) => list),
    [filteredListItems],
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

      setVisibleTab(nextTab);
      setActiveTab(nextTab);
    },
    [activeTab, scrollActiveListToTop],
  );

  const handleTabPreviewChange = useCallback((nextTab: ExploreTabType) => {
    setVisibleTab(nextTab);
  }, []);

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

  const dataByTab = {
    lists: filteredListItems,
    people: filteredUsers,
    photos: filteredPhotos,
    places: filteredPlaces,
  } satisfies Record<ExploreTabType, ExploreGridItem[]>;

  const renderEmptyState = (tab: ExploreTabType) => {
    if (errorMessage && !hasAnyBrowseData) {
      return (
        <View style={loadMoreStyles.errorWrap}>
          <EmptyState
            icon={<Compass color={colors.danger} size={32} />}
            title={tr.explore.errorTitle}
            description={errorMessage}
            actionLabel={tr.common.retry}
            onAction={retry}
            tone="danger"
          />
        </View>
      );
    }

    if (tab === 'lists') {
      return (
        <EmptyState
          icon={<Compass color={colors.textSoft} size={32} />}
          title={
            searchQuery.trim()
              ? tr.explore.empty.noResult
              : tr.explore.empty.noList
          }
          description={
            searchQuery.trim()
              ? tr.explore.empty.tryDifferentSearch
              : tr.explore.empty.noListDescription
          }
        />
      );
    }

    if (tab === 'places') {
      return (
        <EmptyState
          icon={<Compass color={colors.textSoft} size={32} />}
          title={
            searchQuery.trim()
              ? tr.explore.empty.noResult
              : tr.explore.empty.noPlace
          }
          description={
            searchQuery.trim()
              ? tr.explore.empty.tryDifferentSearch
              : tr.explore.empty.noPlaceDescription
          }
        />
      );
    }

    if (tab === 'photos') {
      return (
        <EmptyState
          icon={<Compass color={colors.textSoft} size={32} />}
          title={
            searchQuery.trim()
              ? tr.explore.empty.noResult
              : tr.explore.empty.noPhoto
          }
          description={
            searchQuery.trim()
              ? tr.explore.empty.tryDifferentSearch
              : tr.explore.empty.noPhotoDescription
          }
        />
      );
    }

    return (
      <EmptyState
        icon={<Compass color={colors.textSoft} size={32} />}
        title={
          searchQuery.trim()
            ? tr.explore.empty.noUserResult
            : tr.explore.empty.noUser
        }
        description={
          searchQuery.trim()
            ? tr.explore.empty.tryDifferentSearch
            : tr.explore.empty.noUserDescription
        }
      />
    );
  };

  const renderFooter = (tab: ExploreTabType) => {
    const tabQuery = queryStateByTab[tab];

    if (!tabQuery.hasNextPage || errorMessage) {
      return null;
    }

    return (
      <View
        style={loadMoreStyles.loadMoreStatus}
        accessibilityRole="progressbar"
      >
        {tabQuery.isFetchingNextPage ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : null}
        <Text style={loadMoreStyles.loadMoreLabel}>
          {tabQuery.isFetchingNextPage
            ? tr.common.loadingMore
            : tr.explore.loadMoreHint}
        </Text>
      </View>
    );
  };

  const handleEndReached = (tab: ExploreTabType) => {
    const tabQuery = queryStateByTab[tab];

    if (!tabQuery.hasNextPage || tabQuery.isFetchingNextPage || errorMessage) {
      return;
    }

    void tabQuery.fetchNextPage?.();
  };

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
        <SwipeableCategoryPager
          activeTab={activeTab}
          keepAlive={false}
          lazy
          tabs={EXPLORE_PAGER_TABS}
          onTabChange={handleTabChange}
          onTabPreviewChange={handleTabPreviewChange}
          renderPage={(tab) => (
            <VirtualizedDiscoveryGrid<ExploreGridItem>
              listRef={tab === activeTab ? activeListRef : undefined}
              listKey={`explore:${tab}`}
              data={errorMessage && !hasAnyBrowseData ? [] : dataByTab[tab]}
              extraData={{
                activeTab,
                following,
                pendingFollowRequests,
                searchQuery,
                tab,
              }}
              containsNativeMaps={tab !== 'people'}
              refreshing={refreshing}
              onRefresh={onRefresh}
              onEndReached={() => handleEndReached(tab)}
              ListEmptyComponent={renderEmptyState(tab)}
              ListFooterComponent={renderFooter(tab)}
              keyExtractor={(item, index) => {
                if (tab === 'lists') {
                  return (item as unknown as ExploreListItem).list.id;
                }

                if (tab === 'people') {
                  return (item as User).id;
                }

                return (
                  (item as unknown as PlaceFeedCardItem).key ||
                  `${tab}:${index}`
                );
              }}
              renderItem={({ item, index }) => {
                if (tab === 'lists') {
                  const listItem = item as unknown as ExploreListItem;

                  return (
                    <ListGridTile
                      list={listItem.list}
                      owner={listItem.owner}
                      fillWidth
                      showOwner={Boolean(listItem.owner)}
                      allListsForMarkerColor={listMarkerLists}
                      onOwnerPress={() =>
                        listItem.owner && openUserProfile(listItem.owner.id)
                      }
                      onPress={() =>
                        openStackScreen(navigation, 'ListDetail', {
                          listId: listItem.list.id,
                        })
                      }
                    />
                  );
                }

                if (tab === 'people') {
                  const targetUser = item as User;

                  return (
                    <UserGridTile
                      user={targetUser}
                      fillWidth
                      isFollowing={following.includes(targetUser.id)}
                      isPending={pendingFollowRequests.includes(targetUser.id)}
                      onPress={() => openUserProfile(targetUser.id)}
                      onFollowPress={() => handleFollowUser(targetUser.id)}
                    />
                  );
                }

                const placeItem = item as unknown as PlaceFeedCardItem;

                return (
                  <PlaceGridTile
                    place={placeItem.place}
                    fillWidth
                    owner={placeItem.owner}
                    showOwner={Boolean(placeItem.owner)}
                    mode={tab === 'photos' ? 'photo' : 'place'}
                    listCoverImage={placeItem.listCoverImage}
                    listEmoji={placeItem.listEmoji}
                    listIsPublic={placeItem.listIsPublic}
                    listName={placeItem.listName}
                    markerColor={getMarkerColorForMemberships(
                      placeItem.memberships,
                      placeItem.listIsPublic,
                    )}
                    onOwnerPress={() =>
                      placeItem.owner && openUserProfile(placeItem.owner.id)
                    }
                    onPress={() =>
                      setFeedMode({
                        kind: tab === 'photos' ? 'photos' : 'places',
                        startIndex: index,
                      })
                    }
                  />
                );
              }}
            />
          )}
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
  errorWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  content: {
    paddingBottom: 20,
  },
  loadMoreStatus: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  loadMoreLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  skeletonGrid: {
    gap: 14,
  },
});
