import React, { useCallback, useRef, useState } from 'react';
import type { GestureResponderEvent, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { Pressable } from 'react-native';

import { isPromiseLike } from '@/mobile/app/shared/utils/interaction';

type InstantPressableRenderState = {
  pressed: boolean;
  busy: boolean;
  disabled: boolean;
};

export type InstantPressableHapticFeedback = false | 'light' | 'selection' | 'success' | 'warning';

type InstantPressableProps = Omit<PressableProps, 'children' | 'onPress' | 'style'> & {
  onPress?: (event: GestureResponderEvent) => void | Promise<void>;
  style?: StyleProp<ViewStyle> | ((state: InstantPressableRenderState) => StyleProp<ViewStyle>);
  children?: React.ReactNode | ((state: InstantPressableRenderState) => React.ReactNode);
  pressedScale?: number;
  pressedOpacity?: number;
  busyOpacity?: number;
  disableFeedback?: boolean;
  preventRepeatWhileBusy?: boolean;
  hapticFeedback?: InstantPressableHapticFeedback;
};

function triggerHapticFeedback(feedback: InstantPressableProps['hapticFeedback']) {
  if (!feedback) {
    return;
  }

  void import('expo-haptics')
    .then((Haptics) => {
      if (feedback === 'selection') {
        return Haptics.selectionAsync();
      }

      if (feedback === 'success' || feedback === 'warning') {
        return Haptics.notificationAsync(
          feedback === 'success'
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
        );
      }

      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    })
    .catch(() => undefined);
}

export function InstantPressable({
  accessibilityRole = 'button',
  accessibilityState,
  onPress,
  style,
  children,
  disabled = false,
  hitSlop = 8,
  pressedScale = 0.985,
  pressedOpacity = 0.9,
  busyOpacity = 0.72,
  disableFeedback = false,
  preventRepeatWhileBusy = true,
  hapticFeedback = false,
  ...rest
}: InstantPressableProps) {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const isDisabled = disabled || (preventRepeatWhileBusy && busy);

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (!onPress || disabled || (preventRepeatWhileBusy && busyRef.current)) {
        return;
      }

      event.persist?.();
      triggerHapticFeedback(hapticFeedback);
      const result = onPress(event);

      if (!isPromiseLike(result)) {
        return;
      }

      busyRef.current = true;
      setBusy(true);
      void result.then(
        () => {
          busyRef.current = false;
          setBusy(false);
        },
        () => {
          busyRef.current = false;
          setBusy(false);
        },
      );
    },
    [disabled, hapticFeedback, onPress, preventRepeatWhileBusy],
  );

  const renderStyle = useCallback(
    ({ pressed }: { pressed: boolean }) => {
      const state: InstantPressableRenderState = {
        pressed,
        busy,
        disabled: Boolean(isDisabled),
      };

      const baseStyle = typeof style === 'function' ? style(state) : style;

      if (disableFeedback) {
        return baseStyle;
      }

      return [
        baseStyle,
        pressed && !isDisabled
          ? { opacity: pressedOpacity, transform: [{ scale: pressedScale }] }
          : null,
        busy ? { opacity: busyOpacity } : null,
      ];
    },
    [busy, busyOpacity, disableFeedback, isDisabled, pressedOpacity, pressedScale, style],
  );

  return (
    <Pressable
      {...rest}
      accessibilityRole={accessibilityRole}
      accessibilityState={{
        ...accessibilityState,
        busy: busy || accessibilityState?.busy,
        disabled: Boolean(isDisabled || accessibilityState?.disabled),
      }}
      disabled={isDisabled}
      hitSlop={hitSlop}
      onPress={handlePress}
      style={renderStyle}
    >
      {(state) => {
        if (typeof children === 'function') {
          return children({ pressed: state.pressed, busy, disabled: Boolean(isDisabled) });
        }

        return children;
      }}
    </Pressable>
  );
}
