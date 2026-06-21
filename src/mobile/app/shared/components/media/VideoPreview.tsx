import React from 'react';
import {
  Platform,
  Pressable,
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

import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type VideoPreviewProps = {
  autoPlay?: boolean;
  contentFit?: VideoContentFit;
  durationLabel?: string;
  loop?: boolean;
  muted?: boolean;
  nativeControls?: boolean;
  showPlayOverlay?: boolean;
  style?: StyleProp<ViewStyle>;
  surfaceType?: SurfaceType;
  uri: string;
};

export function VideoPreview({
  autoPlay = false,
  contentFit = 'cover',
  durationLabel,
  loop = false,
  muted = false,
  nativeControls = false,
  showPlayOverlay = true,
  style,
  surfaceType,
  uri,
}: VideoPreviewProps) {
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.audioMixingMode = 'auto';
    videoPlayer.loop = loop;
    videoPlayer.muted = muted;

    if (autoPlay) {
      videoPlayer.play();
      return;
    }

    videoPlayer.pause();
  });

  React.useEffect(() => {
    player.audioMixingMode = 'auto';
    player.loop = loop;
    player.muted = muted;

    if (autoPlay) {
      player.play();
      return;
    }

    player.pause();
  }, [autoPlay, loop, muted, player]);

  const resolvedSurfaceType =
    surfaceType ?? (Platform.OS === 'android' ? 'textureView' : undefined);

  return (
    <View style={[styles.container, style]}>
      <VideoView
        player={player}
        contentFit={contentFit}
        nativeControls={nativeControls}
        surfaceType={resolvedSurfaceType}
        style={StyleSheet.absoluteFillObject}
      />
      {showPlayOverlay && !nativeControls ? (
        <Pressable pointerEvents="none" style={styles.playOverlay}>
          <View style={styles.playBadge}>
            <Play color={colors.onPrimary} fill={colors.onPrimary} size={18} />
          </View>
        </Pressable>
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
    backgroundColor: colors.surfaceMuted,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
