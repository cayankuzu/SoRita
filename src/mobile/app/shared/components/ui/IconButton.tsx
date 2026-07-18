import React from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import type { GestureResponderEvent, AccessibilityRole } from 'react-native';

import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { colors, radius, semanticColors, touch } from '@/mobile/app/shared/theme/tokens';

type IconButtonProps = {
  accessibilityHint?: string;
  accessibilityLabel: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: {
    busy?: boolean;
    checked?: boolean | 'mixed';
    disabled?: boolean;
    expanded?: boolean;
    selected?: boolean;
  };
  children: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onPress?: (event: GestureResponderEvent) => void | Promise<void>;
  selected?: boolean;
  size?: 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
  variant?: 'danger' | 'ghost' | 'inverse' | 'surface';
};

const MIN_TOUCH_SIZE = Platform.OS === 'ios' ? touch.ios : touch.android;

export function IconButton({
  accessibilityHint,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  children,
  disabled = false,
  loading = false,
  onPress,
  selected = false,
  size = 'md',
  style,
  variant = 'ghost',
}: IconButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <InstantPressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={{
        ...accessibilityState,
        busy: loading || accessibilityState?.busy,
        disabled: isDisabled || accessibilityState?.disabled,
        selected: selected || accessibilityState?.selected,
      }}
      disabled={isDisabled}
      hitSlop={0}
      onPress={onPress}
      style={({ pressed }) => [
        styles.frame,
        size === 'sm' ? styles.frameSmall : null,
        styles[variant],
        selected ? styles.selected : null,
        pressed && !isDisabled ? (variant === 'inverse' ? styles.inversePressed : styles.pressed) : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'inverse' ? colors.onPrimary : colors.primary} />
      ) : (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {children}
        </View>
      )}
    </InstantPressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    minWidth: MIN_TOUCH_SIZE,
    minHeight: MIN_TOUCH_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameSmall: {
    minWidth: MIN_TOUCH_SIZE,
    minHeight: MIN_TOUCH_SIZE,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  surface: {
    backgroundColor: semanticColors.surface.subtle,
  },
  inverse: {
    backgroundColor: colors.darkOverlay,
  },
  inversePressed: {
    backgroundColor: colors.controlsOverlay,
  },
  danger: {
    backgroundColor: colors.dangerBg,
  },
  selected: {
    borderWidth: 1,
    borderColor: semanticColors.border.focus,
    backgroundColor: colors.primaryBg,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  disabled: {
    opacity: 0.48,
  },
});
