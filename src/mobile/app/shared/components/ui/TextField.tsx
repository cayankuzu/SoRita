import React from 'react';
import {
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import {
  colors,
  fontWeight,
  minTouchSize,
  radius,
  spacing,
  textStyle,
  typography,
} from '@/mobile/app/shared/theme/tokens';
import {
  buildCharacterLimitLabel,
  normalizeLineBreaks,
} from '@/mobile/app/shared/validation/contentLimits';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';

type TextFieldProps = TextInputProps & {
  label?: string;
  helper?: string;
  multilineRows?: number;
  helperTone?: 'muted' | 'danger' | 'success';
  status?: 'default' | 'error' | 'success';
};

export const TextField = React.forwardRef<TextInput, TextFieldProps>(function TextField({
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
}: TextFieldProps, ref) {
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
      {label ? <AppText nativeID={labelId} style={styles.label}>{label}</AppText> : null}
      <TextInput
        ref={ref}
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
        <AppText
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
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: textStyle('metadataText', colors.textMuted, fontWeight.medium),
  helper: textStyle('metadataText', colors.textMuted),
  helperDanger: {
    color: colors.danger,
  },
  helperSuccess: {
    color: colors.secondary,
  },
  input: {
    minHeight: minTouchSize,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.bodyText,
    includeFontPadding: false,
  },
  inputFocused: {
    borderColor: colors.focus,
  },
  inputFilled: {
    borderColor: colors.borderStrong,
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  inputSuccess: {
    borderColor: colors.secondary,
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
