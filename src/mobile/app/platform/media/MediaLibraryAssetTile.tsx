import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { MediaLibraryPickerAsset } from '@/mobile/app/platform/media/mediaLibrarySelectionTypes';
import { MediaThumbnailView } from '@/mobile/app/shared/components/media/MediaThumbnailView';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { Badge } from '@/mobile/app/shared/components/ui/Badge';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  fontWeight,
  radius,
  spacing,
  textStyle,
  zIndex,
} from '@/mobile/app/shared/theme/tokens';
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
    <InstantPressable
      accessibilityLabel={isVideo ? tr.common.mediaVideo : tr.common.mediaPhoto}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected, disabled }}
      disabled={disabled}
      // Tiles sit a few dp apart; slop would let a tap near an edge pick the neighbour.
      hitSlop={0}
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
        <View pointerEvents="none" style={styles.orderBadge}>
          <Badge label={String(orderIndex + 1)} numeric tone="overlay" />
        </View>
      ) : null}

      {disabled ? (
        <View style={styles.disabledOverlay}>
          <AppText style={styles.disabledLabel}>{tr.mediaPicker.videoTooLongBadge}</AppText>
        </View>
      ) : null}
    </InstantPressable>
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
    top: spacing.sm,
    left: spacing.sm,
  },
  disabledOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.scrim,
    zIndex: zIndex.overlay,
  },
  disabledLabel: textStyle('metadataText', colors.onPrimary, fontWeight.strong),
});
