import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check, X } from 'lucide-react-native';

import { MediaSelectionPreview } from '@/mobile/app/shared/components/media/MediaSelectionPreview';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
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
                  ? 'Secildi. Degistirmek icin karta dokun.'
                  : 'Sectiginde telefonunun kirpma araci acilir.'}
              </Text>
            </View>
          </View>

          {hasSelection ? (
            <View style={styles.headerActions}>
              <View style={styles.selectionBadge}>
                <Check color={colors.secondary} size={14} />
                <Text style={styles.selectionBadgeText}>Hazir</Text>
              </View>

              <InstantPressable
                accessibilityLabel={`${placeholderText} temizle`}
                accessibilityRole="button"
                onPress={(event) => {
                  event.stopPropagation();
                  onClear();
                }}
                style={styles.clearButton}
              >
                <X color={colors.onPrimary} size={14} />
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
    gap: 10,
  },
  picker: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 16,
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
    gap: 12,
  },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
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
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectionBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.secondary,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkOverlay,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
