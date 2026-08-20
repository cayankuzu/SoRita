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
import { useAppNavigation } from '@/mobile/app/app-shell/navigation/navigation';
import { useHomeFeedScreenState } from '@/mobile/app/features/home/application/useHomeFeedScreenState';
import { createFeedVisibilityStore } from '@/mobile/app/features/home/application/feedVisibilityStore';
import { HomeFeedCardRow } from '@/mobile/app/features/home/ui/components/HomeFeedCardRow';
import { trackEvent } from '@/mobile/app/platform/analytics/analyticsEvents';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { prefetchAppImages } from '@/mobile/app/shared/components/ui/AppImage';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { PlaceCardSkeleton, SkeletonGroup } from '@/mobile/app/shared/components/ui/SkeletonPlaceholder';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  HOME_FEED_INITIAL_RENDER_COUNT,
  HOME_FEED_RENDER_BATCH_SIZE,
  HOME_FEED_WINDOW_SIZE,
  MEDIA_PREFETCH_AHEAD_CARD_COUNT,
  MEDIA_PREFETCH_VIEWABILITY_DELAY_MS,
} from '@/mobile/app/shared/performance/budgets';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';
import { buildAdaptiveFlatListProps } from '@/mobile/app/shared/utils/flatList';
import { getAppLaunchElapsedMs } from '@/mobile/app/shared/performance/appLaunch';

function getFeedMediaPreviewUris(item: PlaceFeedCardItem) {
  const mediaUris = (item.place.media || [])
    .slice(0, 2)
    .map((media) => media.thumbnailUrl || media.url);

  return [...mediaUris, item.listCoverImage, item.owner?.profilePhoto];
}

type PaginationState = {
  fetchNextPage?: () => Promise<unknown>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  lastIndex: number;
  lastSeenAt: number;
  requestInFlight: boolean;
};

function requestNextPage(pagination: PaginationState) {
  if (
    !pagination.hasNextPage ||
    pagination.isFetchingNextPage ||
    pagination.requestInFlight ||
    !pagination.fetchNextPage
  ) {
    return;
  }

  pagination.requestInFlight = true;
  void pagination.fetchNextPage().finally(() => {
    pagination.requestInFlight = false;
  });
}

export function HomeScreen() {
  const navigation = useAppNavigation();
  const { height, width } = useWindowDimensions();
  const { user } = useAuth();
  const userId = user?.id;
  const listRef = React.useRef<FlatList<PlaceFeedCardItem> | null>(null);
  const feedItemsRef = React.useRef<PlaceFeedCardItem[]>([]);
  const visibilityStoreRef = React.useRef(createFeedVisibilityStore());
  const paginationRef = React.useRef<PaginationState>({
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

      const nextVisibleKeys = new Set(
        viewableItems.flatMap(({ index }) => {
          const item = typeof index === 'number' ? feedItemsRef.current[index] : undefined;
          return item ? [item.key] : [];
        }),
      );
      visibilityStoreRef.current.replace(nextVisibleKeys);

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

      if (remainingItems <= dynamicAheadCount) {
        requestNextPage(pagination);
      }

      const nextUris = feedItemsRef.current
        .slice(visibleIndex + 1, visibleIndex + MEDIA_PREFETCH_AHEAD_CARD_COUNT + 1)
        .flatMap(getFeedMediaPreviewUris);

      void prefetchAppImages(nextUris, { priority: 'normal' });
    },
  );

  const renderFeedItem = React.useCallback(
    ({ item }: { item: PlaceFeedCardItem }) =>
      userId ? (
        <HomeFeedCardRow
          item={item}
          userId={userId}
          visibilityStore={visibilityStoreRef.current}
        />
      ) : null,
    [userId],
  );

  const handleEndReached = React.useCallback(() => {
    requestNextPage(paginationRef.current);
  }, []);

  if (!user) {
    return null;
  }

  if (isInitialLoading) {
    return (
      <Screen safeTop={false} scroll={false} variant="feed">
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
      <Screen safeTop={false} variant="feed">
        <EmptyState
          icon={<MapPin color={colors.danger} size={32} />}
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
            icon={<Users color={colors.primary} size={32} />}
            title={tr.home.noFollowingTitle}
            description={tr.home.noFollowingDescription}
          />
          <InstantPressable style={styles.primaryCta} onPress={() => navigation.navigate('Explore')}>
            <MapPin color={colors.onPrimary} size={14} />
            <Text style={styles.primaryCtaText}>{tr.home.exploreCta}</Text>
          </InstantPressable>
        </View>
      );
    }

    if (followingCount > 0 && feedItems.length === 0) {
      return (
        <View style={styles.emptyStateWrap}>
          <EmptyState
            icon={<MapPin color={colors.textSoft} size={32} />}
            title={tr.home.noFeedTitle}
            description={tr.home.noFeedDescription}
          />
        </View>
      );
    }

    return null;
  };

  return (
    <Screen safeTop={false} scroll={false} variant="feed">
      <FlatList
        {...listProps}
        initialNumToRender={Math.min(
          Math.max(feedItems.length, 1),
          HOME_FEED_INITIAL_RENDER_COUNT,
        )}
        maxToRenderPerBatch={HOME_FEED_RENDER_BATCH_SIZE}
        windowSize={HOME_FEED_WINDOW_SIZE}
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
    paddingTop: 10,
    gap: 18,
  },
  centeredState: {
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 28,
  },
  primaryCta: {
    alignSelf: 'center',
    minHeight: 44,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  emptyStateWrap: {
    paddingTop: 28,
    paddingHorizontal: 12,
  },
  feedListContent: {
    paddingTop: 4,
  },
  feedListContentEmpty: {
    flexGrow: 1,
  },
  listFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
});
