import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { Pressable } from 'react-native';

import { isPromiseLike } from '@/mobile/app/shared/utils/interaction';

type InstantPressableRenderState = {
  pressed: boolean;
  busy: boolean;
  disabled: boolean;
};

type InstantPressableProps = Omit<PressableProps, 'children' | 'onPress' | 'style'> & {
  onPress?: (event: GestureResponderEvent) => void | Promise<void>;
  style?: StyleProp<ViewStyle> | ((state: InstantPressableRenderState) => StyleProp<ViewStyle>);
  children?: React.ReactNode | ((state: InstantPressableRenderState) => React.ReactNode);
  pressedScale?: number;
  pressedOpacity?: number;
  busyOpacity?: number;
  disableFeedback?: boolean;
  preventRepeatWhileBusy?: boolean;
  minimumBusyMs?: number;
};

export function InstantPressable({
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
  minimumBusyMs = 120,
  ...rest
}: InstantPressableProps) {
  const [busy, setBusy] = useState(false);
  const busyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDisabled = disabled || (preventRepeatWhileBusy && busy);

  useEffect(
    () => () => {
      if (busyTimeoutRef.current) {
        clearTimeout(busyTimeoutRef.current);
      }
    },
    [],
  );

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (!onPress || isDisabled) {
        return;
      }

      event.persist?.();
      const pressStartedAt = Date.now();
      const finishPress = () => {
        const remainingBusyMs = Math.max(0, minimumBusyMs - (Date.now() - pressStartedAt));

        if (busyTimeoutRef.current) {
          clearTimeout(busyTimeoutRef.current);
          busyTimeoutRef.current = null;
        }

        if (remainingBusyMs === 0) {
          setBusy(false);
          return;
        }

        busyTimeoutRef.current = setTimeout(() => {
          busyTimeoutRef.current = null;
          setBusy(false);
        }, remainingBusyMs);
      };

      const result = onPress(event);

      if (!isPromiseLike(result)) {
        return;
      }

      setBusy(true);
      void result.finally(finishPress);
    },
    [isDisabled, minimumBusyMs, onPress],
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

  const content = useMemo(() => {
    if (typeof children === 'function') {
      return children({ pressed: false, busy, disabled: Boolean(isDisabled) });
    }

    return children;
  }, [busy, children, isDisabled]);

  return (
    <Pressable {...rest} disabled={isDisabled} hitSlop={hitSlop} onPress={handlePress} style={renderStyle}>
      {(state) => {
        if (typeof children === 'function') {
          return children({ pressed: state.pressed, busy, disabled: Boolean(isDisabled) });
        }

        return content;
      }}
    </Pressable>
  );
}
