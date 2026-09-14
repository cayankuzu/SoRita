import { Platform } from 'react-native';

import { ensureAndroidPushChannel } from '@/mobile/app/data/repositories/pushNotificationRepository';
import { env } from '@/mobile/app/platform/config/env';
import { logger } from '@/mobile/app/platform/feedback/logger';
import {
  loadFirebaseMessagingModule,
  type FirebaseMessagingRemoteMessage,
} from '@/mobile/app/platform/notifications/firebaseMessaging';
import { notificationRuntime } from '@/mobile/app/platform/notifications/runtime';
import { resolvePushPermission } from '@/mobile/app/platform/notifications/pushPermission';
import { androidNotificationChannelId } from '@/mobile/app/platform/notifications/channels';

async function loadNotificationsModule() {
  return import('expo-notifications');
}

class SystemPushTokenAcquisitionError extends Error {
  constructor() {
    super('FCM token acquisition returned an empty token.');
    this.name = 'SystemPushTokenAcquisitionError';
  }
}

function getSystemNotificationFcmTopic() {
  return env.systemNotificationFcmTopic?.trim() || '';
}

export async function syncSystemPushNotifications() {
  if (!notificationRuntime.featureEnabled) {
    logger.info('push', 'FCM system push sync skipped because feature flag is disabled.');
    return null;
  }

  if (notificationRuntime.isExpoGo) {
    logger.info('push', 'FCM system push sync skipped in Expo Go.');
    return null;
  }

  if (!notificationRuntime.supportsRemotePushRegistration) {
    logger.info('push', 'FCM system push sync skipped because remote push is unavailable on this device.');
    return null;
  }

  const topic = getSystemNotificationFcmTopic();

  if (!topic) {
    logger.warn('push', 'FCM system topic is missing. System push sync skipped.');
    return null;
  }

  // Android 13 associates the runtime permission prompt with a notification
  // channel. Always create it before the shared Expo/FCM permission request.
  await ensureAndroidPushChannel();

  if (!(await resolvePushPermission({ requestIfPossible: true })).granted) {
    logger.info('push', 'FCM system push sync skipped because push permission is not granted.');
    return null;
  }

  const firebaseMessaging = await loadFirebaseMessagingModule();
  const messaging = firebaseMessaging.getMessaging();
  await firebaseMessaging.registerDeviceForRemoteMessages(messaging);
  const token = await firebaseMessaging.getToken(messaging);

  if (!token) {
    logger.warn('push', 'FCM token could not be resolved.');
    throw new SystemPushTokenAcquisitionError();
  }

  await firebaseMessaging.subscribeToTopic(messaging, topic);
  logger.info('push', `FCM system topic subscribed: ${topic}`);

  return token;
}

export async function unregisterSystemPushNotifications() {
  if (!notificationRuntime.featureEnabled || notificationRuntime.isExpoGo) {
    return;
  }

  const topic = getSystemNotificationFcmTopic();

  if (!topic) {
    return;
  }

  const firebaseMessaging = await loadFirebaseMessagingModule();
  const messaging = firebaseMessaging.getMessaging();
  await firebaseMessaging.unsubscribeFromTopic(messaging, topic);
  logger.info('push', `FCM system topic unsubscribed: ${topic}`);
}

export async function presentForegroundSystemPushNotification(
  remoteMessage: FirebaseMessagingRemoteMessage,
) {
  if (!notificationRuntime.supportsNotificationObservers) {
    return;
  }

  const title = remoteMessage.notification?.title?.trim() || 'SoRita';
  const body = remoteMessage.notification?.body?.trim() || 'Yeni sistem bildirimi';
  const Notifications = await loadNotificationsModule();

  await ensureAndroidPushChannel();

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      // Provider data may contain content that should not be persisted in a
      // local notification. System taps only need the stable source marker.
      data: { source: 'system-fcm' },
      sound: 'default',
    },
    trigger: Platform.OS === 'android'
      ? {
          channelId: androidNotificationChannelId,
        }
      : null,
  });
}
