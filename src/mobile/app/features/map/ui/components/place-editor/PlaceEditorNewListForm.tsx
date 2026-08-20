import React from 'react';
import {
  Text,
  View,
} from 'react-native';
import { Globe, ImagePlus, Lock, Plus, X } from 'lucide-react-native';

import { placeEditorListSelectionStyles as styles } from '@/mobile/app/features/map/ui/components/place-editor/placeEditorListSelectionStyles';
import { ImageLightbox } from '@/mobile/app/shared/components/feedback/ImageLightbox';
import { MediaSelectionPreview } from '@/mobile/app/shared/components/media/MediaSelectionPreview';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { TextField } from '@/mobile/app/shared/components/ui/TextField';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import {
  LIST_DESCRIPTION_MAX_LENGTH,
  LIST_NAME_MAX_LENGTH,
} from '@/mobile/app/shared/validation/contentLimits';

type PlaceEditorNewListFormProps = {
  isCreatingList: boolean;
  isPickingListCover: boolean;
  newListCoverImage: string;
  newListDescription: string;
  newListName: string;
  newListPublic: boolean;
  showNewListForm: boolean;
  onCreateList: () => void | Promise<void>;
  onNewListCoverImageChange: (value: string) => void;
  onNewListDescriptionChange: (value: string) => void;
  onNewListNameChange: (value: string) => void;
  onNewListPublicChange: (value: boolean) => void;
  onPickListCover: () => void | Promise<void>;
  onShowNewListFormChange: (value: boolean) => void;
};

export function PlaceEditorNewListForm({
  isCreatingList,
  isPickingListCover,
  newListCoverImage,
  newListDescription,
  newListName,
  newListPublic,
  showNewListForm,
  onCreateList,
  onNewListCoverImageChange,
  onNewListDescriptionChange,
  onNewListNameChange,
  onNewListPublicChange,
  onPickListCover,
  onShowNewListFormChange,
}: PlaceEditorNewListFormProps) {
  const [coverPreviewVisible, setCoverPreviewVisible] = React.useState(false);

  React.useEffect(() => {
    if (!newListCoverImage) {
      setCoverPreviewVisible(false);
    }
  }, [newListCoverImage]);

  if (!showNewListForm) {
    return (
      <InstantPressable style={styles.createListTrigger} onPress={() => onShowNewListFormChange(true)}>
        <Plus color={colors.primary} size={16} />
        <Text style={styles.createListTriggerText}>{tr.placeEditor.createList}</Text>
      </InstantPressable>
    );
  }

  return (
    <View style={styles.createListCard}>
      <View style={styles.createListHeader}>
        <Text style={styles.sectionTitle}>{tr.placeEditor.newList}</Text>
        <InstantPressable
          accessibilityLabel={tr.common.close}
          accessibilityState={{ disabled: isCreatingList }}
          disabled={isCreatingList}
          onPress={() => onShowNewListFormChange(false)}
        >
          <X color={colors.textSoft} size={16} />
        </InstantPressable>
      </View>

      <View style={styles.coverPickerRow}>
        <InstantPressable
          disabled={isCreatingList}
          onPress={onPickListCover}
          style={[styles.coverPicker, newListCoverImage ? styles.coverPickerSelected : null]}
        >
          <View style={styles.coverPickerHeader}>
            <View style={styles.coverPickerHeaderCopy}>
              <View style={styles.coverPickerIconWrap}>
                <ImagePlus color={colors.secondary} size={16} />
              </View>
              <View style={styles.coverPickerBody}>
                <Text style={styles.coverPickerTitle}>
                  {newListCoverImage
                    ? tr.placeEditor.newListCoverSelected
                    : tr.placeEditor.chooseCoverPhoto}
                </Text>
                <Text style={styles.coverPickerHint}>
                  {newListCoverImage
                    ? tr.placeEditor.newListCoverChangeHint
                    : tr.placeEditor.newListCoverUsageHint}
                </Text>
              </View>
            </View>

            {newListCoverImage ? (
              <InstantPressable
              accessibilityLabel={tr.listEditor.coverPreviewExpand}
                accessibilityRole="imagebutton"
                disabled={isCreatingList || isPickingListCover}
                onPress={(event) => {
                  event.stopPropagation?.();
                  setCoverPreviewVisible(true);
                }}
                style={styles.selectionBadge}
              >
                <Text style={styles.selectionBadgeText}>{tr.common.previewTitle}</Text>
              </InstantPressable>
            ) : null}
          </View>

          <MediaSelectionPreview
            accessibilityLabel={tr.listEditor.newCoverPreview}
            uri={newListCoverImage}
            variant="list-cover"
          />
        </InstantPressable>

        {newListCoverImage ? (
          <InstantPressable
            accessibilityLabel={tr.listEditor.removeCover}
            accessibilityState={{ disabled: isCreatingList || isPickingListCover }}
            disabled={isCreatingList || isPickingListCover}
            onPress={() => onNewListCoverImageChange('')}
            style={styles.coverClearInline}
          >
            <X color={colors.onPrimary} size={14} />
          </InstantPressable>
        ) : null}
      </View>

      <TextField
        value={newListName}
        onChangeText={onNewListNameChange}
        placeholder={tr.placeEditor.listNamePlaceholder}
        maxLength={LIST_NAME_MAX_LENGTH}
      />
      <TextField
        value={newListDescription}
        onChangeText={onNewListDescriptionChange}
        placeholder={tr.placeEditor.listDescriptionPlaceholder}
        multilineRows={2}
        maxLength={LIST_DESCRIPTION_MAX_LENGTH}
      />

      <View style={styles.privacyRow}>
        <InstantPressable
          disabled={isCreatingList}
          style={[styles.privacyButton, newListPublic ? styles.privacyButtonActive : null]}
          onPress={() => onNewListPublicChange(true)}
        >
          <Globe color={newListPublic ? colors.primary : colors.textMuted} size={12} />
          <Text style={[styles.privacyText, newListPublic ? styles.privacyTextActive : null]}>
            {tr.placeEditor.publicList}
          </Text>
        </InstantPressable>
        <InstantPressable
          disabled={isCreatingList}
          style={[styles.privacyButton, !newListPublic ? styles.privateButtonActive : null]}
          onPress={() => onNewListPublicChange(false)}
        >
          <Lock color={!newListPublic ? colors.primary : colors.textMuted} size={12} />
          <Text style={[styles.privacyText, !newListPublic ? styles.privacyTextActive : null]}>
            {tr.placeEditor.privateList}
          </Text>
        </InstantPressable>
      </View>

      <PrimaryButton
        hapticFeedback="success"
        title={tr.placeEditor.createListAction}
        onPress={onCreateList}
        disabled={!newListName.trim() || isPickingListCover}
        loading={isCreatingList}
      />

      {coverPreviewVisible && newListCoverImage ? (
        <ImageLightbox
          uri={newListCoverImage}
          onClose={() => setCoverPreviewVisible(false)}
        />
      ) : null}
    </View>
  );
}
