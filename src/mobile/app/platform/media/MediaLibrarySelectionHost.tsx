import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Image as ImageIcon, RefreshCcw, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showToast } from '@/mobile/app/platform/feedback/toast';
import {
  resolveMediaLibrarySelection,
  useMediaLibrarySelectionState,
} from '@/mobile/app/platform/media/mediaLibrarySelectionController';
import type {
  MediaLibraryPickerAsset,
  MediaLibrarySelectionFilter,
} from '@/mobile/app/platform/media/mediaLibrarySelectionTypes';
import { PLACE_MEDIA_MAX_VIDEO_DURATION_SECONDS } from '@/mobile/app/platform/media/mediaConstants';
import {
  buildMediaTypeFilter,
  buildPickerAssetsPage,
  buildSelectionCounts,
} from '@/mobile/app/platform/media/mediaLibraryAssetPreparation';
import { MediaThumbnailView } from '@/mobile/app/shared/components/media/MediaThumbnailView';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius, typography } from '@/mobile/app/shared/theme/tokens';
import {
  getAndroidModalWindowProps,
  getModalSafeAreaPadding,
} from '@/mobile/app/shared/utils/modalLayout';
import { formatPlaceMediaDuration } from '@/mobile/app/shared/utils/placeMedia';

const PAGE_SIZE = 33;
const GRID_GAP = 10;

type MediaAssetTileProps = {
  asset: MediaLibraryPickerAsset;
  disabled?: boolean;
  onPress: () => void;
  orderIndex: number;
  size: number;
};

