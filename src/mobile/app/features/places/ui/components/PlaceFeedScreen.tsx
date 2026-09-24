import React from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

import type { User } from '@/mobile/app/data/contracts/entities';
import {
  getPlaceFeedLocationCardCount,
  type PlaceFeedCardItem,
} from '@/mobile/app/data/selectors/placeAggregation';
import { PlaceCard } from '@/mobile/app/features/places/ui/components/PlaceCard';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { useAnchoredFeed } from '@/mobile/app/shared/hooks/useAnchoredFeed';
import { useAndroidBackHandler } from '@/mobile/app/shared/hooks/useAndroidBackHandler';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize, minTouchSize, spacing, textStyle } from '@/mobile/app/shared/theme/tokens';
import { buildAdaptiveFlatListProps } from '@/mobile/app/shared/utils/flatList';
import { getMarkerColorForMemberships } from '@/mobile/app/shared/utils/markerColors';

type PlaceFeedScreenProps = {
  title: string;
  items: PlaceFeedCardItem[];
  // The card that was tapped in the grid; the feed opens on it.
  startIndex?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  onBack: () => void;
  onDeletePlace?: (item: PlaceFeedCardItem) => void;
  onEditPlace?: (item: PlaceFeedCardItem) => void;
  onOpenListDetail: (item: PlaceFeedCardItem) => void;
  // Who to show on each card; left out, the cards show no owner.
  ownerFor?: (item: PlaceFeedCardItem) => User | null | undefined;
  onOwnerPress?: (item: PlaceFeedCardItem) => void;
  // False inside a tab, whose navigator header already clears the status bar.
  safeTop?: boolean;
};

/**
 * The feed a grid tile opens, on Profile and Explore alike: the tapped place
 * first, the rest of the grid's places above and below it.
 */
export function PlaceFeedScreen({
  title,
  items,
  startIndex = 0,
  refreshing = false,
  onRefresh,
  onBack,
  onDeletePlace,
  onEditPlace,
  onOpenListDetail,
  ownerFor,
  onOwnerPress,
  safeTop = true,
}: PlaceFeedScreenProps) {
  const { height, width } = useWindowDimensions();
  const appLayout = useAppLayout();
  const feed = useAnchoredFeed({ items, startIndex });
  // The feed is a view inside its tab, not a screen of its own: without this
  // the back key left the tab for Home instead of returning to the grid.
  useAndroidBackHandler(true, onBack);
  const listProps = React.useMemo(
    () =>
      buildAdaptiveFlatListProps<PlaceFeedCardItem>({
        containsNativeMaps: true,
        itemCount: items.length,
        viewportHeight: height,
        viewportWidth: width,
      }),
    [height, items.length, width],
  );

  return (
    <Screen safeTop={safeTop} scroll={false} padded={false}>
      <View style={[styles.header, { paddingHorizontal: appLayout.screenPadding }]}>
        <IconButton
          accessibilityLabel={tr.common.back}
          onPress={onBack}
          style={styles.backButton}
        >
          <ArrowLeft color={colors.textMuted} size={iconSize.md} />
        </IconButton>
        <AppText accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {title}
        </AppText>
      </View>

      <FlatList
        {...listProps}
        data={feed.data}
        keyExtractor={(item) => item.key}
        maintainVisibleContentPosition={feed.maintainVisibleContentPosition}
        onContentSizeChange={feed.onContentSizeChange}
        renderItem={({ item }) => (
          <PlaceCard
            place={item.place}
            owner={ownerFor?.(item)}
            ownerId={item.ownerId}
            listId={item.listId}
            listName={item.listName}
            listEmoji={item.listEmoji}
            listIsPublic={item.listIsPublic}
            listCoverImage={item.listCoverImage}
            locationPlaceCardsCount={getPlaceFeedLocationCardCount(item)}
            locationOriginalPlaceName={item.place.name}
            markerColor={getMarkerColorForMemberships(item.memberships, item.listIsPublic)}
            onEdit={onEditPlace ? () => onEditPlace(item) : undefined}
            onDelete={onDeletePlace ? () => onDeletePlace(item) : undefined}
            onOwnerPress={onOwnerPress ? () => onOwnerPress(item) : undefined}
            onPress={() => onOpenListDetail(item)}
            onRefresh={onRefresh}
          />
        )}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.list}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: minTouchSize,
    height: minTouchSize,
  },
  title: {
    ...textStyle('compactTitleText', colors.text),
    flex: 1,
  },
  list: {
    flex: 1,
  },
  content: {
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
});
