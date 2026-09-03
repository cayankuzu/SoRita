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
import {
  clearPushTokenCleanupTombstone,
  flushPendingPushTokenCleanupTombstones,
  getActivePushTokenCleanupCapability,
  rememberActivePushTokenCleanupCapability,
  stagePushTokenCleanupTombstone,
  type PushTokenCleanupCapability,
} from '@/mobile/app/platform/notifications/pushTokenCleanup';
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

async function getExistingPushPermissionState(): Promise<PushPermissionResult> {
  const Notifications = await loadNotificationsModule();
  return buildPushPermissionResult(
    await Notifications.getPermissionsAsync(),
    Notifications,
  );
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
  const capability = await rememberActivePushTokenCleanupCapability(expoPushToken);
  const { error } = await supabase.rpc('upsert_user_push_token', {
    input_cleanup_secret: capability.cleanupSecret,
    input_token: expoPushToken,
    input_platform: Platform.OS,
  });

  if (error) {
    // Do not leave a locally remembered capability for a token whose server
    // binding failed. A future successful registration will create a fresh one.
    await clearPushTokenCleanupTombstone(capability).catch(() => undefined);
    throw error;
  }

  logger.info('push', `Push token registered for ${userId}`);
  return expoPushToken;
}

async function resolveActiveOrCurrentPushTokenCapability() {
  const activeCapability = await getActivePushTokenCleanupCapability();

  if (activeCapability) {
    return activeCapability;
  }

  const token = await resolveCurrentExpoPushToken();

  if (!token) {
    return null;
  }

  // Devices upgrading from the pre-capability client bind an existing token
  // while the authenticated session is still valid, before allowing logout.
  const capability = await rememberActivePushTokenCleanupCapability(token);
  const { error } = await supabase.rpc('upsert_user_push_token', {
    input_cleanup_secret: capability.cleanupSecret,
    input_platform: Platform.OS,
    input_token: token,
  });

  if (error) {
    throw error;
  }

  return capability;
}

/**
 * Persist a revocation capability before local auth state can be discarded.
 * If this cannot be durably stored/bound, callers must not complete logout.
 */
export async function preparePushNotificationLogoutCleanup() {
  if (notificationRuntime.isExpoGo || !notificationRuntime.featureEnabled) {
    return null;
  }

  const capability = await resolveActiveOrCurrentPushTokenCapability();

  if (!capability) {
    return null;
  }

  await stagePushTokenCleanupTombstone(capability);
  return capability;
}

async function stageProvidedPushTokenCleanup(token: string | null | undefined) {
  if (!token) {
    return null;
  }

  const activeCapability = await getActivePushTokenCleanupCapability();

  if (!activeCapability || activeCapability.token !== token) {
    return null;
  }

  await stagePushTokenCleanupTombstone(activeCapability);
  return activeCapability;
}

/**
 * Capture the capability for the token currently associated with this device
 * before a different authenticated account can bind it. Unlike logout this
 * never resolves or re-binds a token: callers use it only when they already
 * know the previously registered token.
 */
export async function prepareRegisteredPushTokenAccountSwitchCleanup(
  token: string | null | undefined,
) {
  return stageProvidedPushTokenCleanup(token);
}

/**
 * Used by auth lifecycle transitions where the old session may already be
 * gone. It never resolves/re-binds a token under the next account; it only
 * stages a capability that was already bound by a prior registration.
 */
export async function stageActivePushTokenCleanupForAuthTransition() {
  const activeCapability = await getActivePushTokenCleanupCapability();

  if (!activeCapability) {
    return null;
  }

  await stagePushTokenCleanupTombstone(activeCapability);
  return activeCapability;
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

  // Registration runs during startup/foreground recovery and therefore must
  // never open an OS permission prompt. A user-initiated product surface may
  // request permission separately; this background path only observes the
  // current state and registers when permission already exists.
  const permissions = await getExistingPushPermissionState();

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

  const capability = await stageProvidedPushTokenCleanup(token);

  const { error } = await supabase.rpc('remove_user_push_token', {
    input_token: token,
  });

  if (error) {
    throw error;
  }

  if (capability) {
    await clearPushTokenCleanupTombstone(capability);
  }

  logger.info('push', 'Push token unregistered');
}

export async function unregisterAllPushNotifications(preparedCapability?: PushTokenCleanupCapability | null) {
  if (notificationRuntime.isExpoGo || !notificationRuntime.featureEnabled) {
    return;
  }

  const capability = preparedCapability ?? await preparePushNotificationLogoutCleanup();
  const { error } = await supabase.rpc('remove_all_user_push_tokens');

  if (error) {
    throw error;
  }

  if (capability) {
    await clearPushTokenCleanupTombstone(capability);
  }

  logger.info('push', 'All push tokens unregistered for the current user');
}

export { flushPendingPushTokenCleanupTombstones };
