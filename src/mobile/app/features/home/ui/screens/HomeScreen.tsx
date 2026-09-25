import React from 'react';
import { useScrollToTop } from '@react-navigation/native';
import { MapPin, Users } from 'lucide-react-native';
import {
  ActivityIndicator,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { AppHeader } from '@/mobile/app/app-shell/chrome/AppHeader';
import { useAppNavigation } from '@/mobile/app/app-shell/navigation/navigation';
import { useHomeFeedScreenState } from '@/mobile/app/features/home/application/useHomeFeedScreenState';
import { createFeedVisibilityStore } from '@/mobile/app/features/home/application/feedVisibilityStore';
import { HomeFeedCardRow } from '@/mobile/app/features/home/ui/components/HomeFeedCardRow';
import { trackEvent } from '@/mobile/app/platform/analytics/analyticsEvents';
import { ScrollAwayHeader } from '@/mobile/app/shared/components/navigation/ScrollAwayHeader';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
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
import {
  colors,
  controlSize,
  fontWeight,
  hitSlopFor,
  iconSize,
  radius,
  spacing,
  textStyle,
  zIndex,
} from '@/mobile/app/shared/theme/tokens';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';
import { buildAdaptiveFlatListProps } from '@/mobile/app/shared/utils/flatList';
import { useScrollAwayHeader } from '@/mobile/app/shared/hooks/useScrollAwayHeader';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { useTopInset } from '@/mobile/app/shared/hooks/useTopInset';
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
  // The bars run edge to edge and pad themselves; only the cards are inset.
  const { screenPadding } = useAppLayout();
  const topInset = useTopInset();
  const insetStyle = React.useMemo(() => ({ paddingHorizontal: screenPadding }), [screenPadding]);
  // The brand bar slides away while reading down the feed and returns on the
  // first scroll up. An opaque strip keeps the status bar clear of the feed.
  const topBar = useScrollAwayHeader();
  const trackTopBarScroll = topBar.onScrollOffset;
  const handleFeedScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      trackTopBarScroll(event.nativeEvent.contentOffset.y);
    },
    [trackTopBarScroll],
  );
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
    hasPartialDataError,
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
    visibilityStoreRef.current.seedInitial(
      new Set(feedItems.slice(0, HOME_FEED_INITIAL_RENDER_COUNT).map((item) => item.key)),
    );
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

      const nextVisibleKeys = new Set(
        viewableItems.flatMap(({ index }) => {
          const item = typeof index === 'number' ? feedItemsRef.current[index] : undefined;
          return item ? [item.key] : [];
        }),
      );
      visibilityStoreRef.current.markSeen(nextVisibleKeys);

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

  if (!user || isInitialLoading) {
    return <HomeLoadingState insetStyle={insetStyle} />;
  }

  if (errorMessage && feedItems.length === 0) {
    return <HomeErrorState errorMessage={errorMessage} insetStyle={insetStyle} onRetry={retry} />;
  }

  return (
    <Screen padded={false} safeTop={false} scroll={false} variant="feed">
      <FlatList
        accessibilityState={{ busy: refreshing || isFetchingNextPage }}
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
        ListHeaderComponent={
          <>
            <View pointerEvents="none" style={{ height: topBar.height }} />
            {hasPartialDataError && feedItems.length > 0 ? (
              <View style={styles.partialDataNotice}>
                <InlineNotice
                  tone="warning"
                  title={tr.home.partialDataTitle}
                  description={tr.home.partialDataDescription}
                  actionLabel={tr.home.partialDataRetry}
                  onAction={retry}
                />
              </View>
            ) : null}
          </>
        }
        onScroll={handleFeedScroll}
        scrollEventThrottle={16}
        progressViewOffset={topBar.height}
        ListEmptyComponent={
          <HomeFeedEmptyState
            followingCount={followingCount}
            onExplore={() => navigation.navigate('Explore')}
          />
        }
        contentContainerStyle={[
          styles.feedListContent,
          insetStyle,
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
            <View
              accessibilityLabel={tr.common.loadingMore}
              accessibilityLiveRegion="polite"
              accessibilityRole="progressbar"
              accessibilityState={{ busy: true }}
              style={styles.listFooter}
            >
              <ActivityIndicator color={colors.primary} size="small" />
              <AppText style={styles.listFooterLabel}>{tr.common.loadingMore}</AppText>
            </View>
          ) : null
        }
      />
      <ScrollAwayHeader controller={topBar} testID="home-top-bar">
        <AppHeader />
      </ScrollAwayHeader>
      <View pointerEvents="none" style={[styles.statusBarStrip, { height: topInset }]} />
    </Screen>
  );
}

