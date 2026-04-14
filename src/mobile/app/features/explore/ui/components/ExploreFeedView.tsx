import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { FlatList, Platform, Pressable, RefreshControl, Text, View } from 'react-native';

import { PlaceCard } from '@/mobile/app/features/places/public/components';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { useInitialFlatListIndex } from '@/mobile/app/shared/hooks/useInitialFlatListIndex';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { openStackScreen } from '@/mobile/app/shared/utils/navigation';
import type { PlaceFeedCardItem } from '@/mobile/app/shared/utils/placeAggregation';

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
  const navigation = useNavigation<any>();
  const { listRef, handleContentSizeChange, handleScrollToIndexFailed } =
    useInitialFlatListIndex<PlaceFeedCardItem>({
      itemCount: items.length,
      startIndex,
    });

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.feedHeader}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={colors.textMuted} size={20} />
        </Pressable>
        <Text style={styles.feedTitle}>{tr.explore.title}</Text>
      </View>

      <FlatList
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
        initialNumToRender={4}
        maxToRenderPerBatch={6}
        windowSize={6}
        removeClippedSubviews={Platform.OS === 'android'}
      />
    </Screen>
  );
}
