import { Platform } from 'react-native';

import { logger } from '@/mobile/app/platform/feedback/logger';
import { notificationRuntime } from '@/mobile/app/platform/notifications/runtime';
import { env } from '@/mobile/app/platform/config/env';
import { supabase } from '@/mobile/app/platform/supabase/client';

type PushPermissionResult = {
  granted: boolean;
  canAskAgain: boolean;
};

async function loadNotificationsModule() {
  return import('expo-notifications');
}

async function ensureAndroidPushChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  const Notifications = await loadNotificationsModule();

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Varsayilan',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 150, 250],
    lightColor: '#3b82f6',
    sound: 'default',
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
  });
}

async function getPushPermissionState(): Promise<PushPermissionResult> {
  const Notifications = await loadNotificationsModule();
  const existingPermissions = await Notifications.getPermissionsAsync();

  if (existingPermissions.granted || existingPermissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return {
      granted: true,
      canAskAgain: existingPermissions.canAskAgain,
    };
  }

  const requestedPermissions = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return {
    granted:
      requestedPermissions.granted ||
      requestedPermissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL,
    canAskAgain: requestedPermissions.canAskAgain,
  };
}

function getExpoProjectId() {
  return env.expoProjectId || null;
}

async function resolveCurrentExpoPushToken() {
  const projectId = getExpoProjectId();

  if (!projectId || notificationRuntime.isExpoGo || !notificationRuntime.supportsRemotePushRegistration) {
    return null;
  }

  const Notifications = await loadNotificationsModule();
  const permissions = await Notifications.getPermissionsAsync();

  if (!permissions.granted && permissions.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return null;
  }

  return (await Notifications.getExpoPushTokenAsync({ projectId })).data || null;
}

export async function registerPushNotifications(userId: string) {
  if (!notificationRuntime.featureEnabled) {
    logger.info('push', 'Push registration skipped because feature flag is disabled.');
    return null;
  }

  if (notificationRuntime.isExpoGo) {
    logger.info('push', 'Push registration skipped in Expo Go.');
    return null;
  }

  if (!notificationRuntime.supportsRemotePushRegistration) {
    logger.info('push', 'Push registration skipped because remote push is unavailable on this device.');
    return null;
  }

  await ensureAndroidPushChannel();

  const projectId = getExpoProjectId();

  if (!projectId) {
    logger.warn('push', 'Expo project id is missing. Push token registration skipped.');
    return null;
  }

  const permissions = await getPushPermissionState();

  if (!permissions.granted) {
    logger.warn('push', 'Push notification permission was not granted.');
    return null;
  }

  const Notifications = await loadNotificationsModule();
  const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  if (!expoPushToken) {
    logger.warn('push', 'Expo push token could not be resolved.');
    return null;
  }

  const { error } = await supabase.rpc('upsert_user_push_token', {
    input_token: expoPushToken,
    input_platform: Platform.OS,
  });

  if (error) {
    throw error;
  }

  logger.info('push', `Push token registered for ${userId}`);
  return expoPushToken;
}

export async function unregisterPushNotifications(expoPushToken: string | null | undefined) {
  if (notificationRuntime.isExpoGo || !notificationRuntime.featureEnabled) {
    return;
  }

  const token = expoPushToken || await resolveCurrentExpoPushToken();

  if (!token) {
    return;
  }

  const { error } = await supabase.rpc('remove_user_push_token', {
    input_token: token,
  });

  if (error) {
    throw error;
  }

  logger.info('push', 'Push token unregistered');
}
