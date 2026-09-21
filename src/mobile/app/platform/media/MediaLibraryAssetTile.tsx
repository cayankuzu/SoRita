import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { MediaLibraryPickerAsset } from '@/mobile/app/platform/media/mediaLibrarySelectionTypes';
import { MediaThumbnailView } from '@/mobile/app/shared/components/media/MediaThumbnailView';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, fontWeight, radius, textStyle } from '@/mobile/app/shared/theme/tokens';
import { formatPlaceMediaDuration } from '@/mobile/app/shared/utils/placeMedia';

type MediaLibraryAssetTileProps = {
  asset: MediaLibraryPickerAsset;
  disabled?: boolean;
  onPress: (asset: MediaLibraryPickerAsset) => void;
  onPreviewError: (asset: MediaLibraryPickerAsset) => void;
  orderIndex: number;
  size: number;
};

export const MediaLibraryAssetTile = React.memo(function MediaLibraryAssetTile({
  asset,
  disabled = false,
  onPress,
  onPreviewError,
  orderIndex,
  size,
}: MediaLibraryAssetTileProps) {
  const isVideo = asset.mediaType === 'video';
  const isSelected = orderIndex >= 0;
  const durationLabel =
    isVideo && asset.duration > 0 ? formatPlaceMediaDuration(asset.duration * 1000) : null;
  const handlePress = React.useCallback(() => onPress(asset), [asset, onPress]);
  const handlePreviewError = React.useCallback(
    () => onPreviewError(asset),
    [asset, onPreviewError],
  );

  return (
    <Pressable
      accessibilityLabel={isVideo ? tr.common.mediaVideo : tr.common.mediaPhoto}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected, disabled }}
      disabled={disabled}
      onPress={handlePress}
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
        onPreviewError={handlePreviewError}
        style={styles.assetPreview}
      />

      {isSelected ? (
        <View style={styles.orderBadge}>
          <AppText scaleLimit="chrome" style={styles.orderBadgeText}>
            {orderIndex + 1}
          </AppText>
        </View>
      ) : null}

      {disabled ? (
        <View style={styles.disabledOverlay}>
          <AppText style={styles.disabledLabel}>{tr.mediaPicker.videoTooLongBadge}</AppText>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
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
  orderBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    minWidth: 20,
    minHeight: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkOverlay,
    paddingHorizontal: 4,
  },
  orderBadgeText: textStyle('metadataText', colors.onPrimary, fontWeight.strong),
  disabledOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mediaPickerOverlay,
    zIndex: 2,
  },
  disabledLabel: textStyle('metadataText', colors.onPrimary, fontWeight.strong),
});
