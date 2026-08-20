import React, { useCallback, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import { openStackScreen, useAppNavigation } from '@/mobile/app/app-shell/navigation/navigation';
import {
  warmListDetailData,
  warmUserProfileData,
} from '@/mobile/app/app-shell/startup/startupDataWarmup';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import {
  getPlaceFeedLocationCardCount,
  type PlaceFeedCardItem,
} from '@/mobile/app/data/selectors/placeAggregation';
import type { FeedVisibilityStore } from '@/mobile/app/features/home/application/feedVisibilityStore';
import { PlaceCard } from '@/mobile/app/features/places/public/components';
import { getMarkerColorForMemberships } from '@/mobile/app/shared/utils/markerColors';

type HomeFeedCardRowProps = {
  item: PlaceFeedCardItem;
  userId: string;
  visibilityStore: FeedVisibilityStore;
};

export const HomeFeedCardRow = React.memo(function HomeFeedCardRow({
  item,
  userId,
  visibilityStore,
}: HomeFeedCardRowProps) {
  const navigation = useAppNavigation();
  const subscribe = useCallback(
    (listener: () => void) => visibilityStore.subscribe(item.key, listener),
    [item.key, visibilityStore],
  );
  const getSnapshot = useCallback(
    () => visibilityStore.isVisible(item.key),
    [item.key, visibilityStore],
  );
  const isVisible = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const handleListIntent = useCallback(() => {
    void warmListDetailData({
      listId: item.listId,
      queryClient,
      viewerId: userId,
    });
  }, [item.listId, userId]);
  const handleListPress = useCallback(() => {
    openStackScreen(navigation, 'ListDetail', {
      listId: item.listId,
      placeId: item.place.id,
    });
  }, [item.listId, item.place.id, navigation]);
  const handleOwnerPress = useCallback(() => {
    if (!item.owner) {
      return;
    }

    if (item.owner.id === userId) {
      navigation.navigate('MainTabs', { screen: 'Profile' });
      return;
    }

    void warmUserProfileData({
      queryClient,
      targetUserId: item.owner.id,
      viewerId: userId,
    });
    openStackScreen(navigation, 'UserProfile', { userId: item.owner.id });
  }, [item.owner, navigation, userId]);

  return (
    <View style={styles.cardRow}>
      <PlaceCard
        place={item.place}
        owner={item.owner}
        ownerId={item.ownerId}
        listId={item.listId}
        listName={item.listName}
        listEmoji={item.listEmoji}
        listIsPublic={item.listIsPublic}
        listCoverImage={item.listCoverImage}
        locationPlaceCardsCount={getPlaceFeedLocationCardCount(item)}
        locationOriginalPlaceName={item.place.name}
        markerColor={getMarkerColorForMemberships(item.memberships, item.listIsPublic)}
        isVisible={isVisible}
        onPressIn={handleListIntent}
        onPress={handleListPress}
        onOwnerPress={handleOwnerPress}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  cardRow: {
    marginBottom: 12,
  },
});
