import React from 'react';
import {
  Platform,
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

// Android scrolls a one-line field to its cursor, which it puts after the
// last character: a filled address read "…bağlar, Tüt Sk. 9/B" from the
// middle. Until the field is focused, hold the cursor at the start.
const START_OF_TEXT = { end: 0, start: 0 } as const;

function resolveSelection(
  selection: TextInputProps['selection'],
  { focused, multiline }: { focused: boolean; multiline: boolean },
) {
  return Platform.OS === 'android' && !multiline && !focused && selection === undefined
    ? START_OF_TEXT
    : selection;
}

// The line under the field: the caller's helper, otherwise how much of the
// character limit is used; its colour follows the field's status.
function describeHelper({
  helper,
  helperTone,
  maxLength,
  status,
  value,
}: {
  helper?: string;
  helperTone: 'danger' | 'muted' | 'success';
  maxLength?: number;
  status: 'default' | 'error' | 'success';
  value?: string;
}) {
  const hasLimit = typeof maxLength === 'number' && typeof value === 'string';

  return {
    isNearLimit: hasLimit && value.length >= maxLength * 0.8,
    text: helper || (hasLimit ? buildCharacterLimitLabel(value, maxLength) : undefined),
    tone: status === 'error' ? 'danger' : status === 'success' ? 'success' : helperTone,
  };
}

// A multi-line field keeps the keyboard up on return and scrolls inside
// itself, unless the caller says otherwise.
function keyboardBehaviour(
  isMultiline: boolean,
  { blurOnSubmit, returnKeyType, scrollEnabled }: TextInputProps,
) {
  return isMultiline
    ? {
        blurOnSubmit: blurOnSubmit ?? false,
        returnKeyType: returnKeyType ?? 'default',
        scrollEnabled: scrollEnabled ?? true,
      }
    : { blurOnSubmit, returnKeyType, scrollEnabled };
}

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

  const {
    isNearLimit: isNearCharacterLimit,
    text: resolvedHelper,
    tone: resolvedTone,
  } = describeHelper({ helper, helperTone, maxLength: props.maxLength, status, value: props.value });
  const isMultiline = Boolean(multilineRows);
  const selection = resolveSelection(props.selection, { focused, multiline: isMultiline });
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
        {...keyboardBehaviour(isMultiline, props)}
        multiline={isMultiline}
        numberOfLines={multilineRows}
        onBlur={handleBlur}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        placeholderTextColor={colors.textMuted}
        selection={selection}
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
