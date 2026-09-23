import React from 'react';
import { ActivityIndicator, FlatList, Linking, StyleSheet, View } from 'react-native';
import { Image as ImageIcon, RefreshCcw, Settings } from 'lucide-react-native';

import { MediaLibraryAssetTile } from '@/mobile/app/platform/media/MediaLibraryAssetTile';
import type { MediaLibraryAssetTileItem } from '@/mobile/app/platform/media/mediaLibraryAssetPreparation';
import { PLACE_MEDIA_MAX_ACCEPTED_VIDEO_DURATION_SECONDS } from '@/mobile/app/platform/media/mediaConstants';
import type {
  MediaLibraryPickerAsset,
  MediaLibrarySelectionFilter,
} from '@/mobile/app/platform/media/mediaLibrarySelectionTypes';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { Chip } from '@/mobile/app/shared/components/ui/Chip';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  fontWeight,
  iconSize,
  minTouchSize,
  radius,
  spacing,
  textStyle,
  typography,
} from '@/mobile/app/shared/theme/tokens';

export const MEDIA_LIBRARY_GRID_GAP = 10;
const PAGE_SIZE = 33;
type SelectionCounts = {
  photos: number;
  total: number;
  videos: number;
};

type MediaLibrarySelectionContentProps = {
  allowVideos: boolean;
  assetTileItems: MediaLibraryAssetTileItem[];
  columnCount: number;
  disabledFilters: ReadonlySet<MediaLibrarySelectionFilter>;
  endCursor: string | null;
  filter: MediaLibrarySelectionFilter;
  hasNextPage: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  loadAssetsPage: (reset: boolean, cursor?: string | null) => Promise<void>;
  loadFailed: boolean;
  maxSelection: number;
  onAssetToggle: (asset: MediaLibraryPickerAsset) => void;
  onFilterChange: (filter: MediaLibrarySelectionFilter) => void;
  onPreviewError: (asset: MediaLibraryPickerAsset) => void;
  permissionCanAskAgain: boolean;
  permissionDenied: boolean;
  remainingPhotos: number;
  remainingVideos: number;
  selectedCounts: SelectionCounts;
  tileSize: number;
  visibleFilters: MediaLibrarySelectionFilter[];
};

