import type { NotificationPermissionsStatus } from 'expo-notifications';
import { AppState, Platform } from 'react-native';

export type PushPermissionState = {
  allowsInterruptions: boolean;
  canAskAgain: boolean;
  granted: boolean;
};

type ResolvePushPermissionOptions = {
  requestIfPossible?: boolean;
};

let permissionPromptAttempted = false;
let permissionRequestPromise: Promise<PushPermissionState> | null = null;
let notificationsModulePromise: Promise<typeof import('expo-notifications')> | null = null;

function loadNotificationsModule() {
  notificationsModulePromise ??= import('expo-notifications').catch((error) => {
    notificationsModulePromise = null;
    throw error;
  });
  return notificationsModulePromise;
}

function allowsIosDelivery(
  permissions: NotificationPermissionsStatus,
  Notifications: Awaited<ReturnType<typeof loadNotificationsModule>>,
) {
  const iosStatus = permissions.ios?.status;

  if (iosStatus == null) {
    return permissions.granted;
  }

  return (
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED
    || iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL
    || iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
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
    iosPermissions.status === Notifications.IosAuthorizationStatus.AUTHORIZED
    && iosPermissions.allowsAlert !== false
    && iosPermissions.allowsSound !== false
    && iosPermissions.allowsDisplayOnLockScreen !== false
    && iosPermissions.allowsDisplayInNotificationCenter !== false
  );
}

export function normalizePushPermissionState(
  permissions: NotificationPermissionsStatus,
  Notifications: Awaited<ReturnType<typeof loadNotificationsModule>>,
): PushPermissionState {
  const granted = Platform.OS === 'ios'
    ? allowsIosDelivery(permissions, Notifications)
    : permissions.granted;

  return {
    allowsInterruptions: Platform.OS === 'ios'
      ? allowsIosInterruptions(permissions, Notifications)
      : permissions.granted,
    canAskAgain: permissions.canAskAgain,
    granted,
  };
}

function canShowPermissionPrompt() {
  return AppState.currentState === 'active';
}

/**
 * Reads the device-global notification permission and, from an interactive app
 * session only, may issue one OS prompt per JavaScript process. Concurrent Expo
 * and FCM registration paths share the same prompt promise.
 */
export async function resolvePushPermission(
  options: ResolvePushPermissionOptions = {},
): Promise<PushPermissionState> {
  const Notifications = await loadNotificationsModule();
  const current = normalizePushPermissionState(
    await Notifications.getPermissionsAsync(),
    Notifications,
  );

  if (
    current.granted
    || !current.canAskAgain
    || !options.requestIfPossible
    || !canShowPermissionPrompt()
  ) {
    return current;
  }

  if (permissionRequestPromise) {
    return permissionRequestPromise;
  }

  if (permissionPromptAttempted) {
    return current;
  }

  permissionPromptAttempted = true;
  const requestedPermissions = Platform.OS === 'ios'
    ? {
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      }
    : undefined;

  const request = Notifications.requestPermissionsAsync(requestedPermissions)
    .then((permissions) => normalizePushPermissionState(permissions, Notifications))
    .catch((error) => {
      // A native/module failure is not a user denial. Let foreground/network
      // recovery make another attempt later in the same process.
      permissionPromptAttempted = false;
      throw error;
    })
    .finally(() => {
      if (permissionRequestPromise === request) {
        permissionRequestPromise = null;
      }
    });

  permissionRequestPromise = request;
  return request;
}

export const pushPermissionInternals = {
  resetForTests() {
    permissionPromptAttempted = false;
    permissionRequestPromise = null;
  },
};
