import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';

import {
  subscribeToInAppPushBanners,
  type InAppPushBanner,
} from '@/mobile/app/platform/notifications/inAppPushBanner';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { useReduceMotion } from '@/mobile/app/shared/hooks/useReduceMotion';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  contentWidth,
  controlSize,
  elevation,
  fontWeight,
  iconSize,
  motion,
  radius,
  spacing,
  textStyle,
  zIndex,
} from '@/mobile/app/shared/theme/tokens';

const BANNER_DURATION_MS = 4_500;
// An upward drag past this, or a quick flick, puts the banner away.
const SWIPE_DISMISS_DISTANCE = spacing['2xl'];
const SWIPE_DISMISS_VELOCITY = 0.5;
const SWIPE_START_DISTANCE = spacing.xs;

/**
 * The banner a push shows while the app is open: who did what, over the top
 * of any screen, the way Instagram shows one. A tap opens what it is about;
 * an upward swipe or a few seconds put it away.
 */
export function InAppPushBannerHost() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [banner, setBanner] = useState<InAppPushBanner | null>(null);
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hiddenOffsetRef = useRef(-(insets.top + controlSize.large * 2));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    if (reduceMotion) {
      setBanner(null);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, { duration: motion.fast, toValue: 0, useNativeDriver: true }),
      Animated.timing(translateY, {
        duration: motion.fast,
        toValue: hiddenOffsetRef.current,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setBanner(null);
      }
    });
  }, [clearTimer, opacity, reduceMotion, translateY]);

  const scheduleHide = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(hide, BANNER_DURATION_MS);
  }, [clearTimer, hide]);

  useEffect(
    () =>
      subscribeToInAppPushBanners((next) => {
        opacity.stopAnimation();
        translateY.stopAnimation();
        setBanner(next);
        opacity.setValue(reduceMotion ? 1 : 0);
        translateY.setValue(reduceMotion ? 0 : hiddenOffsetRef.current);
        if (!reduceMotion) {
          Animated.parallel([
            Animated.timing(opacity, { duration: motion.standard, toValue: 1, useNativeDriver: true }),
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
          ]).start();
        }
        void import('expo-haptics')
          .then((Haptics) => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
          .catch(() => undefined);
        scheduleHide();
      }),
    [opacity, reduceMotion, scheduleHide, translateY],
  );

  useEffect(() => clearTimer, [clearTimer]);

  const settleBack = useCallback(() => {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
    scheduleHide();
  }, [scheduleHide, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dy < -SWIPE_START_DISTANCE && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: clearTimer,
        onPanResponderMove: (_event, gesture) => {
          translateY.setValue(Math.min(0, gesture.dy));
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy < -SWIPE_DISMISS_DISTANCE || gesture.vy < -SWIPE_DISMISS_VELOCITY) {
            hide();
            return;
          }
          settleBack();
        },
        onPanResponderTerminate: settleBack,
      }),
    [clearTimer, hide, settleBack, translateY],
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      hiddenOffsetRef.current = -(event.nativeEvent.layout.height + insets.top + spacing.lg);
    },
    [insets.top],
  );

  if (!banner) {
    return null;
  }

  const open = () => {
    hide();
    banner.onPress();
  };

  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingTop: insets.top + spacing.xs }]}>
      <Animated.View
        {...panResponder.panHandlers}
        onLayout={handleLayout}
        style={[styles.frame, { opacity, transform: [{ translateY }] }]}
      >
        <InstantPressable
          accessibilityActions={[{ label: tr.common.close, name: 'escape' }]}
          accessibilityHint={tr.notifications.openHint}
          accessibilityLabel={`${banner.title}. ${banner.body}`}
          accessibilityLiveRegion="polite"
          accessibilityRole="button"
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'escape') {
              hide();
            }
          }}
          onPress={open}
          pressedScale={0.98}
          style={styles.card}
          testID="in-app-push-banner"
        >
          <View style={styles.iconWrap}>
            <Bell color={colors.primary} size={iconSize.md} />
          </View>
          <View style={styles.text}>
            <AppText numberOfLines={1} style={styles.title}>
              {banner.title}
            </AppText>
            <AppText numberOfLines={2} style={styles.body}>
              {banner.body}
            </AppText>
          </View>
        </InstantPressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    zIndex: zIndex.system,
  },
  frame: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  card: {
    ...elevation.floating,
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    maxWidth: contentWidth.form,
    minHeight: controlSize.large + spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderRadius: radius.pill,
    height: controlSize.icon,
    justifyContent: 'center',
    width: controlSize.icon,
  },
  text: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: textStyle('bodyText', colors.text, fontWeight.strong),
  body: textStyle('bodyText', colors.textMuted),
});
