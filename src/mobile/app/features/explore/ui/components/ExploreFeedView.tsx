import React from 'react';
import { ArrowLeft } from 'lucide-react-native';
import { FlatList, Pressable, RefreshControl, Text, useWindowDimensions, View } from 'react-native';

import { openStackScreen, useAppNavigation } from '@/mobile/app/app-shell/navigation/navigation';
import { PlaceCard } from '@/mobile/app/features/places/public/components';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { useInitialFlatListIndex } from '@/mobile/app/shared/hooks/useInitialFlatListIndex';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { buildAdaptiveFlatListProps } from '@/mobile/app/shared/utils/flatList';
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
  const { listRef, handleContentSizeChange, handleScrollToIndexFailed } =
    useInitialFlatListIndex<PlaceFeedCardItem>({
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
      <View style={styles.feedHeader}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={colors.textMuted} size={20} />
        </Pressable>
        <Text style={styles.feedTitle}>{tr.explore.title}</Text>
      </View>

      <FlatList
        {...listProps}
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.key}
        onContentSizeChange={handleContentSizeChange}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        renderItem={({ item }) => (
          <View>
            <PlaceCard
              place={item.place}
              owner={item.owner}
              ownerId={item.ownerId}
              listName={item.listName}
              listEmoji={item.listEmoji}
              listIsPublic={item.listIsPublic}
              listCoverImage={item.listCoverImage}
              onOwnerPress={() =>
                item.owner && openStackScreen(navigation, 'UserProfile', { userId: item.owner.id })
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
