import React from 'react';
import { useScrollToTop } from '@react-navigation/native';
import { MapPin, Users } from 'lucide-react-native';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { openStackScreen, useAppNavigation } from '@/mobile/app/app-shell/navigation/navigation';
import {
  warmListDetailData,
  warmUserProfileData,
} from '@/mobile/app/app-shell/startup/startupDataWarmup';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import { useHomeFeedScreenState } from '@/mobile/app/features/home/application/useHomeFeedScreenState';
import { trackEvent } from '@/mobile/app/platform/analytics/analyticsEvents';
import { PlaceCard } from '@/mobile/app/features/places/public/components';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { prefetchAppImages } from '@/mobile/app/shared/components/ui/AppImage';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { PlaceCardSkeleton, SkeletonGroup } from '@/mobile/app/shared/components/ui/SkeletonPlaceholder';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  MEDIA_INITIAL_PREFETCH_CARD_COUNT,
  MEDIA_PREFETCH_AHEAD_CARD_COUNT,
  MEDIA_PREFETCH_VIEWABILITY_DELAY_MS,
} from '@/mobile/app/shared/performance/budgets';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';
import { buildAdaptiveFlatListProps } from '@/mobile/app/shared/utils/flatList';
import { getMarkerColorForMemberships } from '@/mobile/app/shared/utils/markerColors';
import { getAppLaunchElapsedMs } from '@/mobile/app/shared/performance/appLaunch';

function getFeedMediaPreviewUris(item: PlaceFeedCardItem) {
  const mediaUris = (item.place.media || [])
    .slice(0, 2)
    .map((media) => media.thumbnailUrl || media.url);

  return [...mediaUris, item.listCoverImage, item.owner?.profilePhoto];
}

