import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image as ImageIcon, X } from 'lucide-react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PlaceMedia } from '@/mobile/app/data/contracts/entities';
import { generateVideoThumbnailUri } from '@/mobile/app/platform/media/videoThumbnails';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import {
  getAndroidModalWindowProps,
  getModalContentMaxHeight,
  getModalSafeAreaPadding,
} from '@/mobile/app/shared/utils/modalLayout';

type PlaceEditorVideoThumbnailSheetProps = {
  media: PlaceMedia | null;
  onApply: (selection: { thumbnailTimeMs: number; thumbnailUrl?: string }) => void;
  onClose: () => void;
  visible: boolean;
};

export function PlaceEditorVideoThumbnailSheet({
  media,
  onApply,
  onClose,
  visible,
}: PlaceEditorVideoThumbnailSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { paddingTop, paddingBottom } = getModalSafeAreaPadding({
    topInset: insets.top,
    bottomInset: insets.bottom,
    topSpacing: Platform.OS === 'android' ? 20 : 16,
    bottomSpacing: Platform.OS === 'android' ? 24 : 16,
    minTopPadding: Platform.OS === 'android' ? 40 : 20,
    minBottomPadding: Platform.OS === 'android' ? 28 : 20,
  });
  const panelMaxHeight = getModalContentMaxHeight({
    viewportHeight: windowHeight,
    paddingTop,
    paddingBottom,
    maxHeightRatio: 0.88,
    minHeight: 420,
  });
  const player = useVideoPlayer(media?.url ?? null, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = true;
    videoPlayer.pause();
  });
  const previewPlayer = useVideoPlayer(media?.url ?? null, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = true;
    videoPlayer.pause();
  });
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [selectedTimeMs, setSelectedTimeMs] = React.useState(0);

  React.useEffect(() => {
    if (!visible || !media) {
      return;
    }

    const initialTimeMs = Math.max(0, media.thumbnailTimeMs ?? 0);
    setSelectedTimeMs(initialTimeMs);
    player.currentTime = initialTimeMs / 1000;
    player.pause();
    previewPlayer.currentTime = initialTimeMs / 1000;
    previewPlayer.pause();
  }, [media, player, previewPlayer, visible]);

  React.useEffect(() => {
    if (!visible || !media?.url) {
      return;
    }

    let lastTimeMs = Math.max(0, media.thumbnailTimeMs ?? 0);
    const intervalId = setInterval(() => {
      const nextTimeMs = Math.max(0, Math.round(player.currentTime * 1000));

      if (Math.abs(nextTimeMs - lastTimeMs) < 60) {
        return;
      }

      lastTimeMs = nextTimeMs;
      setSelectedTimeMs(nextTimeMs);
      previewPlayer.currentTime = nextTimeMs / 1000;
      previewPlayer.pause();
    }, 80);

    return () => {
      clearInterval(intervalId);
    };
  }, [media?.thumbnailTimeMs, media?.url, player, previewPlayer, visible]);

  const handleApply = React.useCallback(async () => {
    if (!media?.url || isGenerating) {
      return;
    }

    const nextSelectedTimeMs = Math.max(0, Math.round(player.currentTime * 1000));
    setIsGenerating(true);

    try {
      const thumbnailUri = await generateVideoThumbnailUri(
        media.url,
        nextSelectedTimeMs,
      );

      onApply({
        thumbnailTimeMs: nextSelectedTimeMs,
        thumbnailUrl: thumbnailUri,
      });
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, media, onApply, player]);

  return (
    <Modal
      {...getAndroidModalWindowProps({
        navigationBarTranslucent: true,
        statusBarTranslucent: true,
      })}
      visible={visible}
      transparent
      animationType="slide"
      hardwareAccelerated
      onRequestClose={isGenerating ? undefined : onClose}
      presentationStyle="overFullScreen"
    >
      <View style={[styles.overlay, { paddingTop, paddingBottom }]}>
        <Pressable disabled={isGenerating} style={styles.backdrop} onPress={onClose} />

        <View style={[styles.sheet, { maxHeight: panelMaxHeight }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Video önizleme karesi</Text>
              <Text style={styles.description}>
                Videoyu oynatıp alt çizgiden istediğin ana getir, sonra bu kareyi kapak olarak seç.
              </Text>
            </View>
            <Pressable disabled={isGenerating} onPress={onClose} style={styles.closeButton}>
              <X color={colors.textSoft} size={18} />
            </Pressable>
          </View>

          <View style={styles.playerCard}>
            <VideoView
              player={player}
              contentFit="contain"
              nativeControls
              style={styles.player}
            />
          </View>

          <View style={styles.previewSection}>
            <Text style={styles.previewLabel}>Seçili kapak görüntüsü</Text>
            {media?.url ? (
              <View style={styles.previewCard}>
                <VideoView
                  player={previewPlayer}
                  contentFit="cover"
                  nativeControls={false}
                  style={styles.previewImage}
                />
              </View>
            ) : (
              <View style={[styles.previewCard, styles.previewFallback]}>
                <ImageIcon color={colors.textSoft} size={20} />
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <Pressable
              disabled={isGenerating}
              onPress={onClose}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>İptal</Text>
            </Pressable>
            <Pressable
              disabled={isGenerating}
              onPress={() => {
                void handleApply();
              }}
              style={styles.primaryButton}
            >
              {isGenerating ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Bu kareyi kullan</Text>
              )}
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
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheet: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 5,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  description: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  playerCard: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.deepBackground,
  },
  player: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  previewSection: {
    gap: 8,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSoft,
    textTransform: 'uppercase',
  },
  previewCard: {
    width: '100%',
    maxWidth: 280,
    aspectRatio: 1,
    alignSelf: 'center',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textMuted,
  },
  primaryButton: {
    flex: 1.2,
    minHeight: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.onPrimary,
  },
});
