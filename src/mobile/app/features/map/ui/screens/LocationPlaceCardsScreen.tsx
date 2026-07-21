import React, { useMemo } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { ArrowLeft, MapPin } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import {
  openStackScreen,
  useAppNavigation,
  useRootStackRoute,
} from '@/mobile/app/app-shell/navigation/navigation';
import { useVisibleDataQuery } from '@/mobile/app/data/hooks/useVisibleDataQuery';
import { PlaceCard } from '@/mobile/app/features/places/public/components';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { PlaceCardSkeleton, SkeletonGroup } from '@/mobile/app/shared/components/ui/SkeletonPlaceholder';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius, typography } from '@/mobile/app/shared/theme/tokens';
import {
  buildLocationPlaceStats,
  formatLocationPlaceCardsCount,
  getMarkerAggregationKey,
} from '@/mobile/app/shared/utils/format';
import {
  getMarkerColorForPlaceAcrossLists,
} from '@/mobile/app/shared/utils/markerColors';
import { normalizeSearchText } from '@/mobile/app/shared/utils/textSort';
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
  const locationKey = useMemo(() => getMarkerAggregationKey({ lat, lng }), [lat, lng]);
  const visibleDataQuery = useVisibleDataQuery(user?.id, {
    listPageSize: 100,
  });
  const lists = useMemo(
    () => visibleDataQuery.data?.lists || [],
    [visibleDataQuery.data?.lists],
  );
  const ownerById = useMemo(() => {
    const users = [...(visibleDataQuery.data?.allUsers || []), ...(visibleDataQuery.data?.users || [])];
    return new Map(users.map((item) => [item.id, item]));
  }, [visibleDataQuery.data?.allUsers, visibleDataQuery.data?.users]);
  const normalizedPlaceName = useMemo(
    () => normalizeSearchText(placeName) || null,
    [placeName],
  );
  const entries = useMemo(
    () =>
      lists
        .flatMap((list) =>
          list.places
            .filter((place) => {
              if (getMarkerAggregationKey(place) !== locationKey) {
                return false;
              }

              if (ownerId && list.userId !== ownerId) {
                return false;
              }

              if (ownerId && normalizedPlaceName) {
                return normalizeSearchText(place.name) === normalizedPlaceName;
              }

              return true;
            })
            .map((place) => ({
              list,
              owner: ownerById.get(list.userId) || null,
              place,
            })),
        )
        .sort(
          (left, right) =>
            new Date(right.place.updatedAt || right.place.addedAt).getTime() -
            new Date(left.place.updatedAt || left.place.addedAt).getTime(),
        ),
    [lists, locationKey, normalizedPlaceName, ownerById, ownerId],
  );
  const locationStats = useMemo(
    () => buildLocationPlaceStats(entries.map((entry) => entry.place)),
    [entries],
  );
  const headerTitle =
    placeName ||
    locationStats.get(locationKey)?.originalPlaceName ||
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

  if (visibleDataQuery.isLoading && entries.length === 0) {
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
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <IconButton
            accessibilityLabel={tr.common.back}
            onPress={() => navigation.goBack()}
            style={styles.topBarButton}
          >
            <ArrowLeft color={colors.text} size={18} />
          </IconButton>

          <View style={styles.topBarCopy}>
            <Text numberOfLines={1} style={styles.topBarTitle}>
              {headerTitle}
            </Text>
            <Text numberOfLines={1} style={styles.topBarSubtitle}>
              {formatLocationPlaceCardsCount(entries.length)}
            </Text>
          </View>

          <View style={styles.topBarButtonSpacer} />
        </View>

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
          refreshing={visibleDataQuery.isRefetching}
          onRefresh={() => {
            void visibleDataQuery.refetch();
          }}
          ListEmptyComponent={
            <EmptyState
              icon={<MapPin color={colors.textSoft} size={30} />}
              title={tr.map.locationCardsEmptyTitle}
              description={tr.map.locationCardsEmptyDescription}
            />
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
                  locationPlaceCardsCount={entries.length}
                  locationOriginalPlaceName={headerTitle}
                  markerColor={getMarkerColorForPlaceAcrossLists(place, lists, list.isPublic)}
                  markerContext="list"
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  topBarButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  topBarButtonSpacer: {
    width: 44,
    height: 44,
  },
  topBarCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  topBarSubtitle: {
    fontSize: 12,
    color: colors.textSoft,
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
