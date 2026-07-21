import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check, X } from 'lucide-react-native';

import { MediaSelectionPreview } from '@/mobile/app/shared/components/media/MediaSelectionPreview';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

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
              <Text style={styles.title}>{placeholderText}</Text>
              <Text style={styles.subtitle}>
                {hasSelection
                  ? tr.mediaPicker.selectedHint
                  : tr.mediaPicker.cropHint}
              </Text>
            </View>
          </View>

          {hasSelection ? (
            <View style={styles.headerActions}>
              <View style={styles.selectionBadge}>
                <Check color={colors.secondary} size={12} />
                <Text style={styles.selectionBadgeText}>{tr.common.ready}</Text>
              </View>

              <InstantPressable
                accessibilityLabel={tr.mediaPicker.clearSelection(placeholderText)}
                accessibilityRole="button"
                hitSlop={10}
                onPress={(event) => {
                  event.stopPropagation();
                  onClear();
                }}
                style={styles.clearButton}
              >
                <X color={colors.onPrimary} size={12} />
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

      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    width: '100%',
    gap: 8,
  },
  picker: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 12,
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
    gap: 10,
  },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  iconWrapSelected: {
    backgroundColor: colors.surface,
  },
  textWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  selectionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.secondary,
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkOverlay,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
});
