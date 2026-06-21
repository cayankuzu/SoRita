import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Camera, Images, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  resolveMediaPickerPrompt,
  useMediaPickerPromptState,
} from '@/mobile/app/platform/media/mediaPickerPromptController';
import type {
  MediaPickerPromptSelection,
  PickedImageSource,
} from '@/mobile/app/platform/media/mediaPickerTypes';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import { getModalSafeAreaPadding } from '@/mobile/app/shared/utils/modalLayout';

type MediaPickerOptionCardProps = {
  description: string;
  onPress: (source: PickedImageSource) => void;
  source: PickedImageSource;
  title: string;
  tone: 'camera' | 'gallery';
};

function MediaPickerOptionCard({
  description,
  onPress,
  source,
  title,
  tone,
}: MediaPickerOptionCardProps) {
  const palette =
    tone === 'camera'
      ? {
          accent: colors.primary,
          background: colors.primaryBg,
          icon: <Camera color={colors.primary} size={20} />,
        }
      : {
          accent: colors.secondary,
          background: colors.successBg,
          icon: <Images color={colors.secondary} size={20} />,
        };

  return (
    <InstantPressable
      onPress={() => onPress(source)}
      style={({ pressed }) => [
        styles.optionCard,
        {
          backgroundColor: palette.background,
          borderColor: palette.accent,
        },
        pressed ? styles.optionCardPressed : null,
      ]}
    >
      <View style={styles.optionIconWrap}>{palette.icon}</View>
      <View style={styles.optionBody}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDescription}>{description}</Text>
      </View>
    </InstantPressable>
  );
}

export function MediaPickerPromptHost() {
  const insets = useSafeAreaInsets();
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
  const availableSources = options.availableSources || ['camera', 'library'];
  const allowMultiple = Boolean(options.allowMultiple && availableSources.includes('library'));
  const allowVideos = Boolean(options.allowVideos);
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
    (source: PickedImageSource) => {
      const selection: MediaPickerPromptSelection = {
        saveToGallery,
        source,
      };

      resolveMediaPickerPrompt(selection);
    },
    [saveToGallery],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      hardwareAccelerated
      navigationBarTranslucent
      onRequestClose={() => resolveMediaPickerPrompt(null)}
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      <View style={[styles.overlay, { paddingTop, paddingBottom }]}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={() => resolveMediaPickerPrompt(null)}
        />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.description}>{description}</Text>
            </View>

            <InstantPressable
              onPress={() => resolveMediaPickerPrompt(null)}
              style={styles.closeButton}
            >
              <X color={colors.textSoft} size={18} />
            </InstantPressable>
          </View>

          <View style={styles.options}>
            {availableSources.includes('camera') ? (
              <MediaPickerOptionCard
                source="camera"
                title={tr.mediaPicker.camera}
                description={
                  allowVideos
                    ? tr.mediaPicker.cameraMixedDescription
                    : tr.mediaPicker.cameraDescription
                }
                tone="camera"
                onPress={handleResolve}
              />
            ) : null}

            {availableSources.includes('library') ? (
              <MediaPickerOptionCard
                source="library"
                title={tr.mediaPicker.gallery}
                description={galleryDescription}
                tone="gallery"
                onPress={handleResolve}
              />
            ) : null}
          </View>

          <View style={styles.preferenceCard}>
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceTitle}>{tr.mediaPicker.saveToGalleryTitle}</Text>
              <Text style={styles.preferenceDescription}>
                {tr.mediaPicker.saveToGalleryDescription}
              </Text>
            </View>
            <Switch
              value={saveToGallery}
              onValueChange={setSaveToGallery}
              thumbColor={Platform.OS === 'android' ? colors.onPrimary : undefined}
              trackColor={{ false: colors.cardBorder, true: colors.primary }}
            />
          </View>

          <View style={styles.footerNote}>
            <Text style={styles.footerNoteText}>{tr.mediaPicker.footerNote}</Text>
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
    maxWidth: 760,
    maxHeight: '88%',
    alignSelf: 'center',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 16,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
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
  options: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
  },
  optionCardPressed: {
    opacity: 0.92,
  },
  optionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  optionBody: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  optionDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  preferenceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  preferenceCopy: {
    flex: 1,
    gap: 4,
  },
  preferenceTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  preferenceDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSoft,
  },
  footerNote: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  footerNoteText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSoft,
  },
});
