import React from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Minus, Plus, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import { PlaceCard } from '@/mobile/app/features/places/public/components';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { useModalAnimationType } from '@/mobile/app/shared/hooks/useModalAnimationType';
import { colors, radius, touch } from '@/mobile/app/shared/theme/tokens';
import {
  getAndroidModalWindowProps,
  getModalContentMaxHeight,
  getModalSafeAreaPadding,
} from '@/mobile/app/shared/utils/modalLayout';
import {
  buildLocationPlaceStats,
  formatLocationPlaceCardsCount,
} from '@/mobile/app/shared/utils/format';

type PlacePreviewModalProps = {
  visible: boolean;
  entries: Array<{ place: Place; list: PlaceList }>;
  markerColor?: string;
  onRefresh?: () => void;
  onClose: () => void;
  onMinimize?: () => void;
  onCreatePlaceCard?: () => void;
  onOpenList: (list: PlaceList, placeId: string) => void;
};

export function PlacePreviewModal({
  visible,
  entries,
  markerColor,
  onRefresh,
  onClose,
  onMinimize,
  onCreatePlaceCard,
  onOpenList,
}: PlacePreviewModalProps) {
  const animationType = useModalAnimationType('slide');
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { paddingTop, paddingBottom } = getModalSafeAreaPadding({
    topInset: insets.top,
    bottomInset: insets.bottom,
    topSpacing: 20,
    bottomSpacing: 12,
    minBottomPadding: Platform.OS === 'android' ? 28 : 12,
  });
  const sheetMaxHeight = getModalContentMaxHeight({
    viewportHeight: windowHeight,
    paddingTop,
    paddingBottom,
    maxHeightRatio: 0.82,
    minHeight: 276,
  });

  const primaryEntry = entries[0];
  const locationStats = React.useMemo(
    () => buildLocationPlaceStats(entries.map((entry) => entry.place)),
    [entries],
  );
  const headerTitle =
    locationStats.values().next().value?.originalPlaceName || primaryEntry?.place.name || tr.map.locationCardsTitle;
  const headerSubtitle = formatLocationPlaceCardsCount(entries.length);

  if (!primaryEntry) {
    return null;
  }

  return (
    <Modal
      {...getAndroidModalWindowProps({
        navigationBarTranslucent: true,
        statusBarTranslucent: true,
      })}
      visible={visible}
      transparent
      animationType={animationType}
      hardwareAccelerated
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <View
        accessibilityViewIsModal
        importantForAccessibility="yes"
        style={[styles.overlay, { paddingTop, paddingBottom }]}
      >
        <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.sheet, { maxHeight: sheetMaxHeight }]}>
          <Pressable
            accessibilityLabel={tr.common.close}
            accessibilityRole="button"
            style={styles.handleWrap}
            onPress={onClose}
          >
            <View style={styles.handle} />
          </Pressable>

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text accessibilityRole="header" numberOfLines={1} style={styles.headerTitle}>
                {headerTitle}
              </Text>
              <Text numberOfLines={1} style={styles.headerSubtitle}>
                {headerSubtitle}
              </Text>
            </View>
            <View style={styles.headerActions}>
              {onCreatePlaceCard ? (
                <Pressable
                  accessibilityLabel={tr.map.newPlaceCard}
                  accessibilityRole="button"
                  onPress={onCreatePlaceCard}
                  style={styles.headerButton}
                >
                  <Plus color={colors.primary} size={18} />
                </Pressable>
              ) : null}
              {onMinimize ? (
                <Pressable
                  accessibilityLabel={tr.common.minimize}
                  accessibilityRole="button"
                  onPress={onMinimize}
                  style={styles.headerButton}
                >
                  <Minus color={colors.textMuted} size={18} />
                </Pressable>
              ) : null}
              <Pressable
                accessibilityLabel={tr.common.close}
                accessibilityRole="button"
                onPress={onClose}
                style={styles.headerButton}
              >
                <X color={colors.textMuted} size={18} />
              </Pressable>
            </View>
          </View>

          <FlatList
            data={entries}
            contentContainerStyle={styles.content}
            initialNumToRender={2}
            keyExtractor={({ list, place }) => `${list.id}:${place.id}`}
            keyboardShouldPersistTaps="handled"
            maxToRenderPerBatch={3}
            removeClippedSubviews={Platform.OS === 'android'}
            renderItem={({ item: { place, list } }) => (
              <View style={styles.cardWrap}>
                <PlaceCard
                  place={place}
                  ownerId={list.userId}
                  listId={list.id}
                  listName={list.name}
                  listEmoji={list.emoji}
                  listIsPublic={list.isPublic}
                  listCoverImage={list.coverImage}
                  locationPlaceCardsCount={entries.length}
                  locationOriginalPlaceName={headerTitle}
                  allowAddToList={false}
                  markerColor={markerColor}
                  onPress={() => onOpenList(list, place.id)}
                  onRefresh={onRefresh}
                />
              </View>
            )}
            showsVerticalScrollIndicator={false}
            updateCellsBatchingPeriod={40}
            windowSize={5}
          />
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
    maxWidth: 684,
    alignSelf: 'center',
    maxHeight: '82%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  handleWrap: {
    alignItems: 'center',
    minHeight: Platform.OS === 'ios' ? touch.ios : touch.android,
    paddingTop: 8,
    paddingBottom: 2,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSoft,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerButton: {
    width: Platform.OS === 'ios' ? touch.ios : touch.android,
    height: Platform.OS === 'ios' ? touch.ios : touch.android,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  content: {
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  cardWrap: {
    overflow: 'hidden',
    borderRadius: radius.lg,
  },
});
