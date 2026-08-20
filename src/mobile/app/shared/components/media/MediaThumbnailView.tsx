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
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { colors, radius, typography } from '@/mobile/app/shared/theme/tokens';

type MediaThumbnailViewProps = {
  accessibilityLabel?: string;
  backgroundColor?: string;
  durationLabel?: string;
  fallbackToVideoPreview?: boolean;
  item: Pick<PlaceMedia, 'durationMs' | 'thumbnailTimeMs' | 'thumbnailUrl' | 'type' | 'url'>;
  onPreviewError?: () => void;
  priority?: 'high' | 'low' | 'normal';
  showDuration?: boolean;
  showPlayOverlay?: boolean;
  style?: StyleProp<ViewStyle>;
};

type VideoPreviewProps = React.ComponentProps<
  typeof import('@/mobile/app/shared/components/media/VideoPreview')['VideoPreview']
>;

function DeferredVideoPreview(props: VideoPreviewProps) {
  const { VideoPreview } = require('@/mobile/app/shared/components/media/VideoPreview') as
    typeof import('@/mobile/app/shared/components/media/VideoPreview');
  return <VideoPreview {...props} />;
}

function getPreviewUris(item: MediaThumbnailViewProps['item']) {
  const previewUri = item.type === 'video'
    ? item.thumbnailUrl
    : item.thumbnailUrl ?? item.url;

  return {
    fallbackPreviewUri: item.url !== previewUri ? item.url : null,
    previewUri,
  };
}

function getFallbackIcon(type: PlaceMedia['type']) {
  return type === 'video' ? (
    <Play color={colors.textSoft} fill={colors.textSoft} size={16} />
  ) : (
    <ImageIcon color={colors.textSoft} size={16} />
  );
}

type ThumbnailSurfaceProps = {
  accessibilityLabel?: string;
  backgroundColor: string;
  durationLabel?: string;
  fallbackIcon: React.ReactNode;
  fallbackPreviewUri: string | null;
  fallbackToVideoPreview: boolean;
  item: MediaThumbnailViewProps['item'];
  onPreviewFailed: () => void;
  onPreviewError?: () => void;
  onPreviewUriChange: (uri: string) => void;
  previewFailed: boolean;
  priority: NonNullable<MediaThumbnailViewProps['priority']>;
  resolvedPreviewUri: string | null;
  showDuration: boolean;
  showPlayOverlay: boolean;
};

function ThumbnailSurface(props: ThumbnailSurfaceProps) {
  const useVideo =
    props.item.type === 'video' &&
    props.fallbackToVideoPreview &&
    (!props.resolvedPreviewUri || props.previewFailed);

  if (useVideo) {
    return (
      <DeferredVideoPreview
        backgroundColor={props.backgroundColor}
        uri={props.item.url}
        muted
        seekTimeMs={props.item.thumbnailTimeMs}
        showPlayOverlay={props.showPlayOverlay}
        durationLabel={props.showDuration ? props.durationLabel : undefined}
        style={StyleSheet.absoluteFillObject}
      />
    );
  }

  if (!props.resolvedPreviewUri) {
    return <View style={styles.fallback}>{props.fallbackIcon}</View>;
  }

  return (
    <AppImage
      uri={props.resolvedPreviewUri}
      accessibilityLabel={props.accessibilityLabel}
      backgroundColor={props.backgroundColor}
      fallback={props.fallbackIcon}
      priority={props.priority}
      recycleKey={`${props.item.type}:${props.resolvedPreviewUri}`}
      onError={() => {
        props.onPreviewError?.();

        if (props.fallbackPreviewUri && props.resolvedPreviewUri !== props.fallbackPreviewUri) {
          props.onPreviewUriChange(props.fallbackPreviewUri);
          return;
        }

        if (props.item.type === 'video' && props.fallbackToVideoPreview) {
          props.onPreviewFailed();
        }
      }}
      style={StyleSheet.absoluteFillObject}
    />
  );
}

export function MediaThumbnailView(props: MediaThumbnailViewProps) {
  const backgroundColor = props.backgroundColor ?? colors.surfaceMuted;
  const fallbackToVideoPreview = props.fallbackToVideoPreview ?? false;
  const priority = props.priority ?? 'normal';
  const showDuration = props.showDuration ?? true;
  const showPlayOverlay = props.showPlayOverlay ?? true;
  const [previewFailed, setPreviewFailed] = React.useState(false);
  const { fallbackPreviewUri, previewUri } = getPreviewUris(props.item);
  const [resolvedPreviewUri, setResolvedPreviewUri] = React.useState<string | null>(
    previewUri ?? fallbackPreviewUri ?? null,
  );
  const shouldUseVideoSurface =
    props.item.type === 'video' && fallbackToVideoPreview && (!resolvedPreviewUri || previewFailed);

  React.useEffect(() => {
    setPreviewFailed(false);
    setResolvedPreviewUri(previewUri ?? fallbackPreviewUri ?? null);
  }, [fallbackPreviewUri, previewUri, props.item.thumbnailUrl, props.item.type, props.item.url]);
  const fallbackIcon = getFallbackIcon(props.item.type);

  return (
    <View style={[styles.container, { backgroundColor }, props.style]}>
      <ThumbnailSurface
        accessibilityLabel={props.accessibilityLabel}
        backgroundColor={backgroundColor}
        durationLabel={props.durationLabel}
        fallbackIcon={fallbackIcon}
        fallbackPreviewUri={fallbackPreviewUri}
        fallbackToVideoPreview={fallbackToVideoPreview}
        item={props.item}
        onPreviewFailed={() => setPreviewFailed(true)}
        onPreviewError={props.onPreviewError}
        onPreviewUriChange={setResolvedPreviewUri}
        previewFailed={previewFailed}
        priority={priority}
        resolvedPreviewUri={resolvedPreviewUri}
        showDuration={showDuration}
        showPlayOverlay={showPlayOverlay}
      />

      {props.item.type === 'video' && !shouldUseVideoSurface && showPlayOverlay ? (
        <View pointerEvents="none" style={styles.playOverlay}>
          <View style={styles.playBadge}>
            <Play color={colors.onPrimary} fill={colors.onPrimary} size={10} />
          </View>
        </View>
      ) : null}

      {props.item.type === 'video' && showDuration && props.durationLabel ? (
        <View pointerEvents="none" style={styles.durationBadge}>
          <Text style={styles.durationText}>{props.durationLabel}</Text>
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
    top: 4,
    right: 4,
  },
  playBadge: {
    width: 18,
    height: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkOverlay,
  },
  durationBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.darkOverlay,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  durationText: {
    ...typography.metadataText,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
