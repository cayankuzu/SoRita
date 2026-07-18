import React from 'react';
import { ArrowLeft } from 'lucide-react-native';
import {
  FlatList,
  RefreshControl,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  openStackScreen,
  useAppNavigation,
} from '@/mobile/app/app-shell/navigation/navigation';
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

import { exploreScreenStyles as styles } from './exploreScreenStyles';

type ExploreFeedViewProps = {
  items: PlaceFeedCardItem[];
  startIndex: number;
  refreshing: boolean;
  onRefresh: () => void;
  onBack: () => void;
};

export function ExploreFeedView({
  items,
  startIndex,
  refreshing,
  onRefresh,
  onBack,
}: ExploreFeedViewProps) {
  const navigation = useAppNavigation();
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
        style={[
          styles.feedHeader,
          { paddingHorizontal: appLayout.screenPadding },
        ]}
      >
        <IconButton
          accessibilityLabel={tr.common.back}
          onPress={onBack}
          style={styles.backButton}
        >
          <ArrowLeft color={colors.textMuted} size={20} />
        </IconButton>
        <Text style={styles.feedTitle}>{tr.explore.title}</Text>
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
              owner={item.owner}
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
              onOwnerPress={() =>
                item.owner &&
                openStackScreen(navigation, 'UserProfile', {
                  userId: item.owner.id,
                })
              }
              onPress={() =>
                openStackScreen(navigation, 'ListDetail', {
                  listId: item.listId,
                  placeId: item.place.id,
                })
              }
            />
          </View>
        )}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </Screen>
  );
}
