import React from 'react';
import { FlatList, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Minus, Plus, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import { PlaceCard } from '@/mobile/app/features/places/public/components';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { useModalAnimationType } from '@/mobile/app/shared/hooks/useModalAnimationType';
import {
  colors,
  controlSize,
  hitSlopFor,
  iconSize,
  radius,
  spacing,
  textStyle,
} from '@/mobile/app/shared/theme/tokens';
import {
  getModalContentMaxHeight,
  getModalSafeAreaPadding,
} from '@/mobile/app/shared/utils/modalLayout';
import {
  buildLocationPlaceStats,
  formatLocationPlaceCardsCount,
} from '@/mobile/app/shared/utils/format';
import { AppModal } from '@/mobile/app/shared/components/feedback/AppModal';

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
  const { paddingTop } = getModalSafeAreaPadding({
    topInset: insets.top,
    bottomInset: insets.bottom,
    topSpacing: 20,
    bottomSpacing: 12,
    minBottomPadding: Platform.OS === 'android' ? 28 : 12,
  });
  // The sheet sits on the bottom edge, as the shared sheets do, with the
  // navigation bar's inset inside it. Floating it above that inset left the
  // dimmed tab bar's labels showing under it.
  const sheetBottomPadding = Math.max(insets.bottom, spacing.md);
  const sheetMaxHeight = getModalContentMaxHeight({
    viewportHeight: windowHeight,
    paddingTop,
    paddingBottom: 0,
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
    <AppModal
      animationType={animationType}
      onRequestClose={onClose}
      visible={visible}
    >
      <View
        accessibilityViewIsModal
        importantForAccessibility="yes"
        onAccessibilityEscape={onClose}
        style={[styles.overlay, { paddingTop }]}
      >
        <InstantPressable disableFeedback accessible={false} style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.sheet, { maxHeight: sheetMaxHeight, paddingBottom: sheetBottomPadding }]}>
          <InstantPressable
            hitSlop={hitSlopFor(controlSize.default)}
            accessibilityLabel={onMinimize ? tr.common.minimize : tr.common.close}
            accessibilityRole="button"
            style={styles.handleWrap}
            onPress={onMinimize ?? onClose}
          >
            <View style={styles.handle} />
          </InstantPressable>

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <AppText accessibilityRole="header" numberOfLines={1} style={styles.headerTitle}>
                {headerTitle}
              </AppText>
              <AppText numberOfLines={1} style={styles.headerSubtitle}>
                {headerSubtitle}
              </AppText>
            </View>
            <View style={styles.headerActions}>
              {onCreatePlaceCard ? (
                <InstantPressable
                  hitSlop={hitSlopFor(controlSize.default)}
                  accessibilityLabel={tr.map.newPlaceCard}
                  accessibilityRole="button"
                  onPress={onCreatePlaceCard}
                  style={styles.headerButton}
                >
                  <Plus color={colors.primary} size={iconSize.md} />
                </InstantPressable>
              ) : null}
              {onMinimize ? (
                <InstantPressable
                  hitSlop={hitSlopFor(controlSize.default)}
                  accessibilityLabel={tr.common.minimize}
                  accessibilityRole="button"
                  onPress={onMinimize}
                  style={styles.headerButton}
                >
                  <Minus color={colors.textMuted} size={iconSize.md} />
                </InstantPressable>
              ) : null}
              <InstantPressable
                hitSlop={hitSlopFor(controlSize.default)}
                accessibilityLabel={tr.common.close}
                accessibilityRole="button"
                onPress={onClose}
                style={styles.headerButton}
              >
                <X color={colors.textMuted} size={iconSize.md} />
              </InstantPressable>
            </View>
          </View>

          <FlatList
            data={entries}
            contentContainerStyle={styles.content}
            initialNumToRender={2}
            keyExtractor={({ list, place }) => `${list.id}:${place.id}`}
            keyboardShouldPersistTaps="handled"
            maxToRenderPerBatch={3}
            // Off, as for every list here: Fabric on Android can leave rows that
            // arrive after the first render undrawn while clipping is on.
            removeClippedSubviews={false}
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
    </AppModal>
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
    minHeight: controlSize.default,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxs,
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
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  headerTitle: textStyle('compactTitleText', colors.text),
  headerSubtitle: textStyle('compactBodyText', colors.textSoft),
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerButton: {
    width: controlSize.default,
    height: controlSize.default,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  content: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  cardWrap: {
    overflow: 'hidden',
    borderRadius: radius.lg,
  },
});
