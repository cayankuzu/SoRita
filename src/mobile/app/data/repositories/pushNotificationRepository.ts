import type {
  DevicePushToken,
  NotificationPermissionsStatus,
} from 'expo-notifications';
import { Platform } from 'react-native';

import { logger } from '@/mobile/app/platform/feedback/logger';
import { notificationRuntime } from '@/mobile/app/platform/notifications/runtime';
import {
  androidNotificationChannelDescription,
  androidNotificationChannelId,
  androidNotificationChannelName,
} from '@/mobile/app/platform/notifications/channels';
import { env } from '@/mobile/app/platform/config/env';
import { supabase } from '@/mobile/app/platform/supabase/client';

type PushPermissionResult = {
  granted: boolean;
  allowsInterruptions: boolean;
  canAskAgain: boolean;
};

async function loadNotificationsModule() {
  return import('expo-notifications');
}

export async function ensureAndroidPushChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  const Notifications = await loadNotificationsModule();

  await Notifications.setNotificationChannelAsync(androidNotificationChannelId, {
    description: androidNotificationChannelDescription,
    name: androidNotificationChannelName,
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 150, 250],
    lightColor: '#3b82f6',
    bypassDnd: false,
    enableLights: true,
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
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

function allowsIosInterruptions(
  permissions: NotificationPermissionsStatus,
  Notifications: Awaited<ReturnType<typeof loadNotificationsModule>>,
) {
  const iosPermissions = permissions.ios;

  if (!iosPermissions) {
    return permissions.granted;
  }

  return (
    iosPermissions.status === Notifications.IosAuthorizationStatus.AUTHORIZED &&
    iosPermissions.allowsAlert !== false &&
    iosPermissions.allowsSound !== false &&
    iosPermissions.allowsDisplayOnLockScreen !== false &&
    iosPermissions.allowsDisplayInNotificationCenter !== false
  );
}

function buildPushPermissionResult(
  permissions: NotificationPermissionsStatus,
  Notifications: Awaited<ReturnType<typeof loadNotificationsModule>>,
): PushPermissionResult {
  const granted =
    Platform.OS === 'ios'
      ? allowsIosDelivery(permissions, Notifications)
      : permissions.granted;
  const allowsInterruptions =
    Platform.OS === 'ios'
      ? allowsIosInterruptions(permissions, Notifications)
      : permissions.granted;

  return {
    granted,
    allowsInterruptions,
    canAskAgain: permissions.canAskAgain,
  };
}

async function getPushPermissionState(): Promise<PushPermissionResult> {
  const Notifications = await loadNotificationsModule();
  const existingPermissions = buildPushPermissionResult(
    await Notifications.getPermissionsAsync(),
    Notifications,
  );

  if (existingPermissions.granted && existingPermissions.allowsInterruptions) {
    return existingPermissions;
  }

  if (!existingPermissions.canAskAgain) {
    return existingPermissions;
  }

  const requestedPermissions = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowProvisional: false,
      provideAppNotificationSettings: true,
    },
  });

  return buildPushPermissionResult(requestedPermissions, Notifications);
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
  const permissions = buildPushPermissionResult(
    await Notifications.getPermissionsAsync(),
    Notifications,
  );

  if (!permissions.granted) {
    return null;
  }

  return (await Notifications.getExpoPushTokenAsync({ projectId })).data || null;
}

async function upsertExpoPushToken(userId: string, expoPushToken: string) {
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

  if (Platform.OS === 'ios' && !permissions.allowsInterruptions) {
    logger.warn(
      'push',
      'iOS notification permission is limited. Notifications may arrive quietly until alerts, sounds, lock screen, and notification center are enabled in Settings.',
    );
  }

  const Notifications = await loadNotificationsModule();
  const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  if (!expoPushToken) {
    logger.warn('push', 'Expo push token could not be resolved.');
    return null;
  }

  return upsertExpoPushToken(userId, expoPushToken);
}

export async function registerDevicePushToken(userId: string, devicePushToken: DevicePushToken) {
  if (!notificationRuntime.featureEnabled || notificationRuntime.isExpoGo || !notificationRuntime.supportsRemotePushRegistration) {
    return null;
  }

  await ensureAndroidPushChannel();

  const projectId = getExpoProjectId();

  if (!projectId) {
    logger.warn('push', 'Expo project id is missing. Push token registration skipped.');
    return null;
  }

  const Notifications = await loadNotificationsModule();
  const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId, devicePushToken })).data;

  if (!expoPushToken) {
    logger.warn('push', 'Expo push token could not be resolved.');
    return null;
  }

  return upsertExpoPushToken(userId, expoPushToken);
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

export async function unregisterAllPushNotifications() {
  if (notificationRuntime.isExpoGo || !notificationRuntime.featureEnabled) {
    return;
  }

  const { error } = await supabase.rpc('remove_all_user_push_tokens');

  if (error) {
    throw error;
  }

  logger.info('push', 'All push tokens unregistered for the current user');
}
