import type { DevicePushToken } from 'expo-notifications';
import { Platform } from 'react-native';

import { logger } from '@/mobile/app/platform/feedback/logger';
import { ensureAndroidPushChannel } from '@/mobile/app/platform/notifications/androidPushChannel';
import { notificationRuntime } from '@/mobile/app/platform/notifications/runtime';
import { resolvePushPermission } from '@/mobile/app/platform/notifications/pushPermission';
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

let pushRegistrationMutationQueue: Promise<void> = Promise.resolve();

class PushTokenAcquisitionError extends Error {
  constructor() {
    super('Expo push token acquisition returned an empty token.');
    this.name = 'PushTokenAcquisitionError';
  }
}

async function loadNotificationsModule() {
  return import('expo-notifications');
}

export { ensureAndroidPushChannel };

function getExpoProjectId() {
  return env.expoProjectId || null;
}

async function resolveCurrentExpoPushToken() {
  const projectId = getExpoProjectId();

  if (!projectId || notificationRuntime.isExpoGo || !notificationRuntime.supportsRemotePushRegistration) {
    return null;
  }

  const permissions = await resolvePushPermission();

  if (!permissions.granted) {
    return null;
  }

  const Notifications = await loadNotificationsModule();
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data || null;
}

function withPushRegistrationMutation<T>(operation: () => Promise<T>) {
  const result = pushRegistrationMutationQueue.then(operation, operation);
  pushRegistrationMutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function upsertExpoPushToken(_userId: string, expoPushToken: string) {
  return withPushRegistrationMutation(async () => {
    const previousCapability = await getActivePushTokenCleanupCapability();
    const reusesExistingCapability = previousCapability?.token === expoPushToken;

    if (previousCapability && !reusesExistingCapability) {
      await stagePushTokenCleanupTombstone(previousCapability);
    }

    const capability = reusesExistingCapability
      ? previousCapability
      : await rememberActivePushTokenCleanupCapability(expoPushToken);

    try {
      const { error } = await supabase.rpc('upsert_user_push_token', {
        input_cleanup_secret: capability.cleanupSecret,
        input_token: expoPushToken,
        input_platform: Platform.OS,
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      if (!reusesExistingCapability) {
        await clearPushTokenCleanupTombstone(capability).catch(() => undefined);

        if (previousCapability) {
          // The previous server binding is still authoritative because the new
          // upsert failed. Remove the staged rotation tombstone before
          // restoring it as active, otherwise the next cleanup pass would
          // revoke the valid token and permanently block registration retries.
          await clearPushTokenCleanupTombstone(previousCapability).catch(() => undefined);
          await rememberActivePushTokenCleanupCapability(
            previousCapability.token,
            previousCapability.cleanupSecret,
          ).catch(() => undefined);
        }
      }

      throw error;
    }

    if (previousCapability && !reusesExistingCapability) {
      // Registration of the new token is already durable. Old-token cleanup is
      // best effort and retains its secure tombstone across offline failures.
      await flushPendingPushTokenCleanupTombstones().catch(() => undefined);
    }

    logger.info('push', 'Push token registered');
    return expoPushToken;
  });
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

  const permissions: PushPermissionResult = await resolvePushPermission({
    requestIfPossible: true,
  });

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
    throw new PushTokenAcquisitionError();
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

  // A native token refresh is not permission to resurrect a server binding
  // after the user has disabled notifications. This is deliberately read-only:
  // only the interactive registration path may display the OS prompt.
  const permissions = await resolvePushPermission();

  if (!permissions.granted) {
    logger.warn('push', 'Push token refresh ignored because notification permission is not granted.');
    return null;
  }

  const Notifications = await loadNotificationsModule();
  const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId, devicePushToken })).data;

  if (!expoPushToken) {
    logger.warn('push', 'Expo push token could not be resolved.');
    throw new PushTokenAcquisitionError();
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
