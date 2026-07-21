import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { useReduceMotion } from '@/mobile/app/shared/hooks/useReduceMotion';
import {
  colors,
  contentWidth,
  elevation,
  iconSize,
  motion,
  radius,
  spacing,
  typography,
} from '@/mobile/app/shared/theme/tokens';
import {
  subscribeToToasts,
  type AppToast,
  type ToastKind,
} from '@/mobile/app/platform/feedback/toast';

const TOAST_DURATION_MS = 3_200;
const ERROR_TOAST_DURATION_MS = 4_800;

const palettes: Record<ToastKind, { background: string; border: string; icon: string }> = {
  success: {
    background: colors.successBg,
    border: colors.successBorder,
    icon: colors.secondary,
  },
  error: {
    background: colors.dangerBg,
    border: colors.dangerBorder,
    icon: colors.danger,
  },
  info: {
    background: colors.primaryBg,
    border: colors.infoBorder,
    icon: colors.primary,
  },
};

function ToastIcon({ kind }: { kind: ToastKind }) {
  const props = { color: palettes[kind].icon, size: iconSize.md };
  if (kind === 'success') return <CheckCircle2 {...props} />;
  if (kind === 'error') return <AlertCircle {...props} />;
  return <Info {...props} />;
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [toast, setToast] = useState<AppToast | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-spacing.md)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearDismissTimer();
    if (reduceMotion) {
      setToast(null);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        duration: motion.fast,
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        duration: motion.fast,
        toValue: -spacing.sm,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setToast(null);
    });
  }, [clearDismissTimer, opacity, reduceMotion, translateY]);

  useEffect(() => {
    return subscribeToToasts((nextToast) => {
      clearDismissTimer();
      opacity.stopAnimation();
      translateY.stopAnimation();
      setToast(nextToast);
      opacity.setValue(reduceMotion ? 1 : 0);
      translateY.setValue(reduceMotion ? 0 : -spacing.md);

      if (!reduceMotion) {
        Animated.parallel([
          Animated.timing(opacity, {
            duration: motion.standard,
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            duration: motion.standard,
            toValue: 0,
            useNativeDriver: true,
          }),
        ]).start();
      }

      dismissTimerRef.current = setTimeout(
        dismiss,
        nextToast.kind === 'error' ? ERROR_TOAST_DURATION_MS : TOAST_DURATION_MS,
      );
    });
  }, [clearDismissTimer, dismiss, opacity, reduceMotion, translateY]);

  useEffect(() => clearDismissTimer, [clearDismissTimer]);

  if (!toast) return null;

  const palette = palettes[toast.kind];
  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingTop: insets.top + spacing.sm }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[
          styles.toast,
          {
            backgroundColor: palette.background,
            borderColor: palette.border,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ToastIcon kind={toast.kind} />
        </View>
        <Text style={styles.message}>{toast.message}</Text>
        <IconButton accessibilityLabel={tr.common.close} onPress={dismiss} size="sm">
          <X color={colors.textMuted} size={iconSize.sm} />
        </IconButton>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    zIndex: 1000,
  },
  toast: {
    ...elevation.floating,
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    maxWidth: contentWidth.form,
    minHeight: 48,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  message: {
    ...typography.captionText,
    color: colors.text,
    flex: 1,
    fontWeight: '700',
  },
});
