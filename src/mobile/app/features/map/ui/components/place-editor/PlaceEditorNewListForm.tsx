import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Globe, ImagePlus, Lock, Plus, X } from 'lucide-react-native';

import { placeEditorListSelectionStyles as styles } from '@/mobile/app/features/map/ui/components/place-editor/placeEditorListSelectionStyles';
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
  if (!showNewListForm) {
    return (
      <InstantPressable style={styles.createListTrigger} onPress={() => onShowNewListFormChange(true)}>
        <Plus color={colors.primary} size={18} />
        <Text style={styles.createListTriggerText}>{tr.placeEditor.createList}</Text>
      </InstantPressable>
    );
  }

  return (
    <View style={styles.createListCard}>
      <View style={styles.createListHeader}>
        <Text style={styles.sectionTitle}>{tr.placeEditor.newList}</Text>
        <InstantPressable disabled={isCreatingList} onPress={() => onShowNewListFormChange(false)}>
          <X color={colors.textSoft} size={18} />
        </InstantPressable>
      </View>

      {newListCoverImage ? (
        <View style={styles.coverPreview}>
          <Image source={{ uri: newListCoverImage }} style={StyleSheet.absoluteFillObject} />
          <InstantPressable
            disabled={isCreatingList || isPickingListCover}
            onPress={() => onNewListCoverImageChange('')}
            style={styles.coverClear}
          >
            <X color={colors.onPrimary} size={16} />
          </InstantPressable>
        </View>
      ) : (
        <PrimaryButton
          title={tr.placeEditor.chooseCoverPhoto}
          variant="secondary"
          onPress={onPickListCover}
          loading={isPickingListCover}
          disabled={isCreatingList}
        />
      )}

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
          <Globe color={newListPublic ? colors.onPrimary : colors.textMuted} size={14} />
          <Text style={[styles.privacyText, newListPublic ? styles.privacyTextActive : null]}>
            {tr.placeEditor.publicList}
          </Text>
        </InstantPressable>
        <InstantPressable
          disabled={isCreatingList}
          style={[styles.privacyButton, !newListPublic ? styles.privateButtonActive : null]}
          onPress={() => onNewListPublicChange(false)}
        >
          <Lock color={!newListPublic ? colors.onPrimary : colors.textMuted} size={14} />
          <Text style={[styles.privacyText, !newListPublic ? styles.privacyTextActive : null]}>
            {tr.placeEditor.privateList}
          </Text>
        </InstantPressable>
      </View>

      <PrimaryButton
        title={tr.placeEditor.createListAction}
        onPress={onCreateList}
        disabled={!newListName.trim() || isPickingListCover}
        loading={isCreatingList}
      />
    </View>
  );
}
