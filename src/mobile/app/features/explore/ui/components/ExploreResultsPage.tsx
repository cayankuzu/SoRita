import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { FlatList } from 'react-native';
import { Compass } from 'lucide-react-native';

import type {
  PlaceList,
  User,
} from '@/mobile/app/data/contracts/entities';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';
import {
  ListGridTile,
  PlaceGridTile,
  UserGridTile,
} from '@/mobile/app/features/discovery/public/components';
import type { ExploreTabType } from '@/mobile/app/features/explore/ui/components/exploreScreenTypes';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { VirtualizedDiscoveryGrid } from '@/mobile/app/shared/components/ui/VirtualizedDiscoveryGrid';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
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
  listMarkerLists: PlaceList[];
  listRef: React.Ref<FlatList<ExploreGridItem>>;
  onContentReady: () => void;
  onClearSearch: () => void;
  onEndReached: () => void;
  onFollowUser: (userId: string) => void;
  onListPress: (listId: string) => void;
  onOwnerPress: (userId: string) => void;
  onPlacePress: (tab: Extract<ExploreTabType, 'photos' | 'places'>, index: number) => void;
  onRefresh: () => void;
  onRetry: () => void;
  onScrollOffsetChange: (offset: number) => void;
  pendingFollowRequests: string[];
  refreshing: boolean;
  searchQuery: string;
  tab: ExploreTabType;
};

function ExplorePageEmptyState({
  errorMessage,
  onClearSearch,
  onRetry,
  searchQuery,
  tab,
}: Pick<ExploreResultsPageProps, 'errorMessage' | 'onClearSearch' | 'onRetry' | 'searchQuery' | 'tab'>) {
  if (errorMessage) {
    return (
      <View style={styles.errorWrap}>
        <EmptyState
          icon={<Compass color={colors.danger} size={28} />}
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
        icon={<Compass color={colors.textSoft} size={28} />}
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
        icon={<Compass color={colors.textSoft} size={28} />}
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
        icon={<Compass color={colors.textSoft} size={28} />}
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
      icon={<Compass color={colors.textSoft} size={28} />}
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

export const ExploreResultsPage = React.memo(function ExploreResultsPage({
  active,
  data,
  errorMessage,
  following,
  hasNextPage,
  isFetchingNextPage,
  listMarkerLists,
  listRef,
  onContentReady,
  onClearSearch,
  onEndReached,
  onFollowUser,
  onListPress,
  onOwnerPress,
  onPlacePress,
  onRefresh,
  onRetry,
  onScrollOffsetChange,
  pendingFollowRequests,
  refreshing,
  searchQuery,
  tab,
}: ExploreResultsPageProps) {
  const listState = React.useMemo(
    () => ({ following, pendingFollowRequests }),
    [following, pendingFollowRequests],
  );
  const footer =
    active && hasNextPage ? (
      <View style={styles.loadMoreStatus} accessibilityRole="progressbar">
        {isFetchingNextPage ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : null}
        <Text style={styles.loadMoreLabel}>
          {isFetchingNextPage ? tr.common.loadingMore : tr.explore.loadMoreHint}
        </Text>
      </View>
    ) : null;

  return (
    <VirtualizedDiscoveryGrid<ExploreGridItem>
      listRef={listRef}
      listKey={`explore:${tab}`}
      data={errorMessage ? [] : data}
      extraData={listState}
      containsNativeMaps={tab !== 'people'}
      refreshing={active && refreshing}
      onRefresh={active ? onRefresh : undefined}
      onEndReached={active ? onEndReached : undefined}
      onContentSizeChange={onContentReady}
      onScrollOffsetChange={onScrollOffsetChange}
      ListEmptyComponent={
        <ExplorePageEmptyState
          errorMessage={errorMessage}
          onClearSearch={onClearSearch}
          onRetry={onRetry}
          searchQuery={searchQuery}
          tab={tab}
        />
      }
      ListFooterComponent={footer}
      keyExtractor={(item, index) => {
        if (tab === 'lists') {
          return (item as ExploreListItem).list.id;
        }

        if (tab === 'people') {
          return (item as User).id;
        }

        return (item as PlaceFeedCardItem).key || `${tab}:${index}`;
      }}
      renderItem={({ item, index }) => {
        if (tab === 'lists') {
          const listItem = item as ExploreListItem;

          return (
            <ListGridTile
              list={listItem.list}
              owner={listItem.owner}
              fillWidth
              showOwner={Boolean(listItem.owner)}
              allListsForMarkerColor={listMarkerLists}
              onOwnerPress={() => listItem.owner && onOwnerPress(listItem.owner.id)}
              onPress={() => onListPress(listItem.list.id)}
              searchQuery={searchQuery}
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
              onPress={() => onOwnerPress(targetUser.id)}
              onFollowPress={() => onFollowUser(targetUser.id)}
              searchQuery={searchQuery}
            />
          );
        }

        const placeItem = item as PlaceFeedCardItem;

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
            onOwnerPress={() => placeItem.owner && onOwnerPress(placeItem.owner.id)}
            onPress={() => onPlacePress(tab, index)}
            searchQuery={searchQuery}
          />
        );
      }}
    />
  );
});

const styles = StyleSheet.create({
  errorWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  loadMoreLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  loadMoreStatus: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
});
