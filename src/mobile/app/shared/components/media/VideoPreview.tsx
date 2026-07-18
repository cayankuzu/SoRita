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
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type VideoPreviewProps = {
  autoPlay?: boolean;
  backgroundColor?: string;
  contentFit?: VideoContentFit;
  durationLabel?: string;
  loop?: boolean;
  muted?: boolean;
  nativeControls?: boolean;
  seekTimeMs?: number;
  showPlayOverlay?: boolean;
  style?: StyleProp<ViewStyle>;
  surfaceType?: SurfaceType;
  uri: string;
};

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
  seekTimeMs,
  showPlayOverlay = true,
  style,
  surfaceType,
  uri,
}: VideoPreviewProps) {
  const [resolvedUri, setResolvedUri] = React.useState<string | null>(uri);
  const player = useVideoPlayer(resolvedUri, (videoPlayer) => {
    videoPlayer.audioMixingMode = 'auto';
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
    setResolvedUri(uri);

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
        contentFit={contentFit}
        nativeControls={nativeControls}
        surfaceType={resolvedSurfaceType}
        style={StyleSheet.absoluteFillObject}
      />
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

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
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