/** The first load: the bar over three card skeletons. */
function HomeLoadingState({ insetStyle }: { insetStyle: StyleProp<ViewStyle> }) {
  return (
    <Screen padded={false} safeTop={false} scroll={false} variant="feed">
      <AppHeader />
      <SkeletonGroup style={[styles.skeletonWrap, insetStyle]}>
        <PlaceCardSkeleton />
        <PlaceCardSkeleton />
        <PlaceCardSkeleton />
      </SkeletonGroup>
    </Screen>
  );
}

/** A first load that failed with nothing cached to show. */
function HomeErrorState({
  errorMessage,
  insetStyle,
  onRetry,
}: {
  errorMessage: string;
  insetStyle: StyleProp<ViewStyle>;
  onRetry: () => void;
}) {
  return (
    <Screen padded={false} safeTop={false} variant="feed">
      <AppHeader />
      <View style={insetStyle}>
        <EmptyState
          icon={<MapPin color={colors.danger} size={iconSize.xl} />}
          title={tr.home.errorTitle}
          description={errorMessage}
          actionLabel={tr.common.retry}
          onAction={onRetry}
          tone="danger"
        />
      </View>
    </Screen>
  );
}

/** What an empty feed says: follow someone first, or wait for them to post. */
function HomeFeedEmptyState({
  followingCount,
  onExplore,
}: {
  followingCount: number;
  onExplore: () => void;
}) {
  if (followingCount === 0) {
    return (
      <View style={styles.centeredState}>
        <EmptyState
          icon={<Users color={colors.primary} size={iconSize.xl} />}
          title={tr.home.noFollowingTitle}
          description={tr.home.noFollowingDescription}
        />
        <InstantPressable hitSlop={hitSlopFor(controlSize.default)} style={styles.primaryCta} onPress={onExplore}>
          <MapPin color={colors.onPrimary} size={iconSize.sm} />
          <AppText style={styles.primaryCtaText}>{tr.home.exploreCta}</AppText>
        </InstantPressable>
      </View>
    );
  }

  return (
    <View style={styles.emptyStateWrap}>
      <EmptyState
        icon={<MapPin color={colors.textSoft} size={iconSize.xl} />}
        title={tr.home.noFeedTitle}
        description={tr.home.noFeedDescription}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  statusBarStrip: {
    backgroundColor: colors.surface,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: zIndex.overlay,
  },
  skeletonWrap: {
    flex: 1,
    paddingTop: spacing.md,
    gap: spacing.xl,
  },
  centeredState: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing['3xl'],
  },
  primaryCta: {
    alignSelf: 'center',
    minHeight: controlSize.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryCtaText: textStyle('metadataText', colors.onPrimary, fontWeight.strong),
  emptyStateWrap: {
    paddingTop: spacing['3xl'],
    paddingHorizontal: spacing.md,
  },
  feedListContent: {
    paddingTop: spacing.xs,
  },
  feedListContentEmpty: {
    flexGrow: 1,
  },
  listFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  listFooterLabel: textStyle('metadataText', colors.primary, fontWeight.strong),
  partialDataNotice: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
});