export function HomeScreen() {
  const navigation = useAppNavigation();
  const { height, width } = useWindowDimensions();
  const { user } = useAuth();
  const userId = user?.id;
  const listRef = React.useRef<FlatList<PlaceFeedCardItem> | null>(null);
  const feedItemsRef = React.useRef<PlaceFeedCardItem[]>([]);
  const paginationRef = React.useRef({
    fetchNextPage: undefined as (() => Promise<unknown>) | undefined,
    hasNextPage: false,
    isFetchingNextPage: false,
    lastIndex: 0,
    lastSeenAt: Date.now(),
    requestInFlight: false,
  });
  const firstContentTrackedRef = React.useRef(false);
  const impressedFeedKeysRef = React.useRef(new Set<string>());
  const {
    errorMessage,
    fetchNextPage,
    feedItems,
    followingCount,
    hasNextPage,
    isInitialLoading,
    isFetchingNextPage,
    isShowingStartupCache,
    refreshing,
    retry,
    onRefresh,
  } = useHomeFeedScreenState({ user });
  feedItemsRef.current = feedItems;
  paginationRef.current.fetchNextPage = fetchNextPage;
  paginationRef.current.hasNextPage = hasNextPage;
  paginationRef.current.isFetchingNextPage = isFetchingNextPage;

  React.useEffect(() => {
    if (isInitialLoading || firstContentTrackedRef.current) {
      return;
    }

    firstContentTrackedRef.current = true;
    const durationMs = getAppLaunchElapsedMs();
    trackEvent({
      name: 'screen_first_content',
      params: {
        cached: isShowingStartupCache,
        durationMs,
        screen: 'home',
      },
    });
    trackEvent({
      name: 'feed_page_loaded',
      params: {
        cached: isShowingStartupCache,
        count: feedItems.length,
        durationMs,
      },
    });

    const trackInteractive = () => {
      trackEvent({
        name: 'screen_interactive',
        params: { durationMs: getAppLaunchElapsedMs(), screen: 'home' },
      });
    };

    if (typeof requestAnimationFrame !== 'function') {
      trackInteractive();
      return;
    }

    const frameId = requestAnimationFrame(trackInteractive);

    return () => cancelAnimationFrame(frameId);
  }, [feedItems.length, isInitialLoading, isShowingStartupCache]);

  React.useEffect(() => {
    const initialMediaUris = feedItems
      .slice(0, MEDIA_INITIAL_PREFETCH_CARD_COUNT)
      .flatMap(getFeedMediaPreviewUris);

    void prefetchAppImages(initialMediaUris, { priority: 'high' });
  }, [feedItems]);

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
      minimumViewTime: MEDIA_PREFETCH_VIEWABILITY_DELAY_MS,
    }),
    [],
  );
  const onViewableItemsChanged = React.useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      viewableItems.forEach(({ index }) => {
        if (typeof index !== 'number') {
          return;
        }

        const item = feedItemsRef.current[index];

        if (!item || impressedFeedKeysRef.current.has(item.key)) {
          return;
        }

        impressedFeedKeysRef.current.add(item.key);
        trackEvent({
          name: 'feed_item_impression',
          params: {
            feedItemId: item.key,
            listId: item.listId,
            placeId: item.place.id,
          },
        });
      });

      const visibleIndex = viewableItems
        .map((entry) => entry.index)
        .filter((index): index is number => typeof index === 'number')
        .sort((left, right) => left - right)[0];

      if (visibleIndex == null) {
        return;
      }

      const pagination = paginationRef.current;
      const now = Date.now();
      const elapsedSeconds = Math.max(0.25, (now - pagination.lastSeenAt) / 1000);
      const itemsPerSecond = Math.max(0, visibleIndex - pagination.lastIndex) / elapsedSeconds;
      const dynamicAheadCount = MEDIA_PREFETCH_AHEAD_CARD_COUNT +
        Math.min(8, Math.ceil(itemsPerSecond * 2));
      const remainingItems = feedItemsRef.current.length - visibleIndex - 1;
      pagination.lastIndex = visibleIndex;
      pagination.lastSeenAt = now;

      if (
        remainingItems <= dynamicAheadCount &&
        pagination.hasNextPage &&
        !pagination.isFetchingNextPage &&
        !pagination.requestInFlight &&
        pagination.fetchNextPage
      ) {
        pagination.requestInFlight = true;
        void pagination.fetchNextPage().finally(() => {
          pagination.requestInFlight = false;
        });
      }

      const nextUris = feedItemsRef.current
        .slice(visibleIndex, visibleIndex + MEDIA_PREFETCH_AHEAD_CARD_COUNT + 1)
        .flatMap(getFeedMediaPreviewUris);

      void prefetchAppImages(nextUris, { priority: 'high' });
    },
  );

  const renderFeedItem = React.useCallback(
    ({ item }: { item: PlaceFeedCardItem }) => (
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
          onPressIn={() => {
            if (userId) {
              void warmListDetailData({
                listId: item.listId,
                queryClient,
                viewerId: userId,
              });
            }
          }}
          onPress={() =>
            {
              openStackScreen(navigation, 'ListDetail', {
              listId: item.listId,
              placeId: item.place.id,
              });
            }
          }
          onOwnerPress={() => {
            if (!item.owner || !userId) {
              return;
            }

            if (item.owner.id === userId) {
              navigation.navigate('MainTabs', { screen: 'Profile' });
              return;
            }

            void warmUserProfileData({
              queryClient,
              targetUserId: item.owner.id,
              viewerId: userId,
            });
            openStackScreen(navigation, 'UserProfile', { userId: item.owner.id });
          }}
        />
      </View>
    ),
    [navigation, userId],
  );

  const handleEndReached = React.useCallback(() => {
    if (!hasNextPage || isFetchingNextPage || !fetchNextPage) {
      return;
    }

    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

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
          <InstantPressable style={styles.primaryCta} onPress={() => navigation.navigate('Explore')}>
            <MapPin color={colors.onPrimary} size={16} />
            <Text style={styles.primaryCtaText}>{tr.home.exploreCta}</Text>
          </InstantPressable>
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
        renderItem={renderFeedItem}
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
        onEndReached={handleEndReached}
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
