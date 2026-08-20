import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { MapPin } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import {
  openStackScreen,
  useAppNavigation,
  useRootStackRoute,
} from '@/mobile/app/app-shell/navigation/navigation';
import { useLocationPlaceCardsQuery } from '@/mobile/app/data/hooks/useLocationPlaceCardsQuery';
import { PlaceCard } from '@/mobile/app/features/places/public/components';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
import { StackScreenHeader } from '@/mobile/app/shared/components/navigation/StackScreenHeader';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { PlaceCardSkeleton, SkeletonGroup } from '@/mobile/app/shared/components/ui/SkeletonPlaceholder';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius, typography } from '@/mobile/app/shared/theme/tokens';
import { formatLocationPlaceCardsCount } from '@/mobile/app/shared/utils/format';
import { getMarkerColorByVisibility } from '@/mobile/app/shared/utils/markerColors';
import { buildAdaptiveFlatListProps } from '@/mobile/app/shared/utils/flatList';

export function LocationPlaceCardsScreen() {
  const navigation = useAppNavigation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const route = useRootStackRoute<'LocationPlaceCards'>();
  const lat = route.params?.lat ?? 0;
  const lng = route.params?.lng ?? 0;
  const placeName = route.params?.placeName;
  const placeId = route.params?.placeId;
  const ownerId = route.params?.ownerId;
  const locationCardsQuery = useLocationPlaceCardsQuery({
    lat,
    lng,
    ownerId,
    placeName,
    viewerId: user?.id,
  });
  const {
    entries,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    totalCount,
  } = locationCardsQuery;
  const errorMessage = locationCardsQuery.error
    ? getUserFacingErrorMessage(locationCardsQuery.error, tr.system.connectionUnavailable)
    : null;
  const headerTitle =
    placeName ||
    entries[0]?.place.name ||
    tr.map.locationCardsTitle;
  const listProps = useMemo(
    () =>
      buildAdaptiveFlatListProps<(typeof entries)[number]>({
        itemCount: entries.length,
        viewportHeight: height,
        viewportWidth: width,
      }),
    [entries.length, height, width],
  );

  React.useEffect(() => {
    if (
      !placeId ||
      entries.some((entry) => entry.place.id === placeId) ||
      !hasNextPage ||
      isFetchingNextPage
    ) {
      return;
    }

    void fetchNextPage();
  }, [entries, fetchNextPage, hasNextPage, isFetchingNextPage, placeId]);

  if (locationCardsQuery.isLoading && entries.length === 0) {
    return (
      <Screen safeTop={false} padded={false} scroll={false}>
        <SkeletonGroup style={[styles.loadingScreen, { paddingTop: insets.top + 8 }]}>
          <PlaceCardSkeleton />
          <PlaceCardSkeleton />
        </SkeletonGroup>
      </Screen>
    );
  }

  return (
    <Screen safeTop={false} padded={false} scroll={false}>
      <View style={styles.screenShell}>
        <StackScreenHeader
          onBack={() => navigation.goBack()}
          title={headerTitle}
          subtitle={formatLocationPlaceCardsCount(totalCount)}
        />

        <FlatList
          {...listProps}
          data={entries}
          keyExtractor={({ list, place }) => `${list.id}:${place.id}`}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            entries.length === 0 ? styles.contentEmpty : null,
          ]}
          showsVerticalScrollIndicator={false}
          refreshing={locationCardsQuery.isRefetching && !isFetchingNextPage}
          onRefresh={() => {
            void locationCardsQuery.refetch();
          }}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              void fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <EmptyState
              icon={<MapPin color={errorMessage ? colors.danger : colors.textSoft} size={30} />}
              title={errorMessage ? tr.map.searchUnavailableTitle : tr.map.locationCardsEmptyTitle}
              description={errorMessage || tr.map.locationCardsEmptyDescription}
              actionLabel={errorMessage ? tr.common.retry : undefined}
              onAction={errorMessage ? () => void locationCardsQuery.refetch() : undefined}
              tone={errorMessage ? 'danger' : 'default'}
            />
          }
          ListHeaderComponent={
            errorMessage && entries.length > 0 ? (
              <InlineNotice
                tone="warning"
                title={tr.map.searchUnavailableTitle}
                description={errorMessage}
                actionLabel={tr.common.retry}
                onAction={() => void locationCardsQuery.refetch()}
              />
            ) : null
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.listFooter}>
                <ActivityIndicator color={colors.primary} size="small" />
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const { place, list, owner } = item;
            const isHighlighted = place.id === placeId;

            return (
              <View
                style={[
                  styles.cardShell,
                  isHighlighted ? styles.cardShellHighlighted : null,
                ]}
              >
                {isHighlighted ? (
                  <View style={styles.highlightPill}>
                    <Text style={styles.highlightPillText}>{tr.map.selectedPlaceCard}</Text>
                  </View>
                ) : null}

                <PlaceCard
                  place={place}
                  owner={owner}
                  ownerId={list.userId}
                  listId={list.id}
                  listName={list.name}
                  listEmoji={list.emoji}
                  listIsPublic={list.isPublic}
                  listCoverImage={list.coverImage}
                  locationPlaceCardsCount={totalCount}
                  locationOriginalPlaceName={headerTitle}
                  markerColor={getMarkerColorByVisibility(locationCardsQuery.markerVisibility)}
                  onPlaceNamePress={null}
                  onOwnerPress={
                    owner
                      ? () => openStackScreen(navigation, 'UserProfile', { userId: owner.id })
                      : undefined
                  }
                  onPress={() =>
                    openStackScreen(navigation, 'ListDetail', {
                      listId: list.id,
                      placeId: place.id,
                    })
                  }
                />
              </View>
            );
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenShell: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    gap: 12,
    paddingHorizontal: 12,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 18,
  },
  contentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  listFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  cardShell: {
    overflow: 'hidden',
    borderRadius: radius.lg,
  },
  cardShellHighlighted: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  highlightPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  highlightPillText: {
    ...typography.metadataText,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
