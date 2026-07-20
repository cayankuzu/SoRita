import { useEffect } from 'react';
import { AppState } from 'react-native';
import { onlineManager } from '@tanstack/react-query';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { synchronizeOutbox } from '@/mobile/app/data/outbox/outboxRuntime';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import { logger } from '@/mobile/app/platform/feedback/logger';

export function OutboxSyncController() {
  const { booted, user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!booted || !userId) {
      return;
    }

    const synchronize = () => {
      if (!onlineManager.isOnline()) {
        return;
      }

      void synchronizeOutbox(userId)
        .then((count) => {
          if (count > 0) {
            void queryClient.invalidateQueries();
          }
        })
        .catch((error) => {
          logger.warn('outbox', 'Offline operations could not be synchronized.', error);
        });
    };
    const unsubscribeOnline = onlineManager.subscribe((online) => {
      if (online) {
        synchronize();
      }
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        synchronize();
      }
    });

    synchronize();
    return () => {
      unsubscribeOnline();
      appStateSubscription.remove();
    };
  }, [booted, userId]);

  return null;
}
