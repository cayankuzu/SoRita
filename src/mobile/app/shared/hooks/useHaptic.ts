import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';

type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export function triggerHaptic(style: HapticStyle = 'light') {
  const impactStyles: Partial<Record<HapticStyle, Haptics.ImpactFeedbackStyle>> = {
    light: Haptics.ImpactFeedbackStyle?.Light,
    medium: Haptics.ImpactFeedbackStyle?.Medium,
    heavy: Haptics.ImpactFeedbackStyle?.Heavy,
  };

  const notificationTypes: Partial<Record<HapticStyle, Haptics.NotificationFeedbackType>> = {
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
