import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import {
  flushStartupQueryCachePersist,
  isStartupQueryKeyAllowed,
  scheduleStartupQueryCachePersist,
} from '@/mobile/app/data/cache/startupQueryCache';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import { logger } from '@/mobile/app/platform/feedback/logger';

/** Keeps only the small set of cold-start read models durable. */
export function StartupQueryCacheController() {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      return;
    }

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type !== 'updated' ||
        event.query.state.status !== 'success' ||
        event.query.state.data === undefined ||
        !isStartupQueryKeyAllowed(event.query.queryKey, userId)
      ) {
        return;
      }

      scheduleStartupQueryCachePersist(queryClient, userId);
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        return;
      }

      void flushStartupQueryCachePersist(userId).catch((error) => {
        logger.debug('startup-cache', 'Failed to flush startup cache in background.', error);
      });
    });

    return () => {
      unsubscribe();
      appStateSubscription.remove();
      void flushStartupQueryCachePersist(userId).catch((error) => {
        logger.debug('startup-cache', 'Failed to flush startup cache on cleanup.', error);
      });
    };
  }, [userId]);

  return null;
}
