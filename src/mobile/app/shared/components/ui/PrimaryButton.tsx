import React from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type PrimaryButtonProps = {
  title: string;
  onPress: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function PrimaryButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
}: PrimaryButtonProps) {
  const palette = palettes[variant];

  return (
    <InstantPressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed, busy }) => [
        styles.button,
        { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor },
        (pressed || busy) && !disabled ? { opacity: 0.88, transform: [{ scale: 0.98 }] } : null,
        disabled ? { opacity: 0.45 } : null,
        style,
      ]}
    >
      {({ busy }) =>
        loading || busy ? (
          <ActivityIndicator color={palette.color} />
        ) : (
          <View style={styles.content}>
            {icon}
            <Text style={[styles.label, { color: palette.color }, textStyle]}>{title}</Text>
          </View>
        )
      }
    </InstantPressable>
  );
}

const palettes = {
  primary: { backgroundColor: colors.primary, borderColor: colors.primary, color: colors.onPrimary },
  secondary: { backgroundColor: colors.surface, borderColor: colors.cardBorder, color: colors.text },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent', color: colors.textMuted },
  danger: { backgroundColor: colors.danger, borderColor: colors.danger, color: colors.onPrimary },
};

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
});
