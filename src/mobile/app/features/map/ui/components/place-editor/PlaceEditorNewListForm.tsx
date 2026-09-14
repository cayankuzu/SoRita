import React from 'react';
import {
  Text,
  View,
} from 'react-native';
import { Globe, ImagePlus, Lock, Plus, X } from 'lucide-react-native';

import { placeEditorListSelectionStyles as styles } from '@/mobile/app/features/map/ui/components/place-editor/placeEditorListSelectionStyles';
import { ImageLightbox } from '@/mobile/app/shared/components/feedback/ImageLightbox';
import { MediaSelectionPreview } from '@/mobile/app/shared/components/media/MediaSelectionPreview';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
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
      <InstantPressable
        accessibilityLabel={tr.placeEditor.createList}
        accessibilityRole="button"
        accessibilityState={{ expanded: false }}
        style={styles.createListTrigger}
        onPress={() => onShowNewListFormChange(true)}
      >
        <Plus color={colors.primary} size={16} />
        <Text style={styles.createListTriggerText}>{tr.placeEditor.createList}</Text>
      </InstantPressable>
    );
  }

  return (
    <View style={styles.createListCard}>
      <View style={styles.createListHeader}>
        <Text style={styles.sectionTitle}>{tr.placeEditor.newList}</Text>
        <IconButton
          accessibilityLabel={tr.common.close}
          accessibilityState={{ disabled: isCreatingList }}
          disabled={isCreatingList}
          onPress={() => onShowNewListFormChange(false)}
          size="sm"
        >
          <X color={colors.textSoft} size={16} />
        </IconButton>
      </View>

      <View style={styles.coverPickerRow}>
        <View style={[styles.coverPicker, newListCoverImage ? styles.coverPickerSelected : null]}>
          <View style={styles.coverPickerHeader}>
            <InstantPressable
              accessibilityLabel={tr.placeEditor.chooseCoverPhoto}
              accessibilityRole="button"
              accessibilityState={{
                busy: isPickingListCover,
                disabled: isCreatingList || isPickingListCover,
                selected: Boolean(newListCoverImage),
              }}
              disabled={isCreatingList || isPickingListCover}
              onPress={onPickListCover}
              style={styles.coverPickerHeaderCopy}
            >
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
            </InstantPressable>

            {newListCoverImage ? (
              <InstantPressable
                accessibilityLabel={tr.listEditor.coverPreviewExpand}
                accessibilityRole="imagebutton"
                disabled={isCreatingList || isPickingListCover}
                onPress={() => setCoverPreviewVisible(true)}
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
        </View>

        {newListCoverImage ? (
          <IconButton
            accessibilityLabel={tr.listEditor.removeCover}
            accessibilityState={{ disabled: isCreatingList || isPickingListCover }}
            disabled={isCreatingList || isPickingListCover}
            onPress={() => onNewListCoverImageChange('')}
            size="sm"
            style={styles.coverClearInline}
            variant="inverse"
          >
            <X color={colors.onPrimary} size={14} />
          </IconButton>
        ) : null}
      </View>

      <TextField
        label={tr.placeEditor.listNameLabel}
        value={newListName}
        onChangeText={onNewListNameChange}
        placeholder={tr.placeEditor.listNamePlaceholder}
        maxLength={LIST_NAME_MAX_LENGTH}
      />
      <TextField
        label={tr.placeEditor.listDescriptionLabel}
        value={newListDescription}
        onChangeText={onNewListDescriptionChange}
        placeholder={tr.placeEditor.listDescriptionPlaceholder}
        multilineRows={2}
        maxLength={LIST_DESCRIPTION_MAX_LENGTH}
      />

      <View
        accessibilityLabel={tr.placeEditor.listPrivacyLabel}
        accessibilityRole="radiogroup"
        style={styles.privacyRow}
      >
        <InstantPressable
          accessibilityRole="radio"
          accessibilityState={{ checked: newListPublic, disabled: isCreatingList }}
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
          accessibilityRole="radio"
          accessibilityState={{ checked: !newListPublic, disabled: isCreatingList }}
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
