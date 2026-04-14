import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Globe, ImagePlus, Lock, Plus, X } from 'lucide-react-native';

import { placeEditorListSelectionStyles as styles } from '@/mobile/app/features/map/ui/components/place-editor/placeEditorListSelectionStyles';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { TextField } from '@/mobile/app/shared/components/ui/TextField';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

type PlaceEditorNewListFormProps = {
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
      <Pressable style={styles.createListTrigger} onPress={() => onShowNewListFormChange(true)}>
        <Plus color={colors.primary} size={18} />
        <Text style={styles.createListTriggerText}>{tr.placeEditor.createList}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.createListCard}>
      <View style={styles.createListHeader}>
        <Text style={styles.sectionTitle}>{tr.placeEditor.newList}</Text>
        <Pressable onPress={() => onShowNewListFormChange(false)}>
          <X color={colors.textSoft} size={18} />
        </Pressable>
      </View>

      {newListCoverImage ? (
        <View style={styles.coverPreview}>
          <Image source={{ uri: newListCoverImage }} style={StyleSheet.absoluteFillObject} />
          <Pressable onPress={() => onNewListCoverImageChange('')} style={styles.coverClear}>
            <X color={colors.onPrimary} size={16} />
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.coverPicker} onPress={() => void onPickListCover()}>
          <ImagePlus color={colors.secondary} size={18} />
          <Text style={styles.coverPickerText}>{tr.placeEditor.chooseCoverPhoto}</Text>
        </Pressable>
      )}

      <TextField
        value={newListName}
        onChangeText={onNewListNameChange}
        placeholder={tr.placeEditor.listNamePlaceholder}
      />
      <TextField
        value={newListDescription}
        onChangeText={onNewListDescriptionChange}
        placeholder={tr.placeEditor.listDescriptionPlaceholder}
        multilineRows={2}
      />

      <View style={styles.privacyRow}>
        <Pressable
          style={[styles.privacyButton, newListPublic ? styles.privacyButtonActive : null]}
          onPress={() => onNewListPublicChange(true)}
        >
          <Globe color={newListPublic ? colors.onPrimary : colors.textMuted} size={14} />
          <Text style={[styles.privacyText, newListPublic ? styles.privacyTextActive : null]}>
            {tr.placeEditor.publicList}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.privacyButton, !newListPublic ? styles.privateButtonActive : null]}
          onPress={() => onNewListPublicChange(false)}
        >
          <Lock color={!newListPublic ? colors.onPrimary : colors.textMuted} size={14} />
          <Text style={[styles.privacyText, !newListPublic ? styles.privacyTextActive : null]}>
            {tr.placeEditor.privateList}
          </Text>
        </Pressable>
      </View>

      <PrimaryButton
        title={tr.placeEditor.createListAction}
        onPress={() => void onCreateList()}
        disabled={!newListName.trim()}
      />
    </View>
  );
}
