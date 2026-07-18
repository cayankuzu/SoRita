import React from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

import type { User } from '@/mobile/app/data/contracts/entities';
import { PlaceCard } from '@/mobile/app/features/places/public/components';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { useInitialFlatListIndex } from '@/mobile/app/shared/hooks/useInitialFlatListIndex';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { buildAdaptiveFlatListProps } from '@/mobile/app/shared/utils/flatList';
import { getMarkerColorForMemberships } from '@/mobile/app/shared/utils/markerColors';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';

type ProfileFeedScreenProps = {
  title: string;
  items: PlaceFeedCardItem[];
  startIndex?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  owner?: User;
  showOwner?: boolean;
  onBack: () => void;
  onDeletePlace?: (item: PlaceFeedCardItem) => void;
  onEditPlace?: (item: PlaceFeedCardItem) => void;
  onOpenListDetail: (item: PlaceFeedCardItem) => void;
  onOwnerPress?: () => void;
};

export function ProfileFeedScreen({
  title,
  items,
  startIndex = 0,
  refreshing = false,
  onRefresh,
  owner,
  showOwner = false,
  onBack,
  onDeletePlace,
  onEditPlace,
  onOpenListDetail,
  onOwnerPress,
}: ProfileFeedScreenProps) {
  const { height, width } = useWindowDimensions();
  const appLayout = useAppLayout();
  const estimatedItemLength = React.useMemo(
    () => Math.max(440, Math.round(height * 0.78)),
    [height],
  );
  const {
    listRef,
    safeStartIndex,
    initialScrollIndex,
    getItemLayout,
    handleContentSizeChange,
    handleScrollToIndexFailed,
  } = useInitialFlatListIndex<PlaceFeedCardItem>({
    estimatedItemLength,
    itemCount: items.length,
    startIndex,
  });
  const listProps = React.useMemo(
    () =>
      buildAdaptiveFlatListProps({
        containsNativeMaps: true,
        itemCount: items.length,
        viewportHeight: height,
        viewportWidth: width,
      }),
    [height, items.length, width],
  );
  return (
    <Screen scroll={false} padded={false}>
      <View
        style={[styles.header, { paddingHorizontal: appLayout.screenPadding }]}
      >
        <IconButton
          accessibilityLabel={tr.common.back}
          onPress={onBack}
          style={styles.backButton}
        >
          <ArrowLeft color={colors.textMuted} size={20} />
        </IconButton>
        <Text style={styles.title}>{title}</Text>
      </View>

      <FlatList
        {...listProps}
        ref={listRef}
        data={items}
        getItemLayout={getItemLayout}
        initialScrollIndex={initialScrollIndex}
        initialNumToRender={Math.max(
          listProps.initialNumToRender ?? 4,
          safeStartIndex > 0 ? 6 : 4,
        )}
        keyExtractor={(item) => item.key}
        onContentSizeChange={handleContentSizeChange}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        renderItem={({ item }) => (
          <View>
            <PlaceCard
              place={item.place}
              owner={showOwner ? owner : undefined}
              ownerId={item.ownerId}
              listId={item.listId}
              listName={item.listName}
              listEmoji={item.listEmoji}
              listIsPublic={item.listIsPublic}
              listCoverImage={item.listCoverImage}
              locationPlaceCardsCount={item.memberships.length}
              locationOriginalPlaceName={item.place.name}
              markerColor={getMarkerColorForMemberships(
                item.memberships,
                item.listIsPublic,
              )}
              onEdit={onEditPlace ? () => onEditPlace(item) : undefined}
              onDelete={onDeletePlace ? () => onDeletePlace(item) : undefined}
              onOwnerPress={showOwner ? onOwnerPress : undefined}
              onPress={() => onOpenListDetail(item)}
              onRefresh={onRefresh}
            />
          </View>
        )}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 44,
    height: 44,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    paddingVertical: 12,
    gap: 16,
  },
});
