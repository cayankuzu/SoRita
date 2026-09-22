import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import { Check, X } from 'lucide-react-native';

import { MediaSelectionPreview } from '@/mobile/app/shared/components/media/MediaSelectionPreview';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  fontWeight,
  hitSlopFor,
  iconSize,
  radius,
  spacing,
  textStyle,
} from '@/mobile/app/shared/theme/tokens';

type AuthImagePickerProps = {
  uri?: string;
  shape: 'circle' | 'cover';
  placeholderIcon: React.ReactNode;
  placeholderText: string;
  helperText?: string;
  onPress: () => void;
  onClear: () => void;
};

export function AuthImagePicker({
  uri,
  shape,
  placeholderIcon,
  placeholderText,
  helperText,
  onPress,
  onClear,
}: AuthImagePickerProps) {
  const isCircle = shape === 'circle';
  const hasSelection = Boolean(uri);

  return (
    <View style={styles.block}>
      <InstantPressable
        accessibilityHint={helperText}
        accessibilityLabel={placeholderText}
        accessibilityRole="button"
        accessibilityState={{ selected: hasSelection }}
        onPress={onPress}
        style={[
          styles.picker,
          isCircle ? styles.circlePicker : styles.coverPicker,
          hasSelection ? styles.pickerSelected : null,
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.copy}>
            <View style={[styles.iconWrap, hasSelection ? styles.iconWrapSelected : null]}>
              {placeholderIcon}
            </View>
            <View style={styles.textWrap}>
              <AppText style={styles.title}>{placeholderText}</AppText>
              <AppText style={styles.subtitle}>
                {hasSelection
                  ? tr.mediaPicker.selectedHint
                  : tr.mediaPicker.cropHint}
              </AppText>
            </View>
          </View>

          {hasSelection ? (
            <View style={styles.headerActions}>
              <View style={styles.selectionBadge}>
                <Check color={colors.secondary} size={iconSize.xs} />
                <AppText style={styles.selectionBadgeText}>{tr.common.ready}</AppText>
              </View>

              <InstantPressable
                accessibilityLabel={tr.mediaPicker.clearSelection(placeholderText)}
                accessibilityRole="button"
                hitSlop={hitSlopFor(24)}
                onPress={(event) => {
                  event.stopPropagation();
                  onClear();
                }}
                style={styles.clearButton}
              >
                <X color={colors.onPrimary} size={iconSize.xs} />
              </InstantPressable>
            </View>
          ) : null}
        </View>

        <MediaSelectionPreview
          accessibilityLabel={placeholderText}
          uri={uri}
          variant={isCircle ? 'avatar' : 'profile-cover'}
        />
      </InstantPressable>

      {helperText ? <AppText style={styles.helperText}>{helperText}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    width: '100%',
    gap: spacing.sm,
  },
  picker: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
    position: 'relative',
  },
  pickerSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  circlePicker: {},
  coverPicker: {},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  iconWrapSelected: {
    backgroundColor: colors.surface,
  },
  textWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  title: textStyle('compactTitleText', colors.text),
  subtitle: textStyle('captionText', colors.textMuted, fontWeight.regular),
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  selectionBadgeText: textStyle('metadataText', colors.secondary, fontWeight.strong),
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkOverlay,
  },
  helperText: textStyle('captionText', colors.textMuted, fontWeight.regular),
});
