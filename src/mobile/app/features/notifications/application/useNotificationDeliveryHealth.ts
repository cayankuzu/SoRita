import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { resolvePushPermission } from '@/mobile/app/platform/notifications/pushPermission';
import {
  dismissBackgroundDeliveryTip,
  getRestrictiveMakerName,
  isBackgroundDeliveryTipDismissed,
} from '@/mobile/app/platform/notifications/pushReliability';

export type NotificationDeliveryHealth =
  | { kind: 'ok' }
  | { kind: 'blocked' }
  | { kind: 'background-tip'; maker: string };

/**
 * Whether push notifications can reach this phone: off at the system level,
 * or on a phone whose maker stops swiped-away apps. Checked again whenever
 * the app returns from the background, as it does after the settings.
 */
export function useNotificationDeliveryHealth() {
  const [health, setHealth] = useState<NotificationDeliveryHealth>({ kind: 'ok' });
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    let next: NotificationDeliveryHealth = { kind: 'ok' };

    try {
      const permission = await resolvePushPermission();
      const maker = getRestrictiveMakerName();
      if (!permission.granted) {
        next = { kind: 'blocked' };
      } else if (maker && !(await isBackgroundDeliveryTipDismissed())) {
        next = { kind: 'background-tip', maker };
      }
    } catch {
      // Unknown is not broken: show nothing rather than a false alarm.
    }

    if (mountedRef.current) {
      setHealth(next);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.remove();
    };
  }, [refresh]);

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  const dismissTip = useCallback(() => {
    setHealth({ kind: 'ok' });
    void dismissBackgroundDeliveryTip();
  }, []);

  return { dismissTip, health, openSettings };
}
