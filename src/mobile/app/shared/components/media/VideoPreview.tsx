import React from 'react';
import {
  AppState,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Play } from 'lucide-react-native';
import {
  VideoView,
  useVideoPlayer,
  type SurfaceType,
  type VideoContentFit,
} from 'expo-video';

import { logger } from '@/mobile/app/platform/feedback/logger';
import { resolveStorageAssetUrl } from '@/mobile/app/platform/supabase/media';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import {
  VIDEO_FORWARD_BUFFER_SECONDS,
  VIDEO_START_BUFFER_SECONDS,
} from '@/mobile/app/shared/performance/budgets';
import { colors, radius, typography } from '@/mobile/app/shared/theme/tokens';

type VideoPreviewProps = {
  autoPlay?: boolean;
  backgroundColor?: string;
  contentFit?: VideoContentFit;
  durationLabel?: string;
  loop?: boolean;
  muted?: boolean;
  nativeControls?: boolean;
  posterUri?: string;
  seekTimeMs?: number;
  showPlayOverlay?: boolean;
  style?: StyleProp<ViewStyle>;
  surfaceType?: SurfaceType;
  uri: string;
};

function inferVideoContentType(uri: string) {
  return /\.m3u8(?:$|[?#])/i.test(uri) ? ('hls' as const) : ('progressive' as const);
}

function runVideoPlayerOperation(label: string, operation: () => unknown) {
  try {
    const result = operation();

    if (
      result &&
      typeof result === 'object' &&
      'catch' in result &&
      typeof (result as Promise<unknown>).catch === 'function'
    ) {
      void (result as Promise<unknown>).catch((error) => {
        logger.debug('video-preview', `Ignored ${label} on released video player`, error);
      });
    }
  } catch (error) {
    logger.debug('video-preview', `Ignored ${label} on released video player`, error);
  }
}

export function VideoPreview({
  autoPlay = false,
  backgroundColor = colors.surfaceMuted,
  contentFit = 'cover',
  durationLabel,
  loop = false,
  muted = false,
  nativeControls = false,
  posterUri,
  seekTimeMs,
  showPlayOverlay = true,
  style,
  surfaceType,
  uri,
}: VideoPreviewProps) {
  const [hasRenderedFirstFrame, setHasRenderedFirstFrame] = React.useState(false);
  const [resolvedUri, setResolvedUri] = React.useState<string | null>(null);
  const videoSource = React.useMemo(
    () => resolvedUri
      ? {
          contentType: inferVideoContentType(resolvedUri),
          uri: resolvedUri,
          useCaching: true,
        }
      : null,
    [resolvedUri],
  );
  const player = useVideoPlayer(videoSource, (videoPlayer) => {
    videoPlayer.audioMixingMode = 'auto';
    videoPlayer.bufferOptions = {
      minBufferForPlayback: VIDEO_START_BUFFER_SECONDS,
      preferredForwardBufferDuration: VIDEO_FORWARD_BUFFER_SECONDS,
      prioritizeTimeOverSizeThreshold: true,
    };
    videoPlayer.loop = loop;
    videoPlayer.muted = muted;

    if (autoPlay) {
      runVideoPlayerOperation('play', () => videoPlayer.play());
      return;
    }

    runVideoPlayerOperation('pause', () => videoPlayer.pause());
  });

  React.useEffect(() => {
    let cancelled = false;
    setHasRenderedFirstFrame(false);
    setResolvedUri(null);

    void resolveStorageAssetUrl(uri)
      .then((nextUri) => {
        if (!cancelled) {
          setResolvedUri(nextUri);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedUri(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [uri]);

  React.useEffect(() => {
    runVideoPlayerOperation('configure', () => {
      player.audioMixingMode = 'auto';
      player.loop = loop;
      player.muted = muted;
    });

    if (typeof seekTimeMs === 'number') {
      runVideoPlayerOperation('seek', () => {
        player.currentTime = Math.max(0, seekTimeMs) / 1000;
      });
    }

    if (autoPlay) {
      runVideoPlayerOperation('play', () => player.play());
      return;
    }

    runVideoPlayerOperation('pause', () => player.pause());
  }, [autoPlay, loop, muted, player, seekTimeMs]);

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        runVideoPlayerOperation('pause', () => player.pause());
      }
    });

    return () => {
      subscription.remove();
      runVideoPlayerOperation('pause', () => player.pause());
    };
  }, [player]);

  const resolvedSurfaceType =
    surfaceType ?? (Platform.OS === 'android' ? 'textureView' : undefined);

  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      <VideoView
        player={player}
        allowsVideoFrameAnalysis={false}
        contentFit={contentFit}
        nativeControls={nativeControls}
        onFirstFrameRender={() => setHasRenderedFirstFrame(true)}
        surfaceType={resolvedSurfaceType}
        style={StyleSheet.absoluteFillObject}
        useExoShutter={false}
      />
      {posterUri && !hasRenderedFirstFrame ? (
        <AppImage
          uri={posterUri}
          backgroundColor={backgroundColor}
          priority="high"
          resizeMode={contentFit === 'contain' ? 'contain' : 'cover'}
          showLoader={false}
          style={StyleSheet.absoluteFillObject}
          transition={0}
        />
      ) : null}
      {showPlayOverlay && !nativeControls ? (
        <View pointerEvents="none" style={styles.playOverlay}>
          <View style={styles.playBadge}>
            <Play color={colors.onPrimary} fill={colors.onPrimary} size={10} />
          </View>
        </View>
      ) : null}
      {durationLabel ? (
        <View pointerEvents="none" style={styles.durationBadge}>
          <Text style={styles.durationText}>{durationLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

export const videoPreviewInternals = { inferVideoContentType };

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
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
