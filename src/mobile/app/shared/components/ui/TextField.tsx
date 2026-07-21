import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import {
  colors,
  fontWeight,
  radius,
  semanticColors,
  typography,
} from '@/mobile/app/shared/theme/tokens';
import {
  buildCharacterLimitLabel,
  normalizeLineBreaks,
} from '@/mobile/app/shared/validation/contentLimits';

type TextFieldProps = TextInputProps & {
  label?: string;
  helper?: string;
  multilineRows?: number;
  helperTone?: 'muted' | 'danger' | 'success';
  status?: 'default' | 'error' | 'success';
};

export function TextField({
  label,
  helper,
  multilineRows,
  helperTone = 'muted',
  status = 'default',
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
  const valueLength = typeof props.value === 'string' ? props.value.length : 0;
  const isNearCharacterLimit =
    typeof props.maxLength === 'number' && valueLength >= props.maxLength * 0.8;
  const resolvedTone =
    status === 'error' ? 'danger' : status === 'success' ? 'success' : helperTone;
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
        accessibilityState={{ disabled: Boolean(props.editable === false) }}
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
          props.value ? styles.inputFilled : null,
          status === 'error' ? styles.inputError : null,
          status === 'success' ? styles.inputSuccess : null,
          props.editable === false ? styles.inputDisabled : null,
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
            resolvedTone === 'danger' ? styles.helperDanger : null,
            resolvedTone === 'success' ? styles.helperSuccess : null,
            isNearCharacterLimit ? styles.helperNearLimit : null,
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
    gap: 4,
  },
  label: {
    ...typography.metadataText,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
  },
  helper: {
    ...typography.metadataText,
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
    paddingHorizontal: 10,
    paddingVertical: 10,
    ...typography.bodyText,
    includeFontPadding: false,
  },
  inputFocused: {
    borderColor: semanticColors.border.focus,
    borderWidth: 2,
  },
  inputFilled: {
    borderColor: colors.borderStrong,
  },
  inputError: {
    borderColor: semanticColors.border.danger,
    backgroundColor: colors.dangerBg,
  },
  inputSuccess: {
    borderColor: semanticColors.border.success,
  },
  inputDisabled: {
    backgroundColor: colors.surfaceMuted,
    color: colors.textDisabled,
  },
  helperNearLimit: {
    fontWeight: fontWeight.strong,
  },
  multiline: {
    minHeight: 82,
    maxHeight: 154,
    textAlignVertical: 'top',
  },
});
