import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardTypeOptions,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { CircleAlert, CircleCheck, Eye, EyeOff } from 'lucide-react-native';

import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius, semanticColors } from '@/mobile/app/shared/theme/tokens';
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
        <CircleCheck color={colors.secondary} size={17} />
      ) : (
        <CircleAlert color={colors.danger} size={17} />
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
        <EyeOff color={colors.textMuted} size={18} />
      ) : (
        <Eye color={colors.textMuted} size={18} />
      )}
    </IconButton>
  );
}

function AuthFieldHelper({ id, message, tone }: { id: string; message?: string; tone: HelperTone }) {
  return (
    <View style={styles.helperSlot}>
      {message ? (
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
      ) : null}
    </View>
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

export function AuthField({
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
}: AuthFieldProps) {
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
  const shouldFloatLabel = focused || value.length > 0;
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
      <View
        style={[
          styles.inputWrap,
          focused ? styles.inputWrapFocused : null,
          resolvedHelperTone === 'danger' ? styles.inputWrapInvalid : null,
          resolvedHelperTone === 'success' ? styles.inputWrapValid : null,
        ]}
      >
        <Text
          nativeID={labelId}
          pointerEvents="none"
          style={[styles.label, shouldFloatLabel ? styles.labelFloating : null]}
        >
          {label}
        </Text>
        <View style={styles.icon}>{icon}</View>
        <TextInput
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
          placeholder={shouldFloatLabel ? placeholder : ''}
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
}

const styles = StyleSheet.create({
  block: {
    gap: 6,
  },
  label: {
    position: 'absolute',
    left: 40,
    top: 14,
    zIndex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 3,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  labelFloating: {
    left: 12,
    top: -8,
    fontSize: 12,
    color: colors.text,
  },
  inputWrap: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    paddingLeft: 40,
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
    left: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  input: {
    color: colors.text,
    fontSize: 15,
    paddingTop: 18,
    paddingBottom: 8,
    paddingRight: 38,
  },
  inputWithToggle: {
    paddingRight: 78,
  },
  statusIcon: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  statusIconWithToggle: {
    right: 44,
  },
  passwordToggle: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
  },
  helperSlot: {
    minHeight: 16,
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
});
