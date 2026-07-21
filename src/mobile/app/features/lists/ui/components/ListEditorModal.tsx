import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Globe, ImagePlus, Lock, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import { pickSingleImageFromPrompt } from '@/mobile/app/platform/media/images';
import { waitForMediaPickerTransition } from '@/mobile/app/platform/media/mediaPickerTransition';
import {
  clearPersistedListEditorDraft,
  savePersistedListEditorDraft,
  type PersistedListEditorDraft,
} from '@/mobile/app/platform/storage/listEditorDraft';
import { ConfirmActionModal } from '@/mobile/app/shared/components/feedback/ConfirmActionModal';
import { ImageLightbox } from '@/mobile/app/shared/components/feedback/ImageLightbox';
import { MediaSelectionPreview } from '@/mobile/app/shared/components/media/MediaSelectionPreview';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { t } from '@/mobile/app/shared/i18n';
import { TextField } from '@/mobile/app/shared/components/ui/TextField';
import { colors, radius, typography } from '@/mobile/app/shared/theme/tokens';
import {
  getAndroidModalWindowProps,
  getModalContentMaxHeight,
  getModalSafeAreaPadding,
} from '@/mobile/app/shared/utils/modalLayout';
import { dismissKeyboardAndRunAfterInteractions } from '@/mobile/app/shared/utils/interaction';
import {
  LIST_DESCRIPTION_MAX_LENGTH,
  LIST_NAME_MAX_LENGTH,
  clampMultilineTextLength,
  clampTextLength,
  trimPreservingLineBreaks,
} from '@/mobile/app/shared/validation/contentLimits';

const DISCARD_LIST_EDITOR_CONFIRMATION = {
  cancelLabel: t.common.returnToEditing,
  confirmLabel: t.common.cancelAction,
  description: t.listDetail.editorDiscardDescription,
  title: t.listDetail.editorDiscardTitle,
} as const;

function serializeListEditorState(state: {
  coverImage?: string;
  description: string;
  isPublic: boolean;
  name: string;
}) {
  return JSON.stringify({
    ...state,
    coverImage: state.coverImage || '',
  });
}

type ListEditorModalProps = {
  visible: boolean;
  list: PlaceList | null;
  resumeDraft?: PersistedListEditorDraft | null;
  onClose: () => void;
  onSave: (list: PlaceList) => Promise<void> | void;
};

