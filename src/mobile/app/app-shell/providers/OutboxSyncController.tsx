import { useEffect } from 'react';
import { AppState } from 'react-native';
import { onlineManager } from '@tanstack/react-query';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { synchronizeOutbox } from '@/mobile/app/data/outbox/outboxRuntime';
import { readOutboxEntries } from '@/mobile/app/data/outbox/outboxStorage';
import {
  setActiveOutboxUser,
  setOutboxSyncing,
} from '@/mobile/app/platform/sync/outboxStatus';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import { logger } from '@/mobile/app/platform/feedback/logger';

export function OutboxSyncController() {
  const { booted, user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    setActiveOutboxUser(booted ? userId ?? null : null);

    return () => setActiveOutboxUser(null);
  }, [booted, userId]);

  useEffect(() => {
    if (!booted || !userId) {
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const clearRetryTimer = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const scheduleNextRetry = async () => {
      const entries = await readOutboxEntries(userId);
      const nextAttemptAt = entries
        .filter((entry) => entry.state !== 'cancelled' && entry.state !== 'done')
        .reduce<number | null>((earliest, entry) => {
          const attemptAt = new Date(entry.nextAttemptAt).getTime();
          return earliest == null ? attemptAt : Math.min(earliest, attemptAt);
        }, null);

      if (cancelled || nextAttemptAt == null || !onlineManager.isOnline()) {
        return;
      }

      clearRetryTimer();
      retryTimer = setTimeout(synchronize, Math.max(1_000, nextAttemptAt - Date.now()));
    };

    const synchronize = () => {
      if (!onlineManager.isOnline()) {
        return;
      }

      clearRetryTimer();
      setOutboxSyncing(userId, true);
      void synchronizeOutbox(userId)
        .then((count) => {
          if (count > 0) {
            void queryClient.invalidateQueries();
          }
        })
        .catch((error) => {
          logger.warn('outbox', 'Offline operations could not be synchronized.', error);
        })
        .finally(() => {
          setOutboxSyncing(userId, false);
          void scheduleNextRetry();
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
      cancelled = true;
      clearRetryTimer();
      unsubscribeOnline();
      appStateSubscription.remove();
    };
  }, [booted, userId]);

  return null;
}