export const MediaLibrarySelectionContent = React.memo(
  function MediaLibrarySelectionContent({
    allowVideos,
    assetTileItems,
    columnCount,
    disabledFilters,
    endCursor,
    filter,
    hasNextPage,
    isLoading,
    isLoadingMore,
    loadAssetsPage,
    loadFailed,
    maxSelection,
    onAssetToggle,
    onFilterChange,
    onPreviewError,
    permissionCanAskAgain,
    permissionDenied,
    remainingPhotos,
    remainingVideos,
    selectedCounts,
    tileSize,
    visibleFilters,
  }: MediaLibrarySelectionContentProps) {
    const getTileKey = React.useCallback(
      (item: MediaLibraryAssetTileItem) => item.asset.id,
      [],
    );
    const renderTile = React.useCallback(
      ({ item }: { item: MediaLibraryAssetTileItem }) => (
        <MediaLibraryAssetTile
          asset={item.asset}
          disabled={
            item.asset.mediaType === 'video' &&
            item.asset.duration > PLACE_MEDIA_MAX_ACCEPTED_VIDEO_DURATION_SECONDS
          }
          orderIndex={item.orderIndex}
          size={tileSize}
          onPress={onAssetToggle}
          onPreviewError={onPreviewError}
        />
      ),
      [onAssetToggle, onPreviewError, tileSize],
    );

    return (
      <>
        <View style={styles.counterRow}>
          <View style={styles.counterChip}>
            <AppText style={styles.counterChipText}>
              {tr.placeEditor.photoCounterLabel(selectedCounts.photos, remainingPhotos)}
            </AppText>
          </View>
          {allowVideos ? (
            <View style={styles.counterChip}>
              <AppText style={styles.counterChipText}>
                {tr.placeEditor.videoCounterLabel(selectedCounts.videos, remainingVideos)}
              </AppText>
            </View>
          ) : null}
          <View style={styles.counterChipStrong}>
            <AppText style={styles.counterChipStrongText}>
              {tr.placeEditor.mediaCounterLabel(selectedCounts.total, maxSelection)}
            </AppText>
          </View>
        </View>

        <View style={styles.filterRow}>
          {visibleFilters.map((key) => {
            const label = key === 'all'
              ? tr.notifications.categories.all
              : key === 'photo'
                ? tr.placeEditor.photos
                : tr.mediaPicker.videos;

            return (
              <Chip
                disabled={disabledFilters.has(key) || isLoading || isLoadingMore}
                key={key}
                kind="filter"
                label={label}
                onPress={() => onFilterChange(key)}
                selected={filter === key}
              />
            );
          })}
        </View>

        {isLoading ? (
          <View
            accessible
            accessibilityLabel={tr.common.loading}
            accessibilityRole="progressbar"
            accessibilityState={{ busy: true }}
            accessibilityLiveRegion="polite"
            style={styles.stateWrap}
          >
            <ActivityIndicator color={colors.primary} size="small" />
            <AppText style={styles.stateText}>{tr.common.loading}</AppText>
          </View>
        ) : loadFailed ? (
          <View style={styles.stateWrap}>
            <ImageIcon color={colors.textSoft} size={iconSize.md} />
            <AppText style={styles.stateTitle}>{tr.map.searchUnavailableTitle}</AppText>
            <AppText style={styles.stateText}>{tr.system.connectionUnavailable}</AppText>
            <InstantPressable
              accessibilityRole="button"
              style={styles.retryButton}
              onPress={() => void loadAssetsPage(true)}
            >
              <RefreshCcw color={colors.primary} size={iconSize.xs} />
              <AppText style={styles.retryButtonText}>{tr.common.retry}</AppText>
            </InstantPressable>
          </View>
        ) : permissionDenied ? (
          <View style={styles.stateWrap}>
            <ImageIcon color={colors.textSoft} size={iconSize.md} />
            <AppText style={styles.stateTitle}>{tr.mediaPicker.permissionTitle}</AppText>
            <AppText accessibilityLiveRegion="polite" style={styles.stateText}>
              {permissionCanAskAgain
                ? tr.mediaPicker.permissionDescription
                : tr.mediaPicker.permissionBlockedDescription}
            </AppText>
            <InstantPressable
              accessibilityLabel={
                permissionCanAskAgain ? tr.common.retry : tr.mediaPicker.openSettings
              }
              accessibilityRole="button"
              style={styles.retryButton}
              onPress={() => {
                if (!permissionCanAskAgain) {
                  void Linking.openSettings();
                  return;
                }

                void loadAssetsPage(true);
              }}
            >
              {permissionCanAskAgain ? (
                <RefreshCcw color={colors.primary} size={iconSize.xs} />
              ) : (
                <Settings color={colors.primary} size={iconSize.xs} />
              )}
              <AppText style={styles.retryButtonText}>
                {permissionCanAskAgain ? tr.common.retry : tr.mediaPicker.openSettings}
              </AppText>
            </InstantPressable>
          </View>
        ) : (
          <FlatList
            data={assetTileItems}
            key={`media-grid-${columnCount}`}
            keyExtractor={getTileKey}
            initialNumToRender={Math.min(PAGE_SIZE, columnCount * 4)}
            maxToRenderPerBatch={columnCount * 3}
            numColumns={columnCount}
            renderItem={renderTile}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.gridContent}
            nestedScrollEnabled
            removeClippedSubviews={false}
            showsVerticalScrollIndicator={false}
            updateCellsBatchingPeriod={80}
            windowSize={5}
            onEndReached={() => {
              if (!hasNextPage || isLoadingMore) {
                return;
              }

              void loadAssetsPage(false, endCursor);
            }}
            onEndReachedThreshold={0.35}
            ListFooterComponent={
              isLoadingMore ? (
                <View
                  accessible
                  accessibilityLabel={tr.common.loading}
                  accessibilityRole="progressbar"
                  accessibilityState={{ busy: true }}
                  accessibilityLiveRegion="polite"
                  style={styles.loadMoreWrap}
                >
                  <ActivityIndicator color={colors.primary} size="small" />
                  <AppText style={styles.loadMoreText}>{tr.common.loading}</AppText>
                </View>
              ) : null
            }
          />
        )}
      </>
    );
  },
);

const styles = StyleSheet.create({
  counterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  counterChip: {
    borderRadius: radius.pill,
    backgroundColor: colors.primaryBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  counterChipText: textStyle('metadataText', colors.primary, fontWeight.strong),
  counterChipStrong: {
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  counterChipStrongText: textStyle('metadataText', colors.text, fontWeight.strong),
  filterRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  gridContent: {
    paddingBottom: spacing.xl,
  },
  gridRow: {
    justifyContent: 'flex-start',
    gap: MEDIA_LIBRARY_GRID_GAP,
    marginBottom: MEDIA_LIBRARY_GRID_GAP,
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  stateTitle: {
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.text,
    textAlign: 'center',
  },
  stateText: {
    ...typography.metadataText,
    fontWeight: fontWeight.regular,
    color: colors.textSoft,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchSize,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primaryBg,
  },
  retryButtonText: textStyle('metadataText', colors.primary, fontWeight.strong),
  loadMoreWrap: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadMoreText: textStyle('metadataText', colors.textMuted, fontWeight.strong),
});
