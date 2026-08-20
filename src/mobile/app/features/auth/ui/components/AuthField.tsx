import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardTypeOptions,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { CircleAlert, CircleCheck, Eye, EyeOff } from 'lucide-react-native';

import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  radius,
  semanticColors,
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
        <CircleCheck color={colors.secondary} size={15} />
      ) : (
        <CircleAlert color={colors.danger} size={15} />
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
        <EyeOff color={colors.textMuted} size={16} />
      ) : (
        <Eye color={colors.textMuted} size={16} />
      )}
    </IconButton>
  );
}

function AuthFieldHelper({ id, message, tone }: { id: string; message?: string; tone: HelperTone }) {
  if (!message) {
    return null;
  }

  return (
    <Text
      accessibilityLiveRegion="polite"
      nativeID={id}
      style={[
        styles.helper,
        tone === 'danger' ? styles.helperDanger : null,
        tone === 'success' ? styles.helperSuccess : null,
      ]}
    >
      {message}
    </Text>
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
      <Text nativeID={labelId} style={styles.label}>
        {label}
      </Text>
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
    gap: 4,
  },
  label: {
    ...typography.metadataText,
    fontWeight: '600',
    color: colors.textMuted,
  },
  inputWrap: {
    minHeight: MIN_TOUCH_SIZE,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    paddingLeft: 32,
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
    fontSize: 13,
    minHeight: MIN_TOUCH_SIZE,
    paddingVertical: 8,
    paddingRight: 30,
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
  helper: {
    ...typography.metadataText,
    lineHeight: 15,
    color: colors.textMuted,
  },
  helperDanger: {
    color: colors.danger,
  },
  helperSuccess: {
    color: colors.secondary,
  },
});
