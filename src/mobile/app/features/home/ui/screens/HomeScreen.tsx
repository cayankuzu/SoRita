import React from 'react';
import { useScrollToTop } from '@react-navigation/native';
import { MapPin, Users } from 'lucide-react-native';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { openStackScreen, useAppNavigation } from '@/mobile/app/app-shell/navigation/navigation';
import { useHomeFeedScreenState } from '@/mobile/app/features/home/application/useHomeFeedScreenState';
import { PlaceCard } from '@/mobile/app/features/places/public/components';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { prefetchAppImages } from '@/mobile/app/shared/components/ui/AppImage';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { PlaceCardSkeleton, SkeletonGroup } from '@/mobile/app/shared/components/ui/SkeletonPlaceholder';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';
import { buildAdaptiveFlatListProps } from '@/mobile/app/shared/utils/flatList';
import { getMarkerColorForMemberships } from '@/mobile/app/shared/utils/markerColors';

export function HomeScreen() {
  const navigation = useAppNavigation();
  const { height, width } = useWindowDimensions();
  const { user } = useAuth();
  const listRef = React.useRef<FlatList<PlaceFeedCardItem> | null>(null);
  const feedItemsRef = React.useRef<PlaceFeedCardItem[]>([]);
  const {
    errorMessage,
    fetchNextPage,
    feedItems,
    followingCount,
    hasNextPage,
    isInitialLoading,
    isFetchingNextPage,
    refreshing,
    retry,
    onRefresh,
  } = useHomeFeedScreenState({ user });
  feedItemsRef.current = feedItems;

  useScrollToTop(listRef as React.RefObject<FlatList>);

  const listProps = React.useMemo(
    () =>
      buildAdaptiveFlatListProps({
        containsNativeMaps: false,
        itemCount: feedItems.length,
        viewportHeight: height,
        viewportWidth: width,
      }),
    [feedItems.length, height, width],
  );
  const viewabilityConfig = React.useMemo(
    () => ({
      itemVisiblePercentThreshold: 50,
      minimumViewTime: 200,
    }),
    [],
  );
  const onViewableItemsChanged = React.useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const visibleIndex = viewableItems
        .map((entry) => entry.index)
        .filter((index): index is number => typeof index === 'number')
        .sort((left, right) => left - right)[0];

      if (visibleIndex == null) {
        return;
      }

      const nextUris = feedItemsRef.current
        .slice(visibleIndex + 1, visibleIndex + 3)
        .map((item) => {
          const media = item.place.media?.[0];
          return media?.thumbnailUrl || media?.url || item.listCoverImage;
        });

      void prefetchAppImages(nextUris);
    },
  );

  if (!user) {
    return null;
  }

  if (isInitialLoading) {
    return (
      <Screen safeTop={false} padded={false} scroll={false}>
        <SkeletonGroup style={styles.skeletonWrap}>
          <PlaceCardSkeleton />
          <PlaceCardSkeleton />
          <PlaceCardSkeleton />
        </SkeletonGroup>
      </Screen>
    );
  }

  if (errorMessage && feedItems.length === 0) {
    return (
      <Screen safeTop={false}>
        <EmptyState
          icon={<MapPin color={colors.danger} size={38} />}
          title={tr.home.errorTitle}
          description={errorMessage}
          actionLabel={tr.common.retry}
          onAction={retry}
          tone="danger"
        />
      </Screen>
    );
  }

  const renderEmptyState = () => {
    if (followingCount === 0 && feedItems.length === 0) {
      return (
        <View style={styles.centeredState}>
          <EmptyState
            icon={<Users color={colors.primary} size={38} />}
            title={tr.home.noFollowingTitle}
            description={tr.home.noFollowingDescription}
          />
          <Pressable style={styles.primaryCta} onPress={() => navigation.navigate('Explore')}>
            <MapPin color={colors.onPrimary} size={16} />
            <Text style={styles.primaryCtaText}>{tr.home.exploreCta}</Text>
          </Pressable>
        </View>
      );
    }

    if (followingCount > 0 && feedItems.length === 0) {
      return (
        <View style={styles.emptyStateWrap}>
          <EmptyState
            icon={<MapPin color={colors.textSoft} size={38} />}
            title={tr.home.noFeedTitle}
            description={tr.home.noFeedDescription}
          />
        </View>
      );
    }

    return null;
  };

  return (
    <Screen safeTop={false} padded={false} scroll={false}>
      <FlatList
        {...listProps}
        ref={listRef}
        data={feedItems}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <View style={styles.cardRow}>
            <PlaceCard
              place={item.place}
              owner={item.owner}
              ownerId={item.ownerId}
              listId={item.listId}
              listName={item.listName}
              listEmoji={item.listEmoji}
              listIsPublic={item.listIsPublic}
              listCoverImage={item.listCoverImage}
              locationPlaceCardsCount={item.memberships.length}
              locationOriginalPlaceName={item.place.name}
              markerColor={getMarkerColorForMemberships(item.memberships, item.listIsPublic)}
              onPress={() =>
                openStackScreen(navigation, 'ListDetail', {
                  listId: item.listId,
                  placeId: item.place.id,
                })
              }
              onOwnerPress={() => {
                if (!item.owner) {
                  return;
                }

                if (item.owner.id === user.id) {
                  navigation.navigate('MainTabs', { screen: 'Profile' });
                  return;
                }

                openStackScreen(navigation, 'UserProfile', { userId: item.owner.id });
              }}
            />
          </View>
        )}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={[
          styles.feedListContent,
          feedItems.length === 0 ? styles.feedListContentEmpty : null,
        ]}
        showsVerticalScrollIndicator={false}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged.current}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReached={() => {
          if (!hasNextPage || isFetchingNextPage || !fetchNextPage) {
            return;
          }

          void fetchNextPage();
        }}
        onEndReachedThreshold={0.35}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.listFooter}>
              <ActivityIndicator color={colors.primary} size="small" />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeletonWrap: {
    flex: 1,
    paddingTop: 12,
    gap: 24,
  },
  centeredState: {
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 36,
  },
  primaryCta: {
    alignSelf: 'center',
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  emptyStateWrap: {
    paddingTop: 36,
    paddingHorizontal: 16,
  },
  feedListContent: {
    paddingTop: 4,
  },
  feedListContentEmpty: {
    flexGrow: 1,
  },
  cardRow: {
    marginBottom: 16,
  },
  listFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
});
