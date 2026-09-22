import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardTypeOptions,
  Platform,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { CircleAlert, CircleCheck, Eye, EyeOff } from 'lucide-react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  fontWeight,
  iconSize,
  radius,
  semanticColors,
  spacing,
  textStyle,
  touch,
  typography,
} from '@/mobile/app/shared/theme/tokens';
import { buildCharacterLimitLabel } from '@/mobile/app/shared/validation/contentLimits';

export type AuthFieldStatus =
  | { kind: 'idle'; message?: string }
  | { kind: 'checking'; message: string }
  | { kind: 'valid'; message: string }
  | { kind: 'invalid'; message: string }
  | { kind: 'server-error'; message: string };

type AuthFieldProps = Omit<
  TextInputProps,
  'value' | 'onChangeText' | 'placeholder' | 'secureTextEntry' | 'keyboardType' | 'autoCapitalize'
> & {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  icon: React.ReactNode;
  helper?: string;
  helperTone?: 'muted' | 'danger' | 'success';
  status?: AuthFieldStatus;
};

type HelperTone = NonNullable<AuthFieldProps['helperTone']>;

const MIN_TOUCH_SIZE = Platform.OS === 'ios' ? touch.ios : touch.android;

function AuthFieldStatusAccessory({
  checking,
  passwordToggleVisible,
  tone,
}: {
  checking: boolean;
  passwordToggleVisible: boolean;
  tone: HelperTone;
}) {
  const style = [styles.statusIcon, passwordToggleVisible ? styles.statusIconWithToggle : null];

  if (checking) {
    return (
      <ActivityIndicator
        accessibilityElementsHidden
        color={colors.primary}
        importantForAccessibility="no-hide-descendants"
        size="small"
        style={style}
      />
    );
  }

  if (tone !== 'danger' && tone !== 'success') {
    return null;
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={style}
    >
      {tone === 'success' ? (
        <CircleCheck color={colors.secondary} size={iconSize.sm} />
      ) : (
        <CircleAlert color={colors.danger} size={iconSize.sm} />
      )}
    </View>
  );
}

function PasswordVisibilityButton({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <IconButton
      accessibilityLabel={visible ? tr.common.hidePassword : tr.common.showPassword}
      accessibilityState={{ checked: visible }}
      onPress={onToggle}
      style={styles.passwordToggle}
    >
      {visible ? (
        <EyeOff color={colors.textMuted} size={iconSize.sm} />
      ) : (
        <Eye color={colors.textMuted} size={iconSize.sm} />
      )}
    </IconButton>
  );
}

function AuthFieldHelper({ id, message, tone }: { id: string; message?: string; tone: HelperTone }) {
  if (!message) {
    return null;
  }

  return (
    <AppText
      accessibilityLiveRegion={tone === 'danger' ? 'assertive' : 'polite'}
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      nativeID={id}
      style={[
        styles.helper,
        tone === 'danger' ? styles.helperDanger : null,
        tone === 'success' ? styles.helperSuccess : null,
      ]}
    >
      {message}
    </AppText>
  );
}

function getAuthFieldHelper(
  status: AuthFieldStatus | undefined,
  helper: string | undefined,
  value: string,
  maxLength: number | undefined,
) {
  if (status?.message) {
    return status.message;
  }

  if (helper) {
    return helper;
  }

  return typeof maxLength === 'number'
    ? buildCharacterLimitLabel(value, maxLength)
    : undefined;
}

function getAuthFieldHelperTone(status: AuthFieldStatus | undefined, fallback: HelperTone) {
  if (status?.kind === 'invalid' || status?.kind === 'server-error') {
    return 'danger';
  }

  return status?.kind === 'valid' ? 'success' : fallback;
}

function getAutoCorrect(
  provided: boolean | undefined,
  autoCapitalize: NonNullable<AuthFieldProps['autoCapitalize']>,
  secureTextEntry: boolean,
) {
  if (provided !== undefined) {
    return provided;
  }

  return autoCapitalize !== 'none' && !secureTextEntry;
}

