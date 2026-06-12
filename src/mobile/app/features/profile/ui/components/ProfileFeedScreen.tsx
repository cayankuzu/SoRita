import React from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

import type { User } from '@/mobile/app/data/contracts/entities';
import { PlaceCard } from '@/mobile/app/features/places/public/components';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { useInitialFlatListIndex } from '@/mobile/app/shared/hooks/useInitialFlatListIndex';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import { buildAdaptiveFlatListProps } from '@/mobile/app/shared/utils/flatList';
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
  onOpenListDetail,
  onOwnerPress,
}: ProfileFeedScreenProps) {
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
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={colors.textMuted} size={20} />
        </Pressable>
        <Text style={styles.title}>{title}</Text>
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
              owner={showOwner ? owner : undefined}
              ownerId={item.ownerId}
              listName={item.listName}
              listEmoji={item.listEmoji}
              listIsPublic={item.listIsPublic}
              listCoverImage={item.listCoverImage}
              allowAddToList={false}
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
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
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
