import { useCallback } from 'react';
import { Platform } from 'react-native';

type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Haptics: any = null;

try {
  // Graceful: expo-haptics is optional; if not installed, haptic calls are no-ops
  Haptics = require('expo-haptics');
} catch {
  Haptics = null;
}

export function triggerHaptic(style: HapticStyle = 'light') {
  if (!Haptics || Platform.OS === 'web') {
    return;
  }

  const impactStyles: Record<string, number | undefined> = {
    light: Haptics.ImpactFeedbackStyle?.Light,
    medium: Haptics.ImpactFeedbackStyle?.Medium,
    heavy: Haptics.ImpactFeedbackStyle?.Heavy,
  };

  const notificationTypes: Record<string, number | undefined> = {
    success: Haptics.NotificationFeedbackType?.Success,
    warning: Haptics.NotificationFeedbackType?.Warning,
    error: Haptics.NotificationFeedbackType?.Error,
  };

  const impact = impactStyles[style];

  if (impact !== undefined) {
    void Haptics.impactAsync(impact);
    return;
  }

  const notification = notificationTypes[style];

  if (notification !== undefined) {
    void Haptics.notificationAsync(notification);
  }
}

export function useHaptic(style: HapticStyle = 'light') {
  return useCallback(() => {
    triggerHaptic(style);
  }, [style]);
}
