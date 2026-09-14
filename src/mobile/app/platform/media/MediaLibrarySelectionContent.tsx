import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image as ImageIcon, RefreshCcw, Settings } from 'lucide-react-native';

import { MediaLibraryAssetTile } from '@/mobile/app/platform/media/MediaLibraryAssetTile';
import type { MediaLibraryAssetTileItem } from '@/mobile/app/platform/media/mediaLibraryAssetPreparation';
import { PLACE_MEDIA_MAX_ACCEPTED_VIDEO_DURATION_SECONDS } from '@/mobile/app/platform/media/mediaConstants';
import type {
  MediaLibraryPickerAsset,
  MediaLibrarySelectionFilter,
} from '@/mobile/app/platform/media/mediaLibrarySelectionTypes';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  fontWeight,
  radius,
  touch,
  typography,
} from '@/mobile/app/shared/theme/tokens';

export const MEDIA_LIBRARY_GRID_GAP = 10;
const PAGE_SIZE = 33;
const MIN_TOUCH_SIZE = Platform.OS === 'ios' ? touch.ios : touch.android;

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
            <Text style={styles.counterChipText}>
              {tr.placeEditor.photoCounterLabel(selectedCounts.photos, remainingPhotos)}
            </Text>
          </View>
          {allowVideos ? (
            <View style={styles.counterChip}>
              <Text style={styles.counterChipText}>
                {tr.placeEditor.videoCounterLabel(selectedCounts.videos, remainingVideos)}
              </Text>
            </View>
          ) : null}
          <View style={styles.counterChipStrong}>
            <Text style={styles.counterChipStrongText}>
              {tr.placeEditor.mediaCounterLabel(selectedCounts.total, maxSelection)}
            </Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          {visibleFilters.map((key) => {
            const label = key === 'all'
              ? tr.notifications.categories.all
              : key === 'photo'
                ? tr.placeEditor.photos
                : tr.mediaPicker.videos;
            const active = filter === key;
            const disabled = disabledFilters.has(key) || isLoading || isLoadingMore;

            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: active, disabled }}
                key={key}
                disabled={disabled}
                onPress={() => onFilterChange(key)}
                style={[
                  styles.filterChip,
                  active ? styles.filterChipActive : null,
                  disabled ? styles.filterChipDisabled : null,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active ? styles.filterChipTextActive : null,
                    disabled ? styles.filterChipTextDisabled : null,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
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
            <Text style={styles.stateText}>{tr.common.loading}</Text>
          </View>
        ) : loadFailed ? (
          <View style={styles.stateWrap}>
            <ImageIcon color={colors.textSoft} size={20} />
            <Text style={styles.stateTitle}>{tr.map.searchUnavailableTitle}</Text>
            <Text style={styles.stateText}>{tr.system.connectionUnavailable}</Text>
            <Pressable
              accessibilityRole="button"
              style={styles.retryButton}
              onPress={() => void loadAssetsPage(true)}
            >
              <RefreshCcw color={colors.primary} size={12} />
              <Text style={styles.retryButtonText}>{tr.common.retry}</Text>
            </Pressable>
          </View>
        ) : permissionDenied ? (
          <View style={styles.stateWrap}>
            <ImageIcon color={colors.textSoft} size={20} />
            <Text style={styles.stateTitle}>{tr.mediaPicker.permissionTitle}</Text>
            <Text accessibilityLiveRegion="polite" style={styles.stateText}>
              {permissionCanAskAgain
                ? tr.mediaPicker.permissionDescription
                : tr.mediaPicker.permissionBlockedDescription}
            </Text>
            <Pressable
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
                <RefreshCcw color={colors.primary} size={12} />
              ) : (
                <Settings color={colors.primary} size={12} />
              )}
              <Text style={styles.retryButtonText}>
                {permissionCanAskAgain ? tr.common.retry : tr.mediaPicker.openSettings}
              </Text>
            </Pressable>
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
                  <Text style={styles.loadMoreText}>{tr.common.loading}</Text>
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
    gap: 6,
    marginTop: 10,
    marginBottom: 10,
  },
  counterChip: {
    borderRadius: radius.pill,
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  counterChipText: {
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.primary,
  },
  counterChipStrong: {
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  counterChipStrongText: {
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  filterChip: {
    minHeight: MIN_TOUCH_SIZE,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterChipActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  filterChipDisabled: {
    opacity: 0.45,
  },
  filterChipText: {
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.textMuted,
  },
  filterChipTextActive: {
    color: colors.onPrimary,
  },
  filterChipTextDisabled: {
    color: colors.textSoft,
  },
  gridContent: {
    paddingBottom: 18,
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
    gap: 8,
    paddingHorizontal: 18,
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
    gap: 6,
    minHeight: MIN_TOUCH_SIZE,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    backgroundColor: colors.primaryBg,
  },
  retryButtonText: {
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.primary,
  },
  loadMoreWrap: {
    paddingVertical: 10,
    alignItems: 'center',
    gap: 6,
  },
  loadMoreText: {
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.textMuted,
  },
});
