import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
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
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { useModalAnimationType } from '@/mobile/app/shared/hooks/useModalAnimationType';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import {
  getAndroidModalWindowProps,
  getModalContentMaxHeight,
  getModalSafeAreaPadding,
} from '@/mobile/app/shared/utils/modalLayout';

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
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDescription}>{description}</Text>
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
    <Modal
      {...getAndroidModalWindowProps({
        navigationBarTranslucent: true,
        statusBarTranslucent: true,
      })}
      visible={visible}
      transparent
      animationType={animationType}
      hardwareAccelerated
      onRequestClose={() => resolveMediaPickerPrompt(null)}
      presentationStyle="overFullScreen"
    >
      <View
        accessibilityViewIsModal
        importantForAccessibility="yes"
        style={[styles.overlay, { paddingTop, paddingBottom }]}
      >
        <Pressable
          accessible={false}
          style={StyleSheet.absoluteFillObject}
          onPress={() => resolveMediaPickerPrompt(null)}
        />

        <View style={[styles.sheet, { maxHeight: sheetMaxHeight }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text accessibilityRole="header" style={styles.title}>{title}</Text>
              <Text style={styles.description}>{description}</Text>
            </View>

            <IconButton
              accessibilityLabel={tr.common.close}
              onPress={() => resolveMediaPickerPrompt(null)}
              variant="surface"
            >
              <X color={colors.textSoft} size={16} />
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
                icon={<Camera color={colors.primary} size={18} />}
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
                icon={<Video color={colors.primary} size={18} />}
                title={tr.mediaPicker.cameraVideo}
                onPress={() => handleResolve({ cameraCaptureMode: 'video', source: 'camera' })}
              />
            ) : null}

            {availableSources.includes('library') ? (
              <MediaPickerOptionCard
                accentColor={colors.secondary}
                backgroundColor={colors.successBg}
                description={galleryDescription}
                icon={<Images color={colors.secondary} size={18} />}
                title={tr.mediaPicker.gallery}
                onPress={() => handleResolve({ source: 'library' })}
              />
            ) : null}
          </View>

          <PrimaryButton
            title={tr.common.cancel}
            variant="secondary"
            onPress={() => resolveMediaPickerPrompt(null)}
          />
        </View>
      </View>
    </Modal>
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
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
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
    gap: 10,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  options: {
    gap: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 10,
  },
  optionCardPressed: {
    opacity: 0.92,
  },
  optionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  optionBody: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  optionDescription: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
});
