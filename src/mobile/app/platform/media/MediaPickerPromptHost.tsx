import React from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Camera, Images, Video, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  resolveMediaPickerPrompt,
  useMediaPickerPromptState,
} from '@/mobile/app/platform/media/mediaPickerPromptController';
import type {
  CameraCaptureMode,
  MediaPickerPromptSelection,
} from '@/mobile/app/platform/media/mediaPickerTypes';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { useModalAccessibilityFocus } from '@/mobile/app/shared/hooks/useModalAccessibilityFocus';
import { useModalAnimationType } from '@/mobile/app/shared/hooks/useModalAnimationType';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  fontWeight,
  iconSize,
  opacity,
  radius,
  spacing,
  textStyle,
} from '@/mobile/app/shared/theme/tokens';
import {
  getModalContentMaxHeight,
  getModalSafeAreaPadding,
} from '@/mobile/app/shared/utils/modalLayout';
import { AppModal } from '@/mobile/app/shared/components/feedback/AppModal';

type MediaPickerOptionCardProps = {
  accentColor: string;
  backgroundColor: string;
  description: string;
  icon: React.ReactNode;
  onPress: () => void;
  title: string;
};

function MediaPickerOptionCard({
  accentColor,
  backgroundColor,
  description,
  icon,
  onPress,
  title,
}: MediaPickerOptionCardProps) {
  return (
    <InstantPressable
      accessibilityHint={description}
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionCard,
        {
          backgroundColor,
          borderColor: accentColor,
        },
        pressed ? styles.optionCardPressed : null,
      ]}
    >
      <View style={styles.optionIconWrap}>{icon}</View>
      <View style={styles.optionBody}>
        <AppText style={styles.optionTitle}>{title}</AppText>
        <AppText style={styles.optionDescription}>{description}</AppText>
      </View>
    </InstantPressable>
  );
}

