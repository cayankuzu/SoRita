import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image as ImageIcon, Play } from 'lucide-react-native';

import type { PlaceMedia } from '@/mobile/app/contracts/placeMedia';
import { VideoPreview } from '@/mobile/app/shared/components/media/VideoPreview';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type MediaThumbnailViewProps = {
  accessibilityLabel?: string;
  backgroundColor?: string;
  durationLabel?: string;
  fallbackToVideoPreview?: boolean;
  item: Pick<PlaceMedia, 'durationMs' | 'thumbnailTimeMs' | 'thumbnailUrl' | 'type' | 'url'>;
  showDuration?: boolean;
  showPlayOverlay?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function MediaThumbnailView({
  accessibilityLabel,
  backgroundColor = colors.surfaceMuted,
  durationLabel,
  fallbackToVideoPreview = false,
  item,
  showDuration = true,
  showPlayOverlay = true,
  style,
}: MediaThumbnailViewProps) {
  const [previewFailed, setPreviewFailed] = React.useState(false);
  const previewUri = item.type === 'video' ? item.thumbnailUrl : item.thumbnailUrl ?? item.url;
  const fallbackPreviewUri = item.url !== previewUri ? item.url : null;
  const [resolvedPreviewUri, setResolvedPreviewUri] = React.useState<string | null>(
    previewUri ?? fallbackPreviewUri ?? null,
  );
  const shouldUseVideoSurface =
    item.type === 'video' && fallbackToVideoPreview && (!resolvedPreviewUri || previewFailed);

  React.useEffect(() => {
    setPreviewFailed(false);
    setResolvedPreviewUri(previewUri ?? fallbackPreviewUri ?? null);
  }, [fallbackPreviewUri, item.type, item.url, item.thumbnailUrl, previewUri]);

  const fallbackIcon =
    item.type === 'video' ? (
      <Play color={colors.textSoft} fill={colors.textSoft} size={18} />
    ) : (
      <ImageIcon color={colors.textSoft} size={18} />
    );

  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      {shouldUseVideoSurface ? (
        <VideoPreview
          backgroundColor={backgroundColor}
          uri={item.url}
          muted
          seekTimeMs={item.thumbnailTimeMs}
          showPlayOverlay={showPlayOverlay}
          durationLabel={showDuration ? durationLabel : undefined}
          style={StyleSheet.absoluteFillObject}
        />
      ) : resolvedPreviewUri ? (
        <AppImage
          uri={resolvedPreviewUri}
          accessibilityLabel={accessibilityLabel}
          backgroundColor={backgroundColor}
          fallback={fallbackIcon}
          onError={() => {
            if (fallbackPreviewUri && resolvedPreviewUri !== fallbackPreviewUri) {
              setResolvedPreviewUri(fallbackPreviewUri);
              return;
            }

            if (item.type === 'video' && fallbackToVideoPreview) {
              setPreviewFailed(true);
            }
          }}
          style={StyleSheet.absoluteFillObject}
        />
      ) : (
        <View style={styles.fallback}>
          {fallbackIcon}
        </View>
      )}

      {item.type === 'video' && !shouldUseVideoSurface && showPlayOverlay ? (
        <View pointerEvents="none" style={styles.playOverlay}>
          <View style={styles.playBadge}>
            <Play color={colors.onPrimary} fill={colors.onPrimary} size={10} />
          </View>
        </View>
      ) : null}

      {item.type === 'video' && showDuration && durationLabel ? (
        <View pointerEvents="none" style={styles.durationBadge}>
          <Text style={styles.durationText}>{durationLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  playBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkOverlay,
  },
  durationBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.darkOverlay,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.onPrimary,
  },
});
