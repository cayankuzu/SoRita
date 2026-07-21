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

import {
  InstantPressable,
  type InstantPressableHapticFeedback,
} from '@/mobile/app/shared/components/ui/InstantPressable';
import {
  colors,
  controlSize,
  fontWeight,
  opacity,
  radius,
  typography,
} from '@/mobile/app/shared/theme/tokens';

type PrimaryButtonProps = {
  title: string;
  onPress: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'end' | 'start';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  hapticFeedback?: InstantPressableHapticFeedback;
};

export function PrimaryButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'start',
  style,
  textStyle,
  hapticFeedback,
}: PrimaryButtonProps) {
  const palette = palettes[variant];
  const isDisabled = disabled || loading;

  return (
    <InstantPressable
      accessibilityLabel={title}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      hapticFeedback={
        hapticFeedback ??
        (variant === 'danger'
          ? 'warning'
          : variant === 'success'
            ? 'success'
            : variant === 'primary'
              ? 'light'
              : false)
      }
      onPress={onPress}
      style={({ pressed, busy }) => [
        styles.button,
        { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor },
        (pressed || busy) && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
    >
      {({ busy }) => {
        const showProgress = loading || busy;

        return (
        <View style={styles.content}>
          <View
            accessibilityElementsHidden={showProgress}
            importantForAccessibility={showProgress ? 'no-hide-descendants' : 'auto'}
            style={[styles.labelRow, showProgress ? styles.hiddenContent : null]}
          >
            {icon && iconPosition === 'start' ? icon : null}
            <Text style={[styles.label, { color: palette.color }, textStyle]}>{title}</Text>
            {icon && iconPosition === 'end' ? icon : null}
          </View>
          {showProgress ? (
            <View pointerEvents="none" style={styles.progressOverlay}>
              <ActivityIndicator color={palette.color} size="small" />
            </View>
          ) : null}
        </View>
        );
      }}
    </InstantPressable>
  );
}

const palettes = {
  primary: { backgroundColor: colors.primary, borderColor: colors.primary, color: colors.onPrimary },
  secondary: { backgroundColor: colors.surface, borderColor: colors.cardBorder, color: colors.text },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent', color: colors.textMuted },
  danger: { backgroundColor: colors.danger, borderColor: colors.danger, color: colors.onPrimary },
  success: { backgroundColor: colors.secondary, borderColor: colors.secondary, color: colors.onPrimary },
};

const styles = StyleSheet.create({
  button: {
    minHeight: controlSize.default,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  content: {
    minHeight: 20,
    minWidth: 20,
    position: 'relative',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    ...typography.labelText,
    fontWeight: fontWeight.strong,
  },
  progressOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenContent: {
    opacity: 0,
  },
  pressed: {
    opacity: opacity.pressed,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: opacity.disabled,
  },
});