export function MediaPickerPromptHost() {
  const animationType = useModalAnimationType('fade');
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { options, requestId, visible } = useMediaPickerPromptState();
  const [saveToGallery, setSaveToGallery] = React.useState(true);
  const { paddingTop, paddingBottom } = getModalSafeAreaPadding({
    topInset: insets.top,
    bottomInset: insets.bottom,
    topSpacing: Platform.OS === 'android' ? 16 : 20,
    bottomSpacing: Platform.OS === 'android' ? 18 : 12,
    minTopPadding: Platform.OS === 'android' ? 20 : 20,
    minBottomPadding: Platform.OS === 'android' ? 44 : 12,
  });
  const sheetMaxHeight = getModalContentMaxHeight({
    viewportHeight: windowHeight,
    paddingTop,
    paddingBottom,
    maxHeightRatio: 0.88,
    minHeight: 276,
  });
  // The sheet meets the bottom edge and keeps the system bar's inset inside
  // it; padding the overlay instead left a band of dimmed screen under it.
  const sheetBottomPadding = insets.bottom + spacing.md;
  const availableSources = React.useMemo(
    () => options.availableSources || ['camera', 'library'],
    [options.availableSources],
  );
  const allowMultiple = Boolean(options.allowMultiple && availableSources.includes('library'));
  const allowVideos = Boolean(options.allowVideos);
  const cameraCaptureModes = React.useMemo<CameraCaptureMode[]>(
    () =>
      availableSources.includes('camera')
        ? options.cameraCaptureModes ?? (allowVideos ? ['photo', 'video'] : ['photo'])
        : [],
    [allowVideos, availableSources, options.cameraCaptureModes],
  );
  const hasDedicatedVideoCaptureOption = cameraCaptureModes.includes('video');
  const title = allowVideos ? tr.mediaPicker.mixedTitle : tr.mediaPicker.title;

  useModalAccessibilityFocus({ accessibilityLabel: title, visible });

  const description = allowVideos
    ? allowMultiple
      ? tr.mediaPicker.multiMediaDescription
      : tr.mediaPicker.mediaDescription
    : allowMultiple
      ? tr.mediaPicker.multiDescription
      : tr.mediaPicker.description;
  const galleryDescription = allowVideos
    ? allowMultiple
      ? tr.mediaPicker.galleryMixedMultiDescription
      : tr.mediaPicker.galleryMixedDescription
    : allowMultiple
      ? tr.mediaPicker.galleryMultiDescription
      : tr.mediaPicker.galleryDescription;

  React.useEffect(() => {
    if (!visible) {
      return;
    }

    setSaveToGallery(options.saveToGalleryDefault ?? true);
  }, [options.saveToGalleryDefault, requestId, visible]);

  const handleResolve = React.useCallback(
    (nextSelection: Omit<MediaPickerPromptSelection, 'saveToGallery'>) => {
      const selection: MediaPickerPromptSelection = {
        ...nextSelection,
        saveToGallery,
      };

      resolveMediaPickerPrompt(selection);
    },
    [saveToGallery],
  );

  return (
    <AppModal
      animationType={animationType}
      onRequestClose={() => resolveMediaPickerPrompt(null)}
      visible={visible}
    >
      <View
        accessibilityViewIsModal
        importantForAccessibility="yes"
        onAccessibilityEscape={() => resolveMediaPickerPrompt(null)}
        style={[styles.overlay, { paddingTop }]}
      >
        <InstantPressable
          disableFeedback
          accessible={false}
          style={StyleSheet.absoluteFillObject}
          onPress={() => resolveMediaPickerPrompt(null)}
        />

        <View style={[styles.sheet, { maxHeight: sheetMaxHeight, paddingBottom: sheetBottomPadding }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <AppText accessibilityRole="header" style={styles.title}>{title}</AppText>
              <AppText style={styles.description}>{description}</AppText>
            </View>

            <IconButton
              accessibilityLabel={tr.common.close}
              onPress={() => resolveMediaPickerPrompt(null)}
              variant="surface"
            >
              <X color={colors.textSoft} size={iconSize.sm} />
            </IconButton>
          </View>

          <View style={styles.options}>
            {cameraCaptureModes.includes('photo') ? (
              <MediaPickerOptionCard
                accentColor={colors.primary}
                backgroundColor={colors.primaryBg}
                description={
                  hasDedicatedVideoCaptureOption
                    ? tr.mediaPicker.cameraPhotoDescription
                    : allowVideos
                      ? tr.mediaPicker.cameraMixedDescription
                      : tr.mediaPicker.cameraDescription
                }
                icon={<Camera color={colors.primary} size={iconSize.md} />}
                title={
                  hasDedicatedVideoCaptureOption
                    ? tr.mediaPicker.cameraPhoto
                    : tr.mediaPicker.camera
                }
                onPress={() => handleResolve({ cameraCaptureMode: 'photo', source: 'camera' })}
              />
            ) : null}

            {cameraCaptureModes.includes('video') ? (
              <MediaPickerOptionCard
                accentColor={colors.primary}
                backgroundColor={colors.primaryBg}
                description={tr.mediaPicker.cameraVideoDescription}
                icon={<Video color={colors.primary} size={iconSize.md} />}
                title={tr.mediaPicker.cameraVideo}
                onPress={() => handleResolve({ cameraCaptureMode: 'video', source: 'camera' })}
              />
            ) : null}

            {availableSources.includes('library') ? (
              <MediaPickerOptionCard
                accentColor={colors.secondary}
                backgroundColor={colors.successBg}
                description={galleryDescription}
                icon={<Images color={colors.secondary} size={iconSize.md} />}
                title={tr.mediaPicker.gallery}
                onPress={() => handleResolve({ source: 'library' })}
              />
            ) : null}
          </View>
          {/* Closed by the X, the back button or a tap outside, like every
              other sheet; a second "İptal" under the choices did the same. */}
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    width: '100%',
    maxWidth: 684,
    maxHeight: '88%',
    alignSelf: 'center',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBorder,
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
  title: textStyle('section', colors.text),
  description: textStyle('compactBodyText', colors.textMuted),
  options: {
    gap: spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.card,
  },
  optionCardPressed: {
    opacity: opacity.pressed,
  },
  optionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  optionBody: {
    flex: 1,
    gap: spacing.xxs,
  },
  optionTitle: textStyle('bodyText', colors.text, fontWeight.strong),
  optionDescription: textStyle('metadataText', colors.textMuted, fontWeight.regular),
});
