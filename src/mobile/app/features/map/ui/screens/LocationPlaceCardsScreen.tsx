import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
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
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
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
  const lists = visibleDataQuery.data?.lists || [];
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
    'Bu konumdaki kartlar';
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
        <View style={styles.loadingScreen}>
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen safeTop={false} padded={false} scroll={false}>
      <View style={styles.screenShell}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.topBarButton}>
            <ArrowLeft color={colors.text} size={18} />
          </Pressable>

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
              icon={<MapPin color={colors.textSoft} size={34} />}
              title="Bu konumda kart bulunamadi"
              description="Bu koordinasyona bagli gorunur bir mekan karti su an yok."
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
                    <Text style={styles.highlightPillText}>Secili mekan karti</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topBarButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  topBarButtonSpacer: {
    width: 40,
    height: 40,
  },
  topBarCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '800',
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
    gap: 14,
    paddingHorizontal: 16,
    paddingBottom: 24,
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
    top: 12,
    right: 12,
    zIndex: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  highlightPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