export const AuthField = React.forwardRef<TextInput, AuthFieldProps>(function AuthField({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  icon,
  helper,
  helperTone = 'muted',
  status,
  ...inputProps
}: AuthFieldProps, ref) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const reactId = React.useId();
  const fieldId = React.useMemo(
    () => `auth-field-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    [reactId],
  );
  const labelId = `${fieldId}-label`;
  const helperId = `${fieldId}-helper`;
  const {
    accessibilityLabel: providedAccessibilityLabel,
    accessibilityState: providedAccessibilityState,
    onBlur,
    onFocus,
    ...restInputProps
  } = inputProps;
  const shouldShowPasswordToggle = secureTextEntry;
  const accessibilityLabel = providedAccessibilityLabel || label;
  const autoCorrect = getAutoCorrect(
    restInputProps.autoCorrect,
    autoCapitalize,
    secureTextEntry,
  );
  const resolvedHelper = getAuthFieldHelper(
    status,
    helper,
    value,
    restInputProps.maxLength,
  );
  const resolvedHelperTone = getAuthFieldHelperTone(status, helperTone);
  const showCheckingIndicator = status?.kind === 'checking';
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
    <View style={styles.block}>
      <AppText nativeID={labelId} style={styles.label}>
        {label}
      </AppText>
      <View
        style={[
          styles.inputWrap,
          focused ? styles.inputWrapFocused : null,
          resolvedHelperTone === 'danger' ? styles.inputWrapInvalid : null,
          resolvedHelperTone === 'success' ? styles.inputWrapValid : null,
        ]}
      >
        <View style={styles.icon}>{icon}</View>
        <TextInput
          ref={ref}
          {...restInputProps}
          accessibilityHint={resolvedHelper}
          accessibilityLabel={accessibilityLabel}
          accessibilityLabelledBy={labelId}
          accessibilityState={{ ...providedAccessibilityState, busy: showCheckingIndicator }}
          allowFontScaling
          value={value}
          onChangeText={onChangeText}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry && !passwordVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          style={[styles.input, shouldShowPasswordToggle ? styles.inputWithToggle : null]}
        />
        <AuthFieldStatusAccessory
          checking={showCheckingIndicator}
          passwordToggleVisible={shouldShowPasswordToggle}
          tone={resolvedHelperTone}
        />
        {shouldShowPasswordToggle ? (
          <PasswordVisibilityButton
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((current) => !current)}
          />
        ) : null}
      </View>
      <AuthFieldHelper id={helperId} message={resolvedHelper} tone={resolvedHelperTone} />
    </View>
  );
});

const styles = StyleSheet.create({
  block: {
    gap: spacing.xs,
  },
  label: textStyle('captionText', colors.textMuted, fontWeight.medium),
  inputWrap: {
    minHeight: MIN_TOUCH_SIZE,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    paddingLeft: spacing['3xl'],
    justifyContent: 'center',
  },
  inputWrapFocused: {
    borderColor: semanticColors.border.focus,
  },
  inputWrapInvalid: {
    borderColor: colors.danger,
  },
  inputWrapValid: {
    borderColor: colors.secondary,
  },
  icon: {
    position: 'absolute',
    left: 10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  input: {
    color: colors.text,
    ...typography.inputText,
    minHeight: MIN_TOUCH_SIZE,
    paddingVertical: spacing.sm,
    paddingRight: spacing['3xl'],
  },
  inputWithToggle: {
    paddingRight: 60,
  },
  statusIcon: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  statusIconWithToggle: {
    right: 34,
  },
  passwordToggle: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
  },
  helper: textStyle('captionText', colors.textMuted, fontWeight.medium),
  helperDanger: {
    color: colors.danger,
  },
  helperSuccess: {
    color: colors.secondary,
  },
});