export function ListEditorModal({
  visible,
  list,
  resumeDraft = null,
  onClose,
  onSave,
}: ListEditorModalProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { paddingTop, paddingBottom } = getModalSafeAreaPadding({
    topInset: insets.top,
    bottomInset: insets.bottom,
    topSpacing: 20,
    bottomSpacing: 12,
    minBottomPadding: Platform.OS === 'android' ? 28 : 12,
  });
  const panelMaxHeight = getModalContentMaxHeight({
    viewportHeight: windowHeight,
    paddingTop,
    paddingBottom,
    maxHeightRatio: 0.86,
    minHeight: 310,
  });
  const footerPaddingBottom = Platform.OS === 'android' ? 20 : 18;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<string | undefined>();
  const [coverPreviewVisible, setCoverPreviewVisible] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isPickingCover, setIsPickingCover] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const initialStateSourceRef = React.useRef<string | null>(null);
  const initialStateSignatureRef = React.useRef<string | null>(null);
  const nameCount = `${name.trim().length}/${LIST_NAME_MAX_LENGTH}`;
  const descriptionCount = `${description.trim().length}/${LIST_DESCRIPTION_MAX_LENGTH}`;
  const initialStateSource = list
    ? resumeDraft?.listId === list.id
      ? `draft:${list.id}`
      : `list:${list.id}`
    : null;
  const currentStateSignature = serializeListEditorState({
    coverImage,
    description,
    isPublic,
    name,
  });
  const isDirty =
    visible &&
    Boolean(list) &&
    initialStateSourceRef.current === initialStateSource &&
    initialStateSignatureRef.current != null &&
    currentStateSignature !== initialStateSignatureRef.current;

  useEffect(() => {
    if (!visible || !list) {
      return;
    }

    if (resumeDraft?.listId === list.id) {
      setName(resumeDraft.name);
      setDescription(resumeDraft.description);
      setCoverImage(resumeDraft.coverImage);
      setIsPublic(resumeDraft.isPublic);
      return;
    }

    setName(list.name);
    setDescription(list.description || '');
    setCoverImage(list.coverImage);
    setIsPublic(list.isPublic);
  }, [list, resumeDraft, visible]);

  useEffect(() => {
    if (!visible || !list) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void savePersistedListEditorDraft({
        coverImage,
        description,
        isPublic,
        listId: list.id,
        name,
      });
    }, 160);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [coverImage, description, isPublic, list, name, visible]);

  useEffect(() => {
    if (!visible || !coverImage) {
      setCoverPreviewVisible(false);
    }
  }, [coverImage, visible]);

  useEffect(() => {
    if (!visible || !list || !initialStateSource) {
      initialStateSourceRef.current = null;
      initialStateSignatureRef.current = null;
      setShowDiscardConfirm(false);
      return;
    }

    if (initialStateSourceRef.current === initialStateSource) {
      return;
    }

    initialStateSourceRef.current = initialStateSource;
    initialStateSignatureRef.current = serializeListEditorState({
      coverImage:
        resumeDraft?.listId === list.id ? resumeDraft.coverImage : list.coverImage,
      description:
        resumeDraft?.listId === list.id ? resumeDraft.description : list.description || '',
      isPublic:
        resumeDraft?.listId === list.id ? resumeDraft.isPublic : list.isPublic,
      name: resumeDraft?.listId === list.id ? resumeDraft.name : list.name,
    });
  }, [initialStateSource, list, resumeDraft, visible]);

  const handleRequestClose = () => {
    if (loading) {
      return;
    }

    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }

    onClose();
  };

  const handlePickCover = async () => {
    if (loading || isPickingCover) {
      return;
    }

    setIsPickingCover(true);

    try {
      await waitForMediaPickerTransition();

      const uri = await pickSingleImageFromPrompt({
        cropAspect: [16, 9],
        cropShape: 'rectangle',
      });

      if (uri) {
        setCoverImage(uri);
      }
    } finally {
      await waitForMediaPickerTransition();
      setIsPickingCover(false);
    }
  };

  const handleSave = async () => {
    if (!list || !name.trim() || loading) {
      return;
    }

    setLoading(true);

    try {
      await onSave({
        ...list,
        name: clampTextLength(name, LIST_NAME_MAX_LENGTH).trim(),
        description:
          trimPreservingLineBreaks(
            clampMultilineTextLength(description, LIST_DESCRIPTION_MAX_LENGTH),
          ) || undefined,
        coverImage,
        isPublic,
        updatedAt: new Date().toISOString(),
      });
      await clearPersistedListEditorDraft(list.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      {...getAndroidModalWindowProps({
        navigationBarTranslucent: true,
        statusBarTranslucent: true,
      })}
      visible={visible && (Platform.OS !== 'ios' || !isPickingCover)}
      transparent
      animationType="slide"
      hardwareAccelerated
      onRequestClose={handleRequestClose}
      presentationStyle="overFullScreen"
    >
      <View style={[styles.overlay, { paddingTop, paddingBottom }]}>
        <Pressable disabled={loading} style={styles.backdrop} onPress={handleRequestClose} />

        <View style={[styles.panel, { maxHeight: panelMaxHeight }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{t.listEditor.title}</Text>
              <Text style={styles.subtitle}>{t.listEditor.subtitle}</Text>
              <View style={styles.headerMetaRow}>
                <View
                  style={[
                    styles.visibilityChip,
                    isPublic ? styles.visibilityChipPublic : styles.visibilityChipPrivate,
                  ]}
                >
                  {isPublic ? (
                    <Globe color={colors.secondary} size={12} />
                  ) : (
                    <Lock color={colors.visibilityPrivate} size={12} />
                  )}
                  <Text
                    style={[
                      styles.visibilityChipText,
                      isPublic ? styles.visibilityChipTextPublic : styles.visibilityChipTextPrivate,
                    ]}
                  >
                    {isPublic ? t.listEditor.privacyPublic : t.listEditor.privacyPrivate}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.headerActions}>
              <Pressable disabled={loading} onPress={handleRequestClose} style={styles.cancelButton} accessibilityLabel={t.common.cancel} accessibilityRole="button">
                <Text style={styles.cancelButtonText}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable disabled={loading} onPress={handleRequestClose} style={styles.closeButton} accessibilityLabel={t.common.close} accessibilityRole="button">
                <X color={colors.textMuted} size={16} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t.listEditor.coverTitle}</Text>
                <Text style={styles.sectionHint}>{t.listEditor.coverVisibilityHint}</Text>
              </View>

              <View style={styles.coverPickerRow}>
                <Pressable
                  disabled={loading}
                  style={[styles.coverPicker, coverImage ? styles.coverPickerSelected : null]}
                  onPress={() => void handlePickCover()}
                >
                  <View style={styles.coverPickerHeader}>
                    <View style={styles.coverPickerHeaderCopy}>
                      <View style={styles.coverPickerIconWrap}>
                        <ImagePlus color={colors.secondary} size={16} />
                      </View>
                      <View style={styles.coverPickerBody}>
                        <Text style={styles.coverPickerText}>
                          {coverImage ? t.listEditor.changeCover : t.listEditor.chooseCover}
                        </Text>
                        <Text style={styles.coverPickerHint}>
                          {coverImage
                            ? t.listEditor.coverSelectedHint
                            : t.listEditor.coverUsageHint}
                        </Text>
                      </View>
                    </View>

                    {coverImage ? (
                      <Pressable
                        accessibilityLabel={t.listEditor.coverPreviewExpand}
                        accessibilityRole="imagebutton"
                        disabled={loading}
                        onPress={(event) => {
                          event.stopPropagation?.();
                          setCoverPreviewVisible(true);
                        }}
                        style={styles.selectionBadge}
                      >
                        <Text style={styles.selectionBadgeText}>{t.common.previewTitle}</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <MediaSelectionPreview
                    accessibilityLabel={t.listEditor.coverPreview}
                    uri={coverImage}
                    variant="list-cover"
                  />
                </Pressable>

                {coverImage ? (
                  <Pressable
                    accessibilityLabel={t.listEditor.removeCover}
                    accessibilityRole="button"
                    disabled={loading}
                    hitSlop={9}
                    onPress={() => setCoverImage('')}
                    style={styles.coverClearButton}
                  >
                    <X color={colors.onPrimary} size={14} />
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t.listEditor.basicsTitle}</Text>
                <Text style={styles.sectionHint}>{t.listEditor.basicsHint}</Text>
              </View>
              <TextField
                label={t.listEditor.titleLabel}
                value={name}
                onChangeText={(value) => setName(clampTextLength(value, LIST_NAME_MAX_LENGTH))}
                placeholder={t.listEditor.titlePlaceholder}
                maxLength={LIST_NAME_MAX_LENGTH}
              />
              <Text style={styles.fieldCount}>{nameCount}</Text>

              <TextField
                label={t.listEditor.descriptionLabel}
                value={description}
                onChangeText={(value) =>
                  setDescription(clampMultilineTextLength(value, LIST_DESCRIPTION_MAX_LENGTH))
                }
                placeholder={t.listEditor.descriptionPlaceholder}
                multilineRows={3}
                maxLength={LIST_DESCRIPTION_MAX_LENGTH}
              />
              <Text style={styles.fieldCount}>{descriptionCount}</Text>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t.listEditor.privacyTitle}</Text>
                <Text style={styles.sectionHint}>{t.listEditor.privacyHint}</Text>
              </View>
              <View style={styles.privacyRow}>
                <Pressable
                  style={[styles.privacyButton, isPublic ? styles.privacyButtonActive : null]}
                  disabled={loading}
                  onPress={() => setIsPublic(true)}
                >
                  <Globe color={isPublic ? colors.secondary : colors.textMuted} size={14} />
                  <View style={styles.privacyButtonBody}>
                    <Text
                      style={[
                        styles.privacyText,
                        isPublic ? styles.privacyTextActivePublic : null,
                      ]}
                    >
                      {t.listEditor.privacyPublic}
                    </Text>
                    <Text
                      style={[
                        styles.privacyCaption,
                        isPublic ? styles.privacyCaptionActivePublic : null,
                      ]}
                    >
                      {t.listEditor.privacyPublicDescription}
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  style={[styles.privacyButton, !isPublic ? styles.privateButtonActive : null]}
                  disabled={loading}
                  onPress={() => setIsPublic(false)}
                >
                  <Lock color={!isPublic ? colors.primary : colors.textMuted} size={14} />
                  <View style={styles.privacyButtonBody}>
                    <Text
                      style={[
                        styles.privacyText,
                        !isPublic ? styles.privacyTextActivePrivate : null,
                      ]}
                    >
                      {t.listEditor.privacyPrivate}
                    </Text>
                    <Text
                      style={[
                        styles.privacyCaption,
                        !isPublic ? styles.privacyCaptionActivePrivate : null,
                      ]}
                    >
                      {t.listEditor.privacyPrivateDescription}
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: footerPaddingBottom }]}>
            <PrimaryButton
              title={t.listEditor.cancel}
              variant="secondary"
              onPress={handleRequestClose}
              disabled={loading}
              style={styles.footerButton}
            />
            <PrimaryButton
              title={t.listEditor.save}
              onPress={handleSave}
              disabled={!name.trim()}
              loading={loading}
              style={styles.footerButton}
            />
          </View>
        </View>
      </View>

      {coverPreviewVisible && coverImage ? (
        <ImageLightbox
          uri={coverImage}
          onClose={() => setCoverPreviewVisible(false)}
        />
      ) : null}
      {showDiscardConfirm ? (
        <ConfirmActionModal
          visible
          title={DISCARD_LIST_EDITOR_CONFIRMATION.title}
          description={DISCARD_LIST_EDITOR_CONFIRMATION.description}
          cancelLabel={DISCARD_LIST_EDITOR_CONFIRMATION.cancelLabel}
          confirmLabel={DISCARD_LIST_EDITOR_CONFIRMATION.confirmLabel}
          confirmVariant="danger"
          onClose={() => setShowDiscardConfirm(false)}
          onConfirm={() => {
            setShowDiscardConfirm(false);
            dismissKeyboardAndRunAfterInteractions(onClose);
          }}
        />
      ) : null}
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
  panel: {
    width: '100%',
    maxWidth: 648,
    alignSelf: 'center',
    maxHeight: '86%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBorder,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  headerText: {
    flex: 1,
  },
  headerMetaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSoft,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cancelButton: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  content: {
    gap: 14,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  sectionCard: {
    gap: 10,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  sectionHint: {
    flexShrink: 1,
    textAlign: 'right',
    ...typography.metadataText,
    color: colors.textSoft,
  },
  visibilityChip: {
    minHeight: 28,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
  },
  visibilityChipPublic: {
    backgroundColor: colors.successBg,
    borderColor: colors.successBorder,
  },
  visibilityChipPrivate: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderStrong,
  },
  visibilityChipText: {
    ...typography.metadataText,
    fontWeight: '700',
  },
  visibilityChipTextPublic: {
    color: colors.secondary,
  },
  visibilityChipTextPrivate: {
    color: colors.visibilityPrivate,
  },
  coverPickerRow: {
    width: '100%',
    gap: 8,
  },
  coverClearButton: {
    alignSelf: 'flex-end',
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkOverlay,
  },
  coverPicker: {
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.secondary,
    backgroundColor: colors.successBg,
    gap: 10,
    padding: 10,
  },
  coverPickerSelected: {
    backgroundColor: colors.surface,
  },
  coverPickerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  coverPickerHeaderCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  coverPickerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  coverPickerBody: {
    flex: 1,
    gap: 3,
  },
  coverPickerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.secondary,
  },
  coverPickerHint: {
    ...typography.metadataText,
    color: colors.textMuted,
  },
  selectionBadge: {
    minHeight: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  selectionBadgeText: {
    ...typography.metadataText,
    fontWeight: '700',
    color: colors.textMuted,
  },
  fieldCount: {
    marginTop: -4,
    alignSelf: 'flex-end',
    ...typography.metadataText,
    color: colors.textSoft,
  },
  privacyRow: {
    gap: 8,
  },
  privacyButton: {
    minHeight: 64,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.surfaceMuted,
  },
  privacyButtonActive: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.infoBorder,
  },
  privateButtonActive: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.infoBorder,
  },
  privacyButtonBody: {
    flex: 1,
    gap: 4,
  },
  privacyText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  privacyTextActivePublic: {
    color: colors.primary,
  },
  privacyTextActivePrivate: {
    color: colors.primary,
  },
  privacyCaption: {
    ...typography.metadataText,
    color: colors.textMuted,
  },
  privacyCaptionActivePublic: {
    color: colors.primaryDark,
  },
  privacyCaptionActivePrivate: {
    color: colors.primaryDark,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  footerButton: {
    flex: 1,
  },
});
