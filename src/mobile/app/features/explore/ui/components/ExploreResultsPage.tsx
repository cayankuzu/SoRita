import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { FlatList } from 'react-native';
import { Compass, Search } from 'lucide-react-native';

import type {
  PlaceList,
  User,
} from '@/mobile/app/data/contracts/entities';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';
import {
  ListMosaicTile,
  PlaceMosaicTile,
  UserGridTile,
} from '@/mobile/app/features/discovery/public/components';
import type { ExploreTabType } from '@/mobile/app/features/explore/ui/components/exploreScreenTypes';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { MosaicGridSkeleton } from '@/mobile/app/shared/components/ui/SkeletonPlaceholder';
import { VirtualizedDiscoveryGrid } from '@/mobile/app/shared/components/ui/VirtualizedDiscoveryGrid';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, fontWeight, iconSize, spacing, textStyle } from '@/mobile/app/shared/theme/tokens';
import { getMarkerColorForMemberships } from '@/mobile/app/shared/utils/markerColors';

export type ExploreListItem = {
  list: PlaceList;
  owner: User | null;
};

export type ExploreGridItem = ExploreListItem | PlaceFeedCardItem | User;

type ExploreResultsPageProps = {
  active: boolean;
  data: ExploreGridItem[];
  errorMessage: string | null;
  following: string[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  // The first page for the current query has not arrived.
  isLoading: boolean;
  listRef: React.Ref<FlatList<ExploreGridItem>>;
  onContentReady: () => void;
  onClearSearch: () => void;
  onEndReached: () => void;
  onFollowUser: (userId: string) => Promise<void>;
  onListIntent: (listId: string) => void;
  onListPress: (listId: string) => void;
  onOwnerIntent: (userId: string) => void;
  onOwnerPress: (userId: string) => void;
  onPlacePress: (tab: Extract<ExploreTabType, 'photos' | 'places'>, index: number) => void;
  onRefresh: () => void;
  onRetry: () => void;
  onScrollOffsetChange: (offset: number) => void;
  pendingFollowRequests: string[];
  refreshing: boolean;
  searchQuery: string;
  // One or two letters: too few to search yet.
  searchTooShort: boolean;
  tab: ExploreTabType;
  // Room kept at the top for the header that floats over the results.
  topInset: number;
};

function ExplorePageEmptyState({
  errorMessage,
  isLoading,
  onClearSearch,
  onRetry,
  searchQuery,
  searchTooShort,
  tab,
}: Pick<
  ExploreResultsPageProps,
  'errorMessage' | 'isLoading' | 'onClearSearch' | 'onRetry' | 'searchQuery' | 'searchTooShort' | 'tab'
>) {
  if (searchTooShort) {
    return (
      <EmptyState
        icon={<Search color={colors.textSoft} size={iconSize.xl} />}
        title={tr.explore.empty.keepTyping}
        description={tr.explore.empty.keepTypingDescription}
      />
    );
  }

  // Still loading the query's first page: not yet "nothing found".
  if (isLoading && !errorMessage) {
    return <MosaicGridSkeleton rows={3} />;
  }

  if (errorMessage) {
    return (
      <View style={styles.errorWrap}>
        <EmptyState
          icon={<Compass color={colors.danger} size={iconSize.xl} />}
          title={tr.explore.errorTitle}
          description={errorMessage}
          actionLabel={tr.common.retry}
          onAction={onRetry}
          tone="danger"
        />
      </View>
    );
  }

  if (tab === 'lists') {
    return (
      <EmptyState
        icon={<Compass color={colors.textSoft} size={iconSize.xl} />}
        title={searchQuery.trim() ? tr.explore.empty.noResult : tr.explore.empty.noList}
        description={
          searchQuery.trim()
            ? tr.explore.empty.tryDifferentSearch
            : tr.explore.empty.noListDescription
        }
        actionLabel={searchQuery.trim() ? tr.common.clear : undefined}
        onAction={searchQuery.trim() ? onClearSearch : undefined}
      />
    );
  }

  if (tab === 'places') {
    return (
      <EmptyState
        icon={<Compass color={colors.textSoft} size={iconSize.xl} />}
        title={searchQuery.trim() ? tr.explore.empty.noResult : tr.explore.empty.noPlace}
        description={
          searchQuery.trim()
            ? tr.explore.empty.tryDifferentSearch
            : tr.explore.empty.noPlaceDescription
        }
        actionLabel={searchQuery.trim() ? tr.common.clear : undefined}
        onAction={searchQuery.trim() ? onClearSearch : undefined}
      />
    );
  }

  if (tab === 'photos') {
    return (
      <EmptyState
        icon={<Compass color={colors.textSoft} size={iconSize.xl} />}
        title={searchQuery.trim() ? tr.explore.empty.noResult : tr.explore.empty.noPhoto}
        description={
          searchQuery.trim()
            ? tr.explore.empty.tryDifferentSearch
            : tr.explore.empty.noPhotoDescription
        }
        actionLabel={searchQuery.trim() ? tr.common.clear : undefined}
        onAction={searchQuery.trim() ? onClearSearch : undefined}
      />
    );
  }

  return (
    <EmptyState
      icon={<Compass color={colors.textSoft} size={iconSize.xl} />}
      title={searchQuery.trim() ? tr.explore.empty.noUserResult : tr.explore.empty.noUser}
      description={
        searchQuery.trim()
          ? tr.explore.empty.tryDifferentSearch
          : tr.explore.empty.noUserDescription
      }
      actionLabel={searchQuery.trim() ? tr.common.clear : undefined}
      onAction={searchQuery.trim() ? onClearSearch : undefined}
    />
  );
}

type ExploreResultCellProps = Pick<
  ExploreResultsPageProps,
  | 'onFollowUser'
  | 'onListIntent'
  | 'onListPress'
  | 'onOwnerIntent'
  | 'onOwnerPress'
  | 'onPlacePress'
  | 'searchQuery'
  | 'tab'
> & {
  following: Set<string>;
  index: number;
  item: ExploreGridItem;
  pendingFollowRequests: Set<string>;
};

const ExploreResultCell = React.memo(function ExploreResultCell({
  following,
  index,
  item,
  onFollowUser,
  onListIntent,
  onListPress,
  onOwnerIntent,
  onOwnerPress,
  onPlacePress,
  pendingFollowRequests,
  searchQuery,
  tab,
}: ExploreResultCellProps) {
  if (tab === 'lists') {
    const listItem = item as ExploreListItem;

    return (
      <ListMosaicTile
        list={listItem.list}
        onPress={() => onListPress(listItem.list.id)}
        onPressIn={() => onListIntent(listItem.list.id)}
      />
    );
  }

  if (tab === 'people') {
    const targetUser = item as User;

    return (
      <UserGridTile
        user={targetUser}
        isFollowing={following.has(targetUser.id)}
        isPending={pendingFollowRequests.has(targetUser.id)}
        onPress={() => onOwnerPress(targetUser.id)}
        onPressIn={() => onOwnerIntent(targetUser.id)}
        onFollowPress={() => onFollowUser(targetUser.id)}
        searchQuery={searchQuery}
      />
    );
  }

  const placeItem = item as PlaceFeedCardItem;

  return (
    <PlaceMosaicTile
      place={placeItem.place}
      markerColor={getMarkerColorForMemberships(
        placeItem.memberships,
        placeItem.listIsPublic,
      )}
      onPress={() => onPlacePress(tab, index)}
    />
  );
});

export const ExploreResultsPage = React.memo(function ExploreResultsPage({
  active,
  data,
  errorMessage,
  following,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  listRef,
  onContentReady,
  onClearSearch,
  onEndReached,
  onFollowUser,
  onListIntent,
  onListPress,
  onOwnerIntent,
  onOwnerPress,
  onPlacePress,
  onRefresh,
  onRetry,
  onScrollOffsetChange,
  pendingFollowRequests,
  refreshing,
  searchQuery,
  searchTooShort,
  tab,
  topInset,
}: ExploreResultsPageProps) {
  const topSpacer = React.useMemo(
    () => <View pointerEvents="none" style={{ height: topInset }} />,
    [topInset],
  );
  const followingSet = React.useMemo(() => new Set(following), [following]);
  const pendingFollowRequestSet = React.useMemo(
    () => new Set(pendingFollowRequests),
    [pendingFollowRequests],
  );
  const listState = React.useMemo(
    () => ({ followingSet, pendingFollowRequestSet }),
    [followingSet, pendingFollowRequestSet],
  );
  const footer =
    active && hasNextPage && isFetchingNextPage ? (
      <View
        accessibilityLabel={tr.common.loadingMore}
        accessibilityLiveRegion="polite"
        accessibilityRole="progressbar"
        accessibilityState={{ busy: true }}
        style={styles.loadMoreStatus}
      >
        <ActivityIndicator color={colors.primary} size="small" />
        <AppText style={styles.loadMoreLabel}>{tr.common.loadingMore}</AppText>
      </View>
    ) : null;
  const keyExtractor = React.useCallback(
    (item: ExploreGridItem, index: number) => {
      if (tab === 'lists') {
        return (item as ExploreListItem).list.id;
      }

      if (tab === 'people') {
        return (item as User).id;
      }

      return (item as PlaceFeedCardItem).key || `${tab}:${index}`;
    },
    [tab],
  );
  const renderResult = React.useCallback(
    ({ item, index }: { item: ExploreGridItem; index: number }) => (
      <ExploreResultCell
        following={followingSet}
        index={index}
        item={item}
        onFollowUser={onFollowUser}
        onListIntent={onListIntent}
        onListPress={onListPress}
        onOwnerIntent={onOwnerIntent}
        onOwnerPress={onOwnerPress}
        onPlacePress={onPlacePress}
        pendingFollowRequests={pendingFollowRequestSet}
        searchQuery={searchQuery}
        tab={tab}
      />
    ),
    [
      followingSet,
      onFollowUser,
      onListIntent,
      onListPress,
      onOwnerIntent,
      onOwnerPress,
      onPlacePress,
      pendingFollowRequestSet,
      searchQuery,
      tab,
    ],
  );

  return (
    <VirtualizedDiscoveryGrid<ExploreGridItem>
      listRef={listRef}
      listKey={`explore:${tab}`}
      // Every tab, people too, is the same three-column Instagram-style grid.
      columnStrategy="mosaic"
      data={errorMessage ? [] : data}
      extraData={listState}
      refreshing={active && refreshing}
      progressViewOffset={topInset}
      ListHeaderComponent={topSpacer}
      scrollEnabled={active}
      // Set on every page: toggling it with the active tab rebuilt the list on
      // Android, blanking the page for a frame on every swipe.
      onRefresh={onRefresh}
      onEndReached={active ? onEndReached : undefined}
      onContentSizeChange={onContentReady}
      onScrollOffsetChange={onScrollOffsetChange}
      ListEmptyComponent={
        <ExplorePageEmptyState
          errorMessage={errorMessage}
          isLoading={isLoading}
          onClearSearch={onClearSearch}
          onRetry={onRetry}
          searchQuery={searchQuery}
          searchTooShort={searchTooShort}
          tab={tab}
        />
      }
      ListFooterComponent={footer}
      keyExtractor={keyExtractor}
      renderItem={renderResult}
    />
  );
});

const styles = StyleSheet.create({
  errorWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  loadMoreLabel: textStyle('metadataText', colors.primary, fontWeight.strong),
  loadMoreStatus: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
});
