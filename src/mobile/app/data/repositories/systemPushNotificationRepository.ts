import { Platform } from 'react-native';
import type { NotificationPermissionsStatus } from 'expo-notifications';

import { ensureAndroidPushChannel } from '@/mobile/app/data/repositories/pushNotificationRepository';
import { env } from '@/mobile/app/platform/config/env';
import { logger } from '@/mobile/app/platform/feedback/logger';
import {
  loadFirebaseMessagingModule,
  type FirebaseMessagingRemoteMessage,
} from '@/mobile/app/platform/notifications/firebaseMessaging';
import { notificationRuntime } from '@/mobile/app/platform/notifications/runtime';
import { androidNotificationChannelId } from '@/mobile/app/platform/notifications/channels';

async function loadNotificationsModule() {
  return import('expo-notifications');
}

function allowsIosDelivery(
  permissions: NotificationPermissionsStatus,
  Notifications: Awaited<ReturnType<typeof loadNotificationsModule>>,
) {
  return (
    permissions.granted ||
    permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    permissions.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

async function hasGrantedPushPermission() {
  const Notifications = await loadNotificationsModule();
  const permissions = await Notifications.getPermissionsAsync();

  if (Platform.OS === 'ios') {
    return allowsIosDelivery(permissions, Notifications);
  }

  return permissions.granted;
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

  if (!await hasGrantedPushPermission()) {
    logger.info('push', 'FCM system push sync skipped because push permission is not granted.');
    return null;
  }

  await ensureAndroidPushChannel();

  const firebaseMessaging = (await loadFirebaseMessagingModule())();

  if (typeof firebaseMessaging.registerDeviceForRemoteMessages === 'function') {
    await firebaseMessaging.registerDeviceForRemoteMessages();
  }

  const token = await firebaseMessaging.getToken();

  if (!token) {
    logger.warn('push', 'FCM token could not be resolved.');
    return null;
  }

  await firebaseMessaging.subscribeToTopic(topic);
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

  const firebaseMessaging = (await loadFirebaseMessagingModule())();
  await firebaseMessaging.unsubscribeFromTopic(topic);
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
      data: {
        ...remoteMessage.data,
        source: 'system-fcm',
      },
      sound: 'default',
    },
    trigger: Platform.OS === 'android'
      ? {
          channelId: androidNotificationChannelId,
        }
      : null,
  });
}
