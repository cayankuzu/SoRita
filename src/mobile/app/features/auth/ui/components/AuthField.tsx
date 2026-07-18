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
  const autoCorrect =
    restInputProps.autoCorrect ?? !(autoCapitalize === 'none' || secureTextEntry);
  const valueLengthHelper =
    typeof restInputProps.maxLength === 'number'
      ? buildCharacterLimitLabel(value, restInputProps.maxLength)
      : null;
  const resolvedHelper = status?.message || helper || valueLengthHelper || undefined;
  const resolvedHelperTone =
    status?.kind === 'invalid' || status?.kind === 'server-error'
      ? 'danger'
      : status?.kind === 'valid'
        ? 'success'
        : helperTone;
  const showStatusIcon = resolvedHelperTone === 'danger' || resolvedHelperTone === 'success';
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
        {showStatusIcon ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.statusIcon, shouldShowPasswordToggle ? styles.statusIconWithToggle : null]}
        >
            {resolvedHelperTone === 'success' ? (
              <CircleCheck color={colors.secondary} size={17} />
            ) : (
              <CircleAlert color={colors.danger} size={17} />
            )}
          </View>
        ) : showCheckingIndicator ? (
          <ActivityIndicator
            accessibilityElementsHidden
            color={colors.primary}
            importantForAccessibility="no-hide-descendants"
            size="small"
            style={[styles.statusIcon, shouldShowPasswordToggle ? styles.statusIconWithToggle : null]}
          />
        ) : null}
        {shouldShowPasswordToggle ? (
          <IconButton
            accessibilityLabel={passwordVisible ? tr.common.hidePassword : tr.common.showPassword}
            accessibilityState={{ checked: passwordVisible }}
            onPress={() => setPasswordVisible((current) => !current)}
            style={styles.passwordToggle}
          >
            {passwordVisible ? (
              <EyeOff color={colors.textMuted} size={18} />
            ) : (
              <Eye color={colors.textMuted} size={18} />
            )}
          </IconButton>
        ) : null}
      </View>
      <View style={styles.helperSlot}>
        {resolvedHelper ? (
          <Text
            accessibilityLiveRegion="polite"
            nativeID={helperId}
            style={[
              styles.helper,
              resolvedHelperTone === 'danger' ? styles.helperDanger : null,
              resolvedHelperTone === 'success' ? styles.helperSuccess : null,
            ]}
          >
            {resolvedHelper}
          </Text>
        ) : null}
      </View>
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
