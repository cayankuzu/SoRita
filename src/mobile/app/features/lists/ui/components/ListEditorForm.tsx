import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Globe, ImagePlus, Lock, X } from 'lucide-react-native';

import { listEditorModalStyles as styles } from '@/mobile/app/features/lists/ui/components/listEditorModalStyles';
import { MediaSelectionPreview } from '@/mobile/app/shared/components/media/MediaSelectionPreview';
import { TextField } from '@/mobile/app/shared/components/ui/TextField';
import { t } from '@/mobile/app/shared/i18n';
import { colors } from '@/mobile/app/shared/theme/tokens';
import {
  LIST_DESCRIPTION_MAX_LENGTH,
  LIST_NAME_MAX_LENGTH,
} from '@/mobile/app/shared/validation/contentLimits';

type ListEditorFormProps = {
  coverImage?: string;
  description: string;
  descriptionCount: string;
  isPublic: boolean;
  loading: boolean;
  name: string;
  nameCount: string;
  onCoverPress: () => void;
  onDescriptionChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onPreviewCover: () => void;
  onRemoveCover: () => void;
  onVisibilityChange: (isPublic: boolean) => void;
};

export function ListEditorForm({
  coverImage,
  description,
  descriptionCount,
  isPublic,
  loading,
  name,
  nameCount,
  onCoverPress,
  onDescriptionChange,
  onNameChange,
  onPreviewCover,
  onRemoveCover,
  onVisibilityChange,
}: ListEditorFormProps) {
  return (
    <>
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t.listEditor.coverTitle}</Text>
          <Text style={styles.sectionHint}>{t.listEditor.coverVisibilityHint}</Text>
        </View>

        <View style={styles.coverPickerRow}>
          <Pressable
            accessibilityLabel={coverImage ? t.listEditor.changeCover : t.listEditor.chooseCover}
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
            disabled={loading}
            style={[styles.coverPicker, coverImage ? styles.coverPickerSelected : null]}
            onPress={onCoverPress}
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
                    onPreviewCover();
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
              accessibilityState={{ disabled: loading }}
              disabled={loading}
              hitSlop={Platform.OS === 'ios' ? 9 : 11}
              onPress={onRemoveCover}
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
          onChangeText={onNameChange}
          placeholder={t.listEditor.titlePlaceholder}
          maxLength={LIST_NAME_MAX_LENGTH}
        />
        <Text style={styles.fieldCount}>{nameCount}</Text>

        <TextField
          label={t.listEditor.descriptionLabel}
          value={description}
          onChangeText={onDescriptionChange}
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
            accessibilityRole="radio"
            accessibilityState={{ checked: isPublic, disabled: loading }}
            style={[styles.privacyButton, isPublic ? styles.privacyButtonActive : null]}
            disabled={loading}
            onPress={() => onVisibilityChange(true)}
          >
            <Globe color={isPublic ? colors.secondary : colors.textMuted} size={14} />
            <View style={styles.privacyButtonBody}>
              <Text style={[styles.privacyText, isPublic ? styles.privacyTextActivePublic : null]}>
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
            accessibilityRole="radio"
            accessibilityState={{ checked: !isPublic, disabled: loading }}
            style={[styles.privacyButton, !isPublic ? styles.privateButtonActive : null]}
            disabled={loading}
            onPress={() => onVisibilityChange(false)}
          >
            <Lock color={!isPublic ? colors.primary : colors.textMuted} size={14} />
            <View style={styles.privacyButtonBody}>
              <Text style={[styles.privacyText, !isPublic ? styles.privacyTextActivePrivate : null]}>
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
    </>
  );
}
