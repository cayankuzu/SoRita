import React from 'react';
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showToast } from '@/mobile/app/platform/feedback/toast';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import {
  resolveMediaLibrarySelection,
  useMediaLibrarySelectionState,
} from '@/mobile/app/platform/media/mediaLibrarySelectionController';
import type {
  MediaLibraryPickerAsset,
  MediaLibrarySelectionFilter,
} from '@/mobile/app/platform/media/mediaLibrarySelectionTypes';
import { PLACE_MEDIA_MAX_ACCEPTED_VIDEO_DURATION_SECONDS } from '@/mobile/app/platform/media/mediaConstants';
import {
  MEDIA_LIBRARY_GRID_GAP,
  MediaLibrarySelectionContent,
} from '@/mobile/app/platform/media/MediaLibrarySelectionContent';
import {
  buildMediaTypeFilter,
  buildMediaLibraryAssetTileItems,
  buildPickerAssetsPage,
  buildResponsiveMediaGridLayout,
  buildSelectionCounts,
  hydratePickerAssetFromNetwork,
  type MediaLibraryAssetTileItem,
} from '@/mobile/app/platform/media/mediaLibraryAssetPreparation';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { useModalAccessibilityFocus } from '@/mobile/app/shared/hooks/useModalAccessibilityFocus';
import { useModalAnimationType } from '@/mobile/app/shared/hooks/useModalAnimationType';
import {
  colors,
  fontWeight,
  iconSize,
  minTouchSize,
  opacity,
  radius,
  spacing,
  textStyle,
} from '@/mobile/app/shared/theme/tokens';
import {
  getAndroidModalWindowProps,
  getModalSafeAreaPadding,
} from '@/mobile/app/shared/utils/modalLayout';

