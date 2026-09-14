import { Platform } from 'react-native';

import {
  androidNotificationChannelDescription,
  androidNotificationChannelId,
  androidNotificationChannelName,
} from '@/mobile/app/platform/notifications/channels';

/**
 * Creates the stable Android channel before any Android 13 notification
 * permission prompt or notification delivery attempt.
 */
export async function ensureAndroidPushChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  const Notifications = await import('expo-notifications');

  await Notifications.setNotificationChannelAsync(androidNotificationChannelId, {
    description: androidNotificationChannelDescription,
    name: androidNotificationChannelName,
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 150, 250],
    lightColor: '#3b82f6',
    bypassDnd: false,
    enableLights: true,
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    showBadge: true,
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.NOTIFICATION_COMMUNICATION_INSTANT,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      flags: {
        enforceAudibility: false,
        requestHardwareAudioVideoSynchronization: false,
      },
    },
  });
}
