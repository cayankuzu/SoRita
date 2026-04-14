import { useSyncExternalStore } from 'react';

import {
  getNotificationVersion,
  subscribeNotifications,
} from '@/mobile/app/data/repositories/notificationRepository';

export function useNotificationVersion() {
  return useSyncExternalStore(
    subscribeNotifications,
    getNotificationVersion,
    getNotificationVersion,
  );
}