const PAGE_SIZE = 33;
export function MediaLibrarySelectionHost() {
  const animationType = useModalAnimationType('slide');
  const { options, requestId, visible } = useMediaLibrarySelectionState();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const assetCacheRef = React.useRef(new Map<string, MediaLibraryPickerAsset>());
  const loadRequestIdRef = React.useRef(0);
  const loadMoreInFlightRef = React.useRef(false);
  const previewRecoveryIdsRef = React.useRef(new Set<string>());
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
  const [permissionCanAskAgain, setPermissionCanAskAgain] = React.useState(true);
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

  useModalAccessibilityFocus({ accessibilityLabel: title, visible });
  const selectedAssets = React.useMemo(
    () =>
      selectedIds
        .map((id) => assetCacheRef.current.get(id))
        .filter((asset): asset is MediaLibraryPickerAsset => Boolean(asset)),
    [selectedIds],
  );
  const selectedCounts = React.useMemo(() => buildSelectionCounts(selectedAssets), [selectedAssets]);
  const assetTileItems = React.useMemo<MediaLibraryAssetTileItem[]>(
    () => buildMediaLibraryAssetTileItems(assets, selectedIds),
    [assets, selectedIds],
  );
  const { columnCount, tileSize } = React.useMemo(
    () => buildResponsiveMediaGridLayout(width, { gap: MEDIA_LIBRARY_GRID_GAP }),
    [width],
  );
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
    const available = await MediaLibrary.isAvailableAsync();

    if (!available) {
      return { canAskAgain: true, granted: false };
    }

    const currentPermission = await MediaLibrary.getPermissionsAsync(false, requestedPermissions);
    const currentGranted =
      currentPermission.granted || currentPermission.accessPrivileges === 'limited';

    if (currentGranted || !currentPermission.canAskAgain) {
      return {
        canAskAgain: currentPermission.canAskAgain,
        granted: currentGranted,
      };
    }

    const permission = await MediaLibrary.requestPermissionsAsync(false, requestedPermissions);

    return {
      canAskAgain: permission.canAskAgain,
      granted: permission.granted || permission.accessPrivileges === 'limited',
    };
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
        const permission = await ensureMediaLibraryPermission();

        if (loadRequestIdRef.current !== requestId) {
          return;
        }

        if (!permission.granted) {
          setPermissionDenied(true);
          setPermissionCanAskAgain(permission.canAskAgain);
          setLoadFailed(false);
          if (reset) {
            setAssets([]);
            setEndCursor(null);
            setHasNextPage(false);
          }
          return;
        }

        setPermissionDenied(false);
        setPermissionCanAskAgain(true);
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

        setAssets((current) => {
          const combined = reset ? nextAssets : [...current, ...nextAssets];
          return Array.from(new Map(combined.map((asset) => [asset.id, asset])).values());
        });
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
    previewRecoveryIdsRef.current.clear();
    loadRequestIdRef.current += 1;
    loadMoreInFlightRef.current = false;
    setFilter(options.initialFilter ?? 'all');
    setAssets([]);
    setEndCursor(null);
    setHasNextPage(false);
    setPermissionDenied(false);
    setPermissionCanAskAgain(true);
    setSelectedIds([]);
  }, [options.initialFilter, requestId, visible]);

  React.useEffect(() => {
    if (!visible) {
      return;
    }

    void loadAssetsPage(true);
  }, [filter, loadAssetsPage, requestId, visible]);

  React.useEffect(() => {
    if (!visible || !permissionDenied || permissionCanAskAgain) {
      return;
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void loadAssetsPage(true);
      }
    });

    return () => subscription.remove();
  }, [
    loadAssetsPage,
    permissionCanAskAgain,
    permissionDenied,
    visible,
  ]);

  const handlePreviewError = React.useCallback((asset: MediaLibraryPickerAsset) => {
    if (Platform.OS !== 'ios' || previewRecoveryIdsRef.current.has(asset.id)) {
      return;
    }

    previewRecoveryIdsRef.current.add(asset.id);
    const recoveryRequestId = loadRequestIdRef.current;
    void hydratePickerAssetFromNetwork(asset).then((hydratedAsset) => {
      if (
        hydratedAsset === asset ||
        loadRequestIdRef.current !== recoveryRequestId
      ) {
        return;
      }

      assetCacheRef.current.set(asset.id, hydratedAsset);
      setAssets((current) =>
        current.map((item) => (item.id === hydratedAsset.id ? hydratedAsset : item)),
      );
    });
  }, []);

  const handleAssetToggle = React.useCallback(
    (asset: MediaLibraryPickerAsset) => {
      setSelectedIds((current) => {
        const existingIndex = current.indexOf(asset.id);

        if (existingIndex >= 0) {
          return current.filter((id) => id !== asset.id);
        }

        if (
          asset.mediaType === 'video' &&
          asset.duration > PLACE_MEDIA_MAX_ACCEPTED_VIDEO_DURATION_SECONDS
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

  return (
    <Modal
      {...getAndroidModalWindowProps({
        statusBarTranslucent: true,
      })}
      visible={visible}
      transparent
      animationType={animationType}
      hardwareAccelerated
      onRequestClose={() => resolveMediaLibrarySelection(null)}
      presentationStyle="overFullScreen"
    >
      <View
        accessibilityViewIsModal
        importantForAccessibility="yes"
        onAccessibilityEscape={() => resolveMediaLibrarySelection(null)}
        style={[styles.overlay, { paddingTop, paddingBottom }]}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <AppText accessibilityRole="header" style={styles.title}>{title}</AppText>
              <AppText style={styles.description}>{description}</AppText>
            </View>
            <IconButton
              accessibilityLabel={tr.common.close}
              onPress={() => resolveMediaLibrarySelection(null)}
              variant="surface"
            >
              <X color={colors.textSoft} size={iconSize.sm} />
            </IconButton>
          </View>

          <MediaLibrarySelectionContent
            allowVideos={allowVideos}
            assetTileItems={assetTileItems}
            columnCount={columnCount}
            disabledFilters={disabledFilters}
            endCursor={endCursor}
            filter={filter}
            hasNextPage={hasNextPage}
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            loadAssetsPage={loadAssetsPage}
            loadFailed={loadFailed}
            maxSelection={maxSelection}
            onAssetToggle={handleAssetToggle}
            onFilterChange={setFilter}
            onPreviewError={handlePreviewError}
            permissionCanAskAgain={permissionCanAskAgain}
            permissionDenied={permissionDenied}
            remainingPhotos={remainingPhotos}
            remainingVideos={remainingVideos}
            selectedCounts={selectedCounts}
            tileSize={tileSize}
            visibleFilters={visibleFilters}
          />

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
              accessibilityRole="button"
              style={styles.footerSecondaryButton}
              onPress={() => resolveMediaLibrarySelection(null)}
            >
              <AppText style={styles.footerSecondaryButtonText}>{tr.common.cancel}</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: selectedIds.length === 0 }}
              disabled={selectedIds.length === 0}
              onPress={handleConfirm}
              style={[
                styles.footerPrimaryButton,
                selectedIds.length === 0 ? styles.footerPrimaryButtonDisabled : null,
              ]}
            >
              <AppText style={styles.footerPrimaryButtonText}>
                {selectedIds.length > 0
                  ? `${tr.placeEditor.add} (${selectedIds.length})`
                  : tr.placeEditor.add}
              </AppText>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  title: textStyle('compactTitleText', colors.text),
  description: textStyle('metadataText', colors.textMuted, fontWeight.regular),
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  footerSecondaryButton: {
    flex: 1,
    minHeight: minTouchSize,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  footerSecondaryButtonText: textStyle('metadataText', colors.textMuted, fontWeight.strong),
  footerPrimaryButton: {
    flex: 1.3,
    minHeight: minTouchSize,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  footerPrimaryButtonDisabled: {
    opacity: opacity.disabled,
  },
  footerPrimaryButtonText: textStyle('metadataText', colors.onPrimary, fontWeight.strong),
});
