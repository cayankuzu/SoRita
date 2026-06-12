import Constants from 'expo-constants';
import * as Device from 'expo-device';

import { env } from '@/mobile/app/platform/config/env';

const isExpoGo = Constants.appOwnership === 'expo';
const isPhysicalDevice = Device.isDevice === true;
const pushNotificationsEnabled =
  env.pushNotificationsEnabledOverride ?? isPhysicalDevice;

export const notificationRuntime = {
  featureEnabled: pushNotificationsEnabled,
  isExpoGo,
  isPhysicalDevice,
  supportsNotificationObservers: pushNotificationsEnabled && !isExpoGo,
  supportsRemotePushRegistration: pushNotificationsEnabled && !isExpoGo && isPhysicalDevice,
};
