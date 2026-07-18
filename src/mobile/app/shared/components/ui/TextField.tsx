import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import { colors, radius, semanticColors } from '@/mobile/app/shared/theme/tokens';
import {
  buildCharacterLimitLabel,
  normalizeLineBreaks,
} from '@/mobile/app/shared/validation/contentLimits';

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
  accessibilityLabel: providedAccessibilityLabel,
  autoCapitalize,
  autoCorrect: providedAutoCorrect,
  onBlur,
  onChangeText,
  onFocus,
  ...props
}: TextFieldProps) {
  const [focused, setFocused] = React.useState(false);
  const reactId = React.useId();
  const fieldId = React.useMemo(
    () => `text-field-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    [reactId],
  );
  const labelId = `${fieldId}-label`;
  const helperId = `${fieldId}-helper`;
  const accessibilityLabel = providedAccessibilityLabel || label || props.placeholder;
  const autoCorrect = providedAutoCorrect ?? !(autoCapitalize === 'none');

  const valueLengthHelper =
    typeof props.maxLength === 'number' && typeof props.value === 'string'
      ? buildCharacterLimitLabel(props.value, props.maxLength)
      : null;
  const resolvedHelper = helper || valueLengthHelper || undefined;
  const isMultiline = Boolean(multilineRows);
  const handleChangeText = React.useCallback(
    (value: string) => {
      onChangeText?.(isMultiline ? normalizeLineBreaks(value) : value);
    },
    [isMultiline, onChangeText],
  );
  const handleFocus = React.useCallback<NonNullable<TextInputProps['onFocus']>>(
    (event) => {
      setFocused(true);
      onFocus?.(event);
    },
    [onFocus],
  );
  const handleBlur = React.useCallback<NonNullable<TextInputProps['onBlur']>>(
    (event) => {
      setFocused(false);
      onBlur?.(event);
    },
    [onBlur],
  );

  return (
    <View style={styles.wrapper}>
      {label ? <Text nativeID={labelId} style={styles.label}>{label}</Text> : null}
      <TextInput
        {...props}
        accessibilityHint={resolvedHelper}
        accessibilityLabel={accessibilityLabel}
        accessibilityLabelledBy={label ? labelId : undefined}
        allowFontScaling
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        blurOnSubmit={isMultiline ? props.blurOnSubmit ?? false : props.blurOnSubmit}
        multiline={isMultiline}
        numberOfLines={multilineRows}
        onBlur={handleBlur}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        placeholderTextColor={colors.textMuted}
        returnKeyType={isMultiline ? props.returnKeyType ?? 'default' : props.returnKeyType}
        scrollEnabled={isMultiline ? props.scrollEnabled ?? true : props.scrollEnabled}
        style={[
          styles.input,
          focused ? styles.inputFocused : null,
          multilineRows ? styles.multiline : null,
          style,
        ]}
      />
      {resolvedHelper ? (
        <Text
          accessibilityLiveRegion="polite"
          nativeID={helperId}
          style={[
            styles.helper,
            helperTone === 'danger' ? styles.helperDanger : null,
            helperTone === 'success' ? styles.helperSuccess : null,
          ]}
        >
          {resolvedHelper}
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
    lineHeight: 16,
    color: colors.textMuted,
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
    lineHeight: 21,
    includeFontPadding: false,
  },
  inputFocused: {
    borderColor: semanticColors.border.focus,
  },
  multiline: {
    minHeight: 96,
    maxHeight: 180,
    textAlignVertical: 'top',
  },
});
