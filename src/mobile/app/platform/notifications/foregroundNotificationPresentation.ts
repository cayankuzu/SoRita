import * as Notifications from 'expo-notifications';

import { ensureAndroidPushChannel } from '@/mobile/app/platform/notifications/androidPushChannel';
import { notificationRuntime } from '@/mobile/app/platform/notifications/runtime';

let notificationPresentationPromise: Promise<void> | null = null;

/**
 * Installs the foreground handler synchronously on first invocation. The
 * Android channel can finish asynchronously, but no remote notification has to
 * wait for a deferred React host before Expo knows how to present it.
 */
export async function ensureForegroundNotificationPresentation() {
  if (!notificationRuntime.supportsNotificationObservers) {
    return;
  }

  if (!notificationPresentationPromise) {
    notificationPresentationPromise = (async () => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        }),
      });

      await ensureAndroidPushChannel();
    })();
  }

  const presentationPromise = notificationPresentationPromise;

  try {
    await presentationPromise;
  } catch (error) {
    if (notificationPresentationPromise === presentationPromise) {
      notificationPresentationPromise = null;
    }

    throw error;
  }
}

export const foregroundNotificationPresentationInternals = {
  resetForTests() {
    notificationPresentationPromise = null;
  },
};
