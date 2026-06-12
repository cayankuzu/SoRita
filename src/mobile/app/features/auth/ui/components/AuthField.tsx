import React, { useState } from 'react';
import {
  KeyboardTypeOptions,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

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
  ...inputProps
}: AuthFieldProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const shouldShowPasswordToggle = secureTextEntry;
  const accessibilityLabel = inputProps.accessibilityLabel || label;
  const autoCorrect =
    inputProps.autoCorrect ?? !(autoCapitalize === 'none' || secureTextEntry);

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <View style={styles.icon}>{icon}</View>
        <TextInput
          {...inputProps}
          accessibilityHint={helper}
          accessibilityLabel={accessibilityLabel}
          allowFontScaling
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSoft}
          secureTextEntry={secureTextEntry && !passwordVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          maxFontSizeMultiplier={1.2}
          style={[styles.input, shouldShowPasswordToggle ? styles.inputWithToggle : null]}
        />
        {shouldShowPasswordToggle ? (
          <InstantPressable style={styles.passwordToggle} onPress={() => setPasswordVisible((current) => !current)}>
            {passwordVisible ? (
              <EyeOff color={colors.textSoft} size={18} />
            ) : (
              <Eye color={colors.textSoft} size={18} />
            )}
          </InstantPressable>
        ) : null}
      </View>
      {helper ? (
        <Text
          style={[
            styles.helper,
            helperTone === 'danger' ? styles.helperDanger : null,
            helperTone === 'success' ? styles.helperSuccess : null,
          ]}
          maxFontSizeMultiplier={1.2}
        >
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
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
  icon: {
    position: 'absolute',
    left: 14,
    top: 14,
  },
  input: {
    color: colors.text,
    fontSize: 15,
    paddingVertical: 12,
    paddingRight: 14,
  },
  inputWithToggle: {
    paddingRight: 46,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 10,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
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
});