function MediaAssetTile({ asset, disabled = false, onPress, orderIndex, size }: MediaAssetTileProps) {
  const isVideo = asset.mediaType === 'video';
  const isSelected = orderIndex >= 0;
  const durationLabel =
    isVideo && asset.duration > 0 ? formatPlaceMediaDuration(asset.duration * 1000) : null;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.assetTile,
        { height: size, width: size },
        isSelected ? styles.assetTileSelected : null,
        disabled ? styles.assetTileDisabled : null,
      ]}
    >
      <MediaThumbnailView
        backgroundColor="transparent"
        item={{
          durationMs: isVideo && asset.duration > 0 ? Math.round(asset.duration * 1000) : undefined,
          thumbnailTimeMs: isVideo ? 0 : undefined,
          thumbnailUrl: asset.previewUri,
          type: isVideo ? 'video' : 'photo',
          url: asset.uri,
        }}
        durationLabel={durationLabel ?? undefined}
        fallbackToVideoPreview
        style={styles.assetPreview}
      />

      {isSelected ? (
        <View style={styles.orderBadge}>
          <Text style={styles.orderBadgeText}>{orderIndex + 1}</Text>
        </View>
      ) : null}

      {disabled ? (
        <View style={styles.disabledOverlay}>
          <Text style={styles.disabledLabel}>{tr.mediaPicker.videoTooLongBadge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function MediaLibrarySelectionHost() {
  const { options, requestId, visible } = useMediaLibrarySelectionState();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const assetCacheRef = React.useRef(new Map<string, MediaLibraryPickerAsset>());
  const loadRequestIdRef = React.useRef(0);
  const loadMoreInFlightRef = React.useRef(false);
  const [filter, setFilter] = React.useState<MediaLibrarySelectionFilter>(
    options.initialFilter ?? 'all',
  );
  const [assets, setAssets] = React.useState<MediaLibraryPickerAsset[]>([]);
  const [endCursor, setEndCursor] = React.useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [permissionDenied, setPermissionDenied] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const allowVideos = Boolean(options.allowVideos);
  const maxSelection = Math.max(1, options.maxSelection ?? 1);
  const remainingPhotos = options.remainingPhotos ?? Number.POSITIVE_INFINITY;
  const remainingVideos = allowVideos ? options.remainingVideos ?? Number.POSITIVE_INFINITY : 0;
  const disabledFilters = React.useMemo(
    () => new Set(options.disabledFilters ?? []),
    [options.disabledFilters],
  );
  const visibleFilters = React.useMemo<MediaLibrarySelectionFilter[]>(() => {
    if (options.visibleFilters && options.visibleFilters.length > 0) {
      return options.visibleFilters;
    }

    return allowVideos ? ['all', 'photo', 'video'] : ['all', 'photo'];
  }, [allowVideos, options.visibleFilters]);
  const title = allowVideos ? tr.mediaPicker.mixedTitle : tr.mediaPicker.title;
  const description = allowVideos ? tr.placeEditor.mediaHint : tr.mediaPicker.galleryDescription;
  const selectedAssets = React.useMemo(
    () =>
      selectedIds
        .map((id) => assetCacheRef.current.get(id))
        .filter((asset): asset is MediaLibraryPickerAsset => Boolean(asset)),
    [selectedIds],
  );
  const selectedCounts = React.useMemo(() => buildSelectionCounts(selectedAssets), [selectedAssets]);
  const tileSize = React.useMemo(() => {
    const horizontalPadding = 20;
    return Math.floor((width - horizontalPadding * 2 - GRID_GAP * 2) / 3);
  }, [width]);
  const { paddingTop, paddingBottom } = getModalSafeAreaPadding({
    topInset: insets.top,
    bottomInset: insets.bottom,
    topSpacing: Platform.OS === 'android' ? 18 : 16,
    bottomSpacing: Platform.OS === 'android' ? 20 : 16,
    minTopPadding: Platform.OS === 'android' ? 44 : 16,
    minBottomPadding: Platform.OS === 'android' ? 24 : 16,
  });
  const requestedPermissions = React.useMemo<MediaLibrary.GranularPermission[]>(
    () => (allowVideos ? ['photo', 'video'] : ['photo']),
    [allowVideos],
  );

  const ensureMediaLibraryPermission = React.useCallback(async () => {
    const permission = await MediaLibrary.requestPermissionsAsync(false, requestedPermissions);
    return permission.granted;
  }, [requestedPermissions]);

  const loadAssetsPage = React.useCallback(
    async (reset: boolean, cursor?: string | null) => {
      if (!reset && loadMoreInFlightRef.current) {
        return;
      }

      const requestId = loadRequestIdRef.current + 1;
      loadRequestIdRef.current = requestId;
      const nextFilter = buildMediaTypeFilter(filter, allowVideos);
      const after = reset ? undefined : cursor || undefined;

      if (reset) {
        setIsLoading(true);
        setLoadFailed(false);
      } else {
        loadMoreInFlightRef.current = true;
        setIsLoadingMore(true);
      }

      try {
        const hasPermission = await ensureMediaLibraryPermission();

        if (loadRequestIdRef.current !== requestId) {
          return;
        }

        if (!hasPermission) {
          setPermissionDenied(true);
          setLoadFailed(false);
          if (reset) {
            setAssets([]);
            setEndCursor(null);
            setHasNextPage(false);
          }
          return;
        }

        setPermissionDenied(false);
        const response = await MediaLibrary.getAssetsAsync({
          after,
          first: PAGE_SIZE,
          mediaType: nextFilter,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });
        const nextAssets = await buildPickerAssetsPage(response.assets);

        if (loadRequestIdRef.current !== requestId) {
          return;
        }

        nextAssets.forEach((asset) => {
          assetCacheRef.current.set(asset.id, asset);
        });

        setAssets((current) => (reset ? nextAssets : [...current, ...nextAssets]));
        setEndCursor(response.endCursor || null);
        setHasNextPage(response.hasNextPage);
      } catch {
        if (loadRequestIdRef.current === requestId) {
          setLoadFailed(true);
        }
      } finally {
        if (loadRequestIdRef.current === requestId) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }

        if (!reset) {
          loadMoreInFlightRef.current = false;
        }
      }
    },
    [allowVideos, ensureMediaLibraryPermission, filter],
  );

  React.useEffect(() => {
    if (!visible) {
      return;
    }

    assetCacheRef.current.clear();
    loadRequestIdRef.current += 1;
    loadMoreInFlightRef.current = false;
    setFilter(options.initialFilter ?? 'all');
    setAssets([]);
    setEndCursor(null);
    setHasNextPage(false);
    setPermissionDenied(false);
    setSelectedIds([]);
  }, [options.initialFilter, requestId, visible]);

  React.useEffect(() => {
    if (!visible) {
      return;
    }

    void loadAssetsPage(true);
  }, [filter, loadAssetsPage, requestId, visible]);

  const handleAssetToggle = React.useCallback(
    (asset: MediaLibraryPickerAsset) => {
      setSelectedIds((current) => {
        const existingIndex = current.indexOf(asset.id);

        if (existingIndex >= 0) {
          return current.filter((id) => id !== asset.id);
        }

        if (
          asset.mediaType === 'video' &&
          asset.duration > PLACE_MEDIA_MAX_VIDEO_DURATION_SECONDS
        ) {
          showToast(tr.placeEditor.videoDurationLimitExceeded, 'error');
          return current;
        }

        if (current.length >= maxSelection) {
          showToast(tr.placeEditor.mediaLimitNotice(maxSelection), 'error');
          return current;
        }

        const nextAssets = [
          ...current
            .map((id) => assetCacheRef.current.get(id))
            .filter((item): item is MediaLibraryPickerAsset => Boolean(item)),
          asset,
        ];
        const counts = buildSelectionCounts(nextAssets);

        if (asset.mediaType === 'video' && counts.videos > remainingVideos) {
          showToast(tr.placeEditor.videoLimitNotice(remainingVideos), 'error');
          return current;
        }

        if (asset.mediaType !== 'video' && counts.photos > remainingPhotos) {
          showToast(tr.placeEditor.photoLimitNotice(remainingPhotos), 'error');
          return current;
        }

        return [...current, asset.id];
      });
    },
    [maxSelection, remainingPhotos, remainingVideos],
  );

  const handleConfirm = React.useCallback(() => {
    resolveMediaLibrarySelection(selectedAssets);
  }, [selectedAssets]);

  const renderTile = React.useCallback(
    ({ item }: { item: MediaLibraryPickerAsset }) => (
      <MediaAssetTile
        asset={item}
        disabled={
          item.mediaType === 'video' &&
          item.duration > PLACE_MEDIA_MAX_VIDEO_DURATION_SECONDS
        }
        orderIndex={selectedIds.indexOf(item.id)}
        size={tileSize}
        onPress={() => handleAssetToggle(item)}
      />
    ),
    [handleAssetToggle, selectedIds, tileSize],
  );

  return (
    <Modal
      {...getAndroidModalWindowProps({
        statusBarTranslucent: true,
      })}
      visible={visible}
      transparent
      animationType="slide"
      hardwareAccelerated
      onRequestClose={() => resolveMediaLibrarySelection(null)}
      presentationStyle="overFullScreen"
    >
      <View style={[styles.overlay, { paddingTop, paddingBottom }]}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.description}>{description}</Text>
            </View>
            <Pressable
              accessibilityLabel={tr.common.close}
              accessibilityRole="button"
              style={styles.closeButton}
              onPress={() => resolveMediaLibrarySelection(null)}
            >
              <X color={colors.textSoft} size={16} />
            </Pressable>
          </View>

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
              const item = {
                key,
                label:
                  key === 'all'
                    ? tr.notifications.categories.all
                    : key === 'photo'
                      ? tr.placeEditor.photos
                      : tr.mediaPicker.videos,
              };
              const active = filter === item.key;
              const disabled = disabledFilters.has(item.key) || isLoading || isLoadingMore;

              return (
                <Pressable
                  key={item.key}
                  disabled={disabled}
                  onPress={() => setFilter(item.key)}
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
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {isLoading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.stateText}>{tr.common.loading}</Text>
            </View>
          ) : loadFailed ? (
            <View style={styles.stateWrap}>
              <ImageIcon color={colors.textSoft} size={20} />
              <Text style={styles.stateTitle}>{tr.map.searchUnavailableTitle}</Text>
              <Text style={styles.stateText}>{tr.system.connectionUnavailable}</Text>
              <Pressable style={styles.retryButton} onPress={() => void loadAssetsPage(true)}>
                <RefreshCcw color={colors.primary} size={12} />
                <Text style={styles.retryButtonText}>{tr.common.retry}</Text>
              </Pressable>
            </View>
          ) : permissionDenied ? (
            <View style={styles.stateWrap}>
              <ImageIcon color={colors.textSoft} size={20} />
              <Text style={styles.stateTitle}>{tr.mediaPicker.permissionTitle}</Text>
              <Text style={styles.stateText}>{tr.mediaPicker.permissionDescription}</Text>
              <Pressable style={styles.retryButton} onPress={() => void loadAssetsPage(true)}>
                <RefreshCcw color={colors.primary} size={12} />
                <Text style={styles.retryButtonText}>{tr.common.retry}</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={assets}
              keyExtractor={(item) => item.id}
              initialNumToRender={PAGE_SIZE}
              maxToRenderPerBatch={9}
              numColumns={3}
              renderItem={renderTile}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.gridContent}
              nestedScrollEnabled
              removeClippedSubviews={Platform.OS === 'android'}
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
                  <View style={styles.loadMoreWrap}>
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text style={styles.loadMoreText}>{tr.common.loading}</Text>
                  </View>
                ) : null
              }
            />
          )}

          <View
            style={[
              styles.footer,
              {
                paddingBottom:
                  Platform.OS === 'android'
                    ? Math.max(insets.bottom, 28)
                    : Math.max(insets.bottom, 8),
              },
            ]}
          >
            <Pressable
              style={styles.footerSecondaryButton}
              onPress={() => resolveMediaLibrarySelection(null)}
            >
              <Text style={styles.footerSecondaryButtonText}>{tr.common.cancel}</Text>
            </Pressable>
            <Pressable
              disabled={selectedIds.length === 0}
              onPress={handleConfirm}
              style={[
                styles.footerPrimaryButton,
                selectedIds.length === 0 ? styles.footerPrimaryButtonDisabled : null,
              ]}
            >
              <Text style={styles.footerPrimaryButtonText}>
                {selectedIds.length > 0
                  ? `${tr.placeEditor.add} (${selectedIds.length})`
                  : tr.placeEditor.add}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sheet: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
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
    fontWeight: '700',
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
    fontWeight: '700',
    color: colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  filterChip: {
    minHeight: 34,
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
    fontSize: 12,
    fontWeight: '700',
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
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  assetTile: {
    position: 'relative',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  assetTileSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  assetTileDisabled: {
    borderColor: colors.cardBorder,
  },
  assetPreview: {
    width: '100%',
    height: '100%',
  },
  assetPreviewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  orderBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkOverlay,
    paddingHorizontal: 4,
  },
  orderBadgeText: {
    ...typography.metadataText,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  disabledOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mediaPickerOverlay,
    zIndex: 2,
  },
  disabledLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  stateTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  stateText: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSoft,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    backgroundColor: colors.primaryBg,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  loadMoreWrap: {
    paddingVertical: 10,
    alignItems: 'center',
    gap: 6,
  },
  loadMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
  },
  footerSecondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  footerSecondaryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  footerPrimaryButton: {
    flex: 1.3,
    minHeight: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  footerPrimaryButtonDisabled: {
    opacity: 0.45,
  },
  footerPrimaryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
