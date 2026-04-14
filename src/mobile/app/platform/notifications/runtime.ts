import Constants from 'expo-constants';

import { env } from '@/mobile/app/platform/config/env';

const isExpoGo = Constants.appOwnership === 'expo';

export const notificationRuntime = {
  featureEnabled: env.pushNotificationsEnabled,
  isExpoGo,
  supportsNotificationObservers: env.pushNotificationsEnabled && !isExpoGo,
  supportsRemotePushRegistration: env.pushNotificationsEnabled && !isExpoGo,
};
