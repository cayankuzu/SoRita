import React from 'react';
import { View } from 'react-native';
import { Globe, ImagePlus, Lock, X } from 'lucide-react-native';

import { listEditorModalStyles as styles } from '@/mobile/app/features/lists/ui/components/listEditorModalStyles';
import { MediaSelectionPreview } from '@/mobile/app/shared/components/media/MediaSelectionPreview';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { TextField } from '@/mobile/app/shared/components/ui/TextField';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { t } from '@/mobile/app/shared/i18n';
import { colors, hitSlopFor, iconSize } from '@/mobile/app/shared/theme/tokens';
import {
  LIST_DESCRIPTION_MAX_LENGTH,
  LIST_NAME_MAX_LENGTH,
} from '@/mobile/app/shared/validation/contentLimits';

type ListEditorFormProps = {
  coverImage?: string;
  description: string;
  isPublic: boolean;
  loading: boolean;
  name: string;
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
  isPublic,
  loading,
  name,
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
          <AppText accessibilityRole="header" style={styles.sectionTitle}>{t.listEditor.basicsTitle}</AppText>
          <AppText style={styles.sectionHint}>{t.listEditor.basicsHint}</AppText>
        </View>
        <TextField
          label={t.listEditor.titleLabel}
          value={name}
          onChangeText={onNameChange}
          placeholder={t.listEditor.titlePlaceholder}
          maxLength={LIST_NAME_MAX_LENGTH}
          returnKeyType="next"
        />

        <TextField
          label={`${t.listEditor.descriptionLabel} (${t.common.optional})`}
          value={description}
          onChangeText={onDescriptionChange}
          placeholder={t.listEditor.descriptionPlaceholder}
          multilineRows={3}
          maxLength={LIST_DESCRIPTION_MAX_LENGTH}
        />
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <AppText accessibilityRole="header" style={styles.sectionTitle}>{t.listEditor.privacyTitle}</AppText>
          <AppText style={styles.sectionHint}>{t.listEditor.privacyHint}</AppText>
        </View>
        <View accessibilityRole="radiogroup" style={styles.privacyRow}>
          <InstantPressable
            accessibilityLabel={t.listEditor.privacyPublic}
            accessibilityHint={t.listEditor.privacyPublicDescription}
            accessibilityRole="radio"
            accessibilityState={{ checked: isPublic, disabled: loading }}
            style={[styles.privacyButton, isPublic ? styles.privacyButtonActive : null]}
            disabled={loading}
            onPress={() => onVisibilityChange(true)}
          >
            <Globe color={isPublic ? colors.secondary : colors.textMuted} size={iconSize.sm} />
            <View style={styles.privacyButtonBody}>
              <AppText style={[styles.privacyText, isPublic ? styles.privacyTextActivePublic : null]}>
                {t.listEditor.privacyPublic}
              </AppText>
              <AppText
                style={[
                  styles.privacyCaption,
                  isPublic ? styles.privacyCaptionActivePublic : null,
                ]}
              >
                {t.listEditor.privacyPublicDescription}
              </AppText>
            </View>
          </InstantPressable>

          <InstantPressable
            accessibilityLabel={t.listEditor.privacyPrivate}
            accessibilityHint={t.listEditor.privacyPrivateDescription}
            accessibilityRole="radio"
            accessibilityState={{ checked: !isPublic, disabled: loading }}
            style={[styles.privacyButton, !isPublic ? styles.privateButtonActive : null]}
            disabled={loading}
            onPress={() => onVisibilityChange(false)}
          >
            <Lock color={!isPublic ? colors.primary : colors.textMuted} size={iconSize.sm} />
            <View style={styles.privacyButtonBody}>
              <AppText style={[styles.privacyText, !isPublic ? styles.privacyTextActivePrivate : null]}>
                {t.listEditor.privacyPrivate}
              </AppText>
              <AppText
                style={[
                  styles.privacyCaption,
                  !isPublic ? styles.privacyCaptionActivePrivate : null,
                ]}
              >
                {t.listEditor.privacyPrivateDescription}
              </AppText>
            </View>
          </InstantPressable>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <AppText accessibilityRole="header" style={styles.sectionTitle}>{t.listEditor.coverTitle}</AppText>
          <AppText style={styles.sectionHint}>{t.common.optional}</AppText>
        </View>

        <View style={styles.coverPickerRow}>
          <InstantPressable
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
                  <ImagePlus color={colors.secondary} size={iconSize.sm} />
                </View>
                <View style={styles.coverPickerBody}>
                  <AppText style={styles.coverPickerText}>
                    {coverImage ? t.listEditor.changeCover : t.listEditor.chooseCover}
                  </AppText>
                  <AppText style={styles.coverPickerHint}>
                    {coverImage
                      ? t.listEditor.coverSelectedHint
                      : t.listEditor.coverUsageHint}
                  </AppText>
                </View>
              </View>

              {coverImage ? (
                <InstantPressable
                  accessibilityLabel={t.listEditor.coverPreviewExpand}
                  hitSlop={hitSlopFor(30)}
                  accessibilityRole="imagebutton"
                  disabled={loading}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    onPreviewCover();
                  }}
                  style={styles.selectionBadge}
                >
                  <AppText style={styles.selectionBadgeText}>{t.common.previewTitle}</AppText>
                </InstantPressable>
              ) : null}
            </View>

            <MediaSelectionPreview
              accessibilityLabel={t.listEditor.coverPreview}
              uri={coverImage}
              variant="list-cover"
            />
          </InstantPressable>

          {coverImage ? (
            <InstantPressable
              accessibilityLabel={t.listEditor.removeCover}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading }}
              disabled={loading}
              hitSlop={hitSlopFor(26)}
              onPress={onRemoveCover}
              style={styles.coverClearButton}
            >
              <X color={colors.onPrimary} size={iconSize.sm} />
            </InstantPressable>
          ) : null}
        </View>
      </View>
    </>
  );
}
