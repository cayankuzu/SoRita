import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Image as ImageIcon, Play, RefreshCcw, X } from 'lucide-react-native';
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
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import { getModalSafeAreaPadding } from '@/mobile/app/shared/utils/modalLayout';
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
  const durationLabel = isVideo ? formatPlaceMediaDuration(asset.duration * 1000) : null;

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
      {isVideo ? (
        <View style={styles.videoFallback}>
          <Play color={colors.onPrimary} fill={colors.onPrimary} size={22} />
          <Text style={styles.videoFallbackText}>Video</Text>
        </View>
      ) : (
        <Image source={{ uri: asset.uri }} resizeMethod="resize" style={styles.assetPreview} />
      )}

      {isVideo ? (
        <View style={styles.videoBadge}>
          <Play color={colors.onPrimary} fill={colors.onPrimary} size={10} />
          <Text style={styles.videoBadgeText}>{durationLabel}</Text>
        </View>
      ) : null}

      {isSelected ? (
        <View style={styles.orderBadge}>
          <Text style={styles.orderBadgeText}>{orderIndex + 1}</Text>
        </View>
      ) : null}

      {disabled ? (
        <View style={styles.disabledOverlay}>
          <Text style={styles.disabledLabel}>3 dk+</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function buildMediaTypeFilter(
  filter: MediaLibrarySelectionFilter,
  allowVideos: boolean,
): MediaLibrary.MediaTypeValue[] {
  if (filter === 'photo') {
    return [MediaLibrary.MediaType.photo];
  }

  if (filter === 'video') {
    return [MediaLibrary.MediaType.video];
  }

  return allowVideos
    ? [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video]
    : [MediaLibrary.MediaType.photo];
}

function buildSelectionCounts(selectedAssets: MediaLibraryPickerAsset[]) {
  return selectedAssets.reduce(
    (totals, asset) => {
      if (asset.mediaType === 'video') {
        totals.videos += 1;
      } else {
        totals.photos += 1;
      }

      totals.total += 1;
      return totals;
    },
    { photos: 0, total: 0, videos: 0 },
  );
}

export function MediaLibrarySelectionHost() {
  const { options, requestId, visible } = useMediaLibrarySelectionState();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const assetCacheRef = React.useRef(new Map<string, MediaLibraryPickerAsset>());
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
    topSpacing: Platform.OS === 'android' ? 12 : 16,
    bottomSpacing: Platform.OS === 'android' ? 20 : 16,
    minTopPadding: Platform.OS === 'android' ? 14 : 16,
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
      const nextFilter = buildMediaTypeFilter(filter, allowVideos);
      const after = reset ? undefined : cursor || undefined;

      if (reset) {
        setIsLoading(true);
        setLoadFailed(false);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const hasPermission = await ensureMediaLibraryPermission();

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
        const nextAssets = response.assets
          .filter((asset) => asset.mediaType === 'photo' || asset.mediaType === 'video')
          .map((asset) => ({
            creationTime: asset.creationTime,
            duration: asset.duration,
            filename: asset.filename,
            height: asset.height,
            id: asset.id,
            mediaType: asset.mediaType,
            uri: asset.uri,
            width: asset.width,
          } satisfies MediaLibraryPickerAsset));

        nextAssets.forEach((asset) => {
          assetCacheRef.current.set(asset.id, asset);
        });

        setAssets((current) => (reset ? nextAssets : [...current, ...nextAssets]));
        setEndCursor(response.endCursor || null);
        setHasNextPage(response.hasNextPage);
      } catch {
        setLoadFailed(true);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [allowVideos, ensureMediaLibraryPermission, filter],
  );

  React.useEffect(() => {
    if (!visible) {
      return;
    }

    assetCacheRef.current.clear();
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

        if (asset.mediaType === 'video' && asset.duration > 180) {
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
        disabled={item.mediaType === 'video' && item.duration > 180}
        orderIndex={selectedIds.indexOf(item.id)}
        size={tileSize}
        onPress={() => handleAssetToggle(item)}
      />
    ),
    [handleAssetToggle, selectedIds, tileSize],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      hardwareAccelerated
      navigationBarTranslucent={false}
      onRequestClose={() => resolveMediaLibrarySelection(null)}
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      <View style={[styles.overlay, { paddingTop, paddingBottom }]}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{tr.mediaPicker.mixedTitle}</Text>
              <Text style={styles.description}>{tr.placeEditor.mediaHint}</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={() => resolveMediaLibrarySelection(null)}>
              <X color={colors.textSoft} size={18} />
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
            {([
              { key: 'all', label: tr.notifications.categories.all },
              { key: 'photo', label: tr.placeEditor.photos },
              ...(allowVideos ? [{ key: 'video', label: 'Videolar' }] : []),
            ] as Array<{ key: MediaLibrarySelectionFilter; label: string }>).map((item) => {
              const active = filter === item.key;

              return (
                <Pressable
                  key={item.key}
                  onPress={() => setFilter(item.key)}
                  style={[styles.filterChip, active ? styles.filterChipActive : null]}
                >
                  <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
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
              <ImageIcon color={colors.textSoft} size={22} />
              <Text style={styles.stateTitle}>{tr.map.searchUnavailableTitle}</Text>
              <Text style={styles.stateText}>{tr.system.connectionUnavailable}</Text>
              <Pressable style={styles.retryButton} onPress={() => void loadAssetsPage(true)}>
                <RefreshCcw color={colors.primary} size={14} />
                <Text style={styles.retryButtonText}>{tr.common.retry}</Text>
              </Pressable>
            </View>
          ) : permissionDenied ? (
            <View style={styles.stateWrap}>
              <ImageIcon color={colors.textSoft} size={22} />
              <Text style={styles.stateTitle}>{tr.mediaPicker.permissionTitle}</Text>
              <Text style={styles.stateText}>{tr.mediaPicker.permissionDescription}</Text>
              <Pressable style={styles.retryButton} onPress={() => void loadAssetsPage(true)}>
                <RefreshCcw color={colors.primary} size={14} />
                <Text style={styles.retryButtonText}>{tr.common.retry}</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={assets}
              keyExtractor={(item) => item.id}
              initialNumToRender={PAGE_SIZE}
              maxToRenderPerBatch={PAGE_SIZE}
              numColumns={3}
              renderItem={renderTile}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.gridContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  description: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  counterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    marginBottom: 12,
  },
  counterChip: {
    borderRadius: radius.pill,
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  counterChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  counterChipStrong: {
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  counterChipStrongText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    minHeight: 34,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
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
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  filterChipTextActive: {
    color: colors.onPrimary,
  },
  gridContent: {
    paddingBottom: 24,
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
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  assetTileSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  assetTileDisabled: {
    opacity: 0.72,
  },
  assetPreview: {
    width: '100%',
    height: '100%',
  },
  videoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1e293b',
  },
  videoFallbackText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.onPrimary,
  },
  orderBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkOverlay,
    paddingHorizontal: 6,
  },
  orderBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.onPrimary,
  },
  videoBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.darkOverlay,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  videoBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.onPrimary,
  },
  disabledOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
  },
  disabledLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.onPrimary,
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  stateTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  stateText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSoft,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 38,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    backgroundColor: colors.primaryBg,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  loadMoreWrap: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
  },
  footerSecondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  footerSecondaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textMuted,
  },
  footerPrimaryButton: {
    flex: 1.3,
    minHeight: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  footerPrimaryButtonDisabled: {
    opacity: 0.45,
  },
  footerPrimaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.onPrimary,
  },
});
