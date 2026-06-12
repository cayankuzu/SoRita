import React from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import { PlaceCard } from '@/mobile/app/features/places/public/components';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type PlacePreviewModalProps = {
  visible: boolean;
  place: PlaceList['places'][number] | null;
  list: PlaceList | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onClose: () => void;
  onOpenList: (list: PlaceList, placeId: string) => void;
};

export function PlacePreviewModal({
  visible,
  place,
  list,
  refreshing = false,
  onRefresh,
  onClose,
  onOpenList,
}: PlacePreviewModalProps) {
  const insets = useSafeAreaInsets();

  if (!place || !list) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      hardwareAccelerated
      navigationBarTranslucent
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      <View style={[styles.overlay, { paddingTop: 20 + insets.top, paddingBottom: 12 + insets.bottom }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          <Pressable style={styles.handleWrap} onPress={onClose}>
            <View style={styles.handle} />
          </Pressable>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
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
          >
            <PlaceCard
              place={place}
              ownerId={list.userId}
              listName={list.name}
              listEmoji={list.emoji}
              listIsPublic={list.isPublic}
              listCoverImage={list.coverImage}
              allowAddToList={false}
              markerContext="list"
              onPress={() => onOpenList(list, place.id)}
              onRefresh={onRefresh}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    maxHeight: '82%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 52,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBorder,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
