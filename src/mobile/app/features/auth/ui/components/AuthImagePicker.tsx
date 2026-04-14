import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';

import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type AuthImagePickerProps = {
  uri?: string;
  shape: 'circle' | 'cover';
  coverHeight?: number;
  placeholderIcon: React.ReactNode;
  placeholderText: string;
  helperText?: string;
  onPress: () => void;
  onClear: () => void;
};

export function AuthImagePicker({
  uri,
  shape,
  coverHeight = 112,
  placeholderIcon,
  placeholderText,
  helperText,
  onPress,
  onClear,
}: AuthImagePickerProps) {
  const isCircle = shape === 'circle';

  return (
    <View style={styles.block}>
      <InstantPressable
        onPress={onPress}
        style={[
          styles.picker,
          isCircle ? styles.circlePicker : styles.coverPicker,
          !isCircle ? { height: coverHeight } : null,
        ]}
      >
        {uri ? (
          <>
            <Image source={{ uri }} style={styles.previewImage} />
            <InstantPressable
              onPress={(event) => {
                event.stopPropagation();
                onClear();
              }}
              style={[styles.clearButton, isCircle ? styles.circleClear : styles.coverClear]}
            >
              <X color={colors.onPrimary} size={14} />
            </InstantPressable>
          </>
        ) : (
          <View style={styles.emptyState}>
            {placeholderIcon}
            <Text style={styles.placeholderText}>{placeholderText}</Text>
          </View>
        )}
      </InstantPressable>

      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 10,
  },
  picker: {
    overflow: 'hidden',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  circlePicker: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignSelf: 'center',
  },
  coverPicker: {
    width: '100%',
    borderRadius: radius.lg,
    backgroundColor: colors.primaryBg,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  placeholderText: {
    fontSize: 12,
    color: colors.textSoft,
  },
  helperText: {
    fontSize: 12,
    color: colors.textSoft,
    textAlign: 'center',
  },
  clearButton: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkOverlay,
  },
  circleClear: {
    top: 8,
    right: 8,
  },
  coverClear: {
    top: 10,
    right: 10,
  },
});
