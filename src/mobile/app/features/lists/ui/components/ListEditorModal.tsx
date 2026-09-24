import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, useWindowDimensions, View } from 'react-native';
import { Globe, Lock, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import { ListEditorForm } from '@/mobile/app/features/lists/ui/components/ListEditorForm';
import { listEditorModalStyles as styles } from '@/mobile/app/features/lists/ui/components/listEditorModalStyles';
import { pickSingleImageFromPrompt } from '@/mobile/app/platform/media/images';
import { waitForMediaPickerTransition } from '@/mobile/app/platform/media/mediaPickerTransition';
import {
  clearPersistedListEditorDraft,
  savePersistedListEditorDraft,
  type PersistedListEditorDraft,
} from '@/mobile/app/platform/storage/listEditorDraft';
import { ConfirmActionModal } from '@/mobile/app/shared/components/feedback/ConfirmActionModal';
import { ImageLightbox } from '@/mobile/app/shared/components/feedback/ImageLightbox';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { Badge } from '@/mobile/app/shared/components/ui/Badge';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { t } from '@/mobile/app/shared/i18n';
import { useModalAnimationType } from '@/mobile/app/shared/hooks/useModalAnimationType';
import { colors, hitSlopFor, iconSize } from '@/mobile/app/shared/theme/tokens';
import {
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
import { AppModal } from '@/mobile/app/shared/components/feedback/AppModal';

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
  ownerUserId: string;
  resumeDraft?: PersistedListEditorDraft | null;
  onClose: () => void;
  onSave: (list: PlaceList) => Promise<void> | void;
};

export function ListEditorModal({
  visible,
  list,
  ownerUserId,
  resumeDraft = null,
  onClose,
  onSave,
}: ListEditorModalProps) {
  const animationType = useModalAnimationType('slide');
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPickingCover, setIsPickingCover] = useState(false);
  const isPickingCoverRef = React.useRef(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const initialStateSourceRef = React.useRef<string | null>(null);
  const initialStateSignatureRef = React.useRef<string | null>(null);
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

    setSaveError(null);

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
      void savePersistedListEditorDraft(ownerUserId, {
        coverImage,
        description,
        isPublic,
        listId: list.id,
        name,
      });
    }, 650);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [coverImage, description, isPublic, list, name, ownerUserId, visible]);

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
    if (loading || isPickingCoverRef.current) {
      return;
    }

    isPickingCoverRef.current = true;
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
      isPickingCoverRef.current = false;
      setIsPickingCover(false);
    }
  };

  const handleSave = async () => {
    if (!list || !name.trim() || loading) {
      return;
    }

    setLoading(true);
    setSaveError(null);

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
      await clearPersistedListEditorDraft(ownerUserId, list.id);
    } catch (error) {
      logger.error('list-editor', 'Failed to save list edits', error);
      setSaveError(getUserFacingErrorMessage(error, t.listEditor.saveFailed));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppModal
      animationType={animationType}
      onRequestClose={handleRequestClose}
      visible={visible && (Platform.OS !== 'ios' || !isPickingCover)}
    >
      <View
        accessibilityViewIsModal
        importantForAccessibility="yes"
        onAccessibilityEscape={handleRequestClose}
        style={[styles.overlay, { paddingTop, paddingBottom }]}
      >
        <InstantPressable
          disableFeedback
          accessible={false}
          disabled={loading}
          style={styles.backdrop}
          onPress={handleRequestClose}
        />

        <View style={[styles.panel, { maxHeight: panelMaxHeight }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <AppText accessibilityRole="header" style={styles.title}>{t.listEditor.title}</AppText>
              <AppText style={styles.subtitle}>{t.listEditor.subtitle}</AppText>
              <View style={styles.headerMetaRow}>
                <Badge
                  icon={isPublic ? Globe : Lock}
                  label={isPublic ? t.listEditor.privacyPublic : t.listEditor.privacyPrivate}
                  tone={isPublic ? 'success' : 'neutral'}
                />
              </View>
            </View>

            <InstantPressable
              accessibilityLabel={t.common.close}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading }}
              disabled={loading}
              onPress={handleRequestClose}
              hitSlop={hitSlopFor(30)}
              style={styles.closeButton}
            >
              <X color={colors.textMuted} size={iconSize.sm} />
            </InstantPressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <ListEditorForm
              coverImage={coverImage}
              description={description}
              isPublic={isPublic}
              loading={loading}
              name={name}
              onCoverPress={() => void handlePickCover()}
              onDescriptionChange={(value) =>
                setDescription(clampMultilineTextLength(value, LIST_DESCRIPTION_MAX_LENGTH))
              }
              onNameChange={(value) => setName(clampTextLength(value, LIST_NAME_MAX_LENGTH))}
              onPreviewCover={() => setCoverPreviewVisible(true)}
              onRemoveCover={() => setCoverImage('')}
              onVisibilityChange={setIsPublic}
            />
            {saveError ? (
              <InlineNotice
                description={saveError}
                title={t.listEditor.saveFailedTitle}
                tone="danger"
              />
            ) : null}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: footerPaddingBottom }]}>
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
    </AppModal>
  );
}
