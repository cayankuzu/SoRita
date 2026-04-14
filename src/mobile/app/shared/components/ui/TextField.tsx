import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type TextFieldProps = TextInputProps & {
  label?: string;
  helper?: string;
  multilineRows?: number;
  helperTone?: 'muted' | 'danger' | 'success';
};

export function TextField({
  label,
  helper,
  multilineRows,
  helperTone = 'muted',
  style,
  ...props
}: TextFieldProps) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...props}
        multiline={Boolean(multilineRows)}
        numberOfLines={multilineRows}
        placeholderTextColor={colors.textSoft}
        style={[styles.input, multilineRows ? styles.multiline : null, style]}
      />
      {helper ? (
        <Text
          style={[
            styles.helper,
            helperTone === 'danger' ? styles.helperDanger : null,
            helperTone === 'success' ? styles.helperSuccess : null,
          ]}
        >
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  helper: {
    fontSize: 11,
    color: colors.textSoft,
  },
  helperDanger: {
    color: colors.danger,
  },
  helperSuccess: {
    color: colors.secondary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
