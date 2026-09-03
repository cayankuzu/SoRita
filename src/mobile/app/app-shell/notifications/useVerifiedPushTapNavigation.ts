import { useCallback, useEffect, useRef } from 'react';

import { rootNavigationRef } from '@/mobile/app/app-shell/navigation/navigationRef';
import {
  getVerifiedPushNotificationTarget,
  markNotificationRead,
} from '@/mobile/app/data/repositories/notificationRepository';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import { logger } from '@/mobile/app/platform/feedback/logger';
import {
  payloadMatchesVerifiedPushNotification,
  resolveVerifiedPushNavigationTarget,
  scheduleNavigationWhenReady,
  type NavigationRetryHandle,
  type PushPayload,
} from '@/mobile/app/app-shell/notifications/pushNavigation';

export function useVerifiedPushTapNavigation(userId?: string) {
  const currentUserIdRef = useRef<string | null>(userId ?? null);
  const lastHandledNotificationIdRef = useRef<string | null>(null);
  const navigationRetryRef = useRef<NavigationRetryHandle | null>(null);
  const navigationRequestIdRef = useRef(0);

  currentUserIdRef.current = userId ?? null;

  const openPushTarget = useCallback((payload: PushPayload) => {
    if (payload.notificationId && payload.notificationId === lastHandledNotificationIdRef.current) {
      return;
    }

    navigationRetryRef.current?.cancel();
    const requestId = navigationRequestIdRef.current + 1;
    navigationRequestIdRef.current = requestId;
    const expectedUserId = userId ?? null;

    const navigate = async () => {
      if (requestId !== navigationRequestIdRef.current) {
        return;
      }

      if (!expectedUserId) {
        rootNavigationRef.navigate('Auth');
        return;
      }

      if (currentUserIdRef.current !== expectedUserId) {
        return;
      }

      if (!payload.notificationId) {
        rootNavigationRef.navigate('Notifications');
        return;
      }

      try {
        const notification = await getVerifiedPushNotificationTarget(
          payload.notificationId,
          expectedUserId,
        );

        if (
          requestId !== navigationRequestIdRef.current
          || currentUserIdRef.current !== expectedUserId
        ) {
          return;
        }

        if (!notification || !payloadMatchesVerifiedPushNotification(payload, notification)) {
          rootNavigationRef.navigate('Notifications');
          return;
        }

        lastHandledNotificationIdRef.current = notification.id;
        const target = resolveVerifiedPushNavigationTarget(notification);

        if (target.screen === 'ListDetail') {
          rootNavigationRef.navigate('ListDetail', target.params);
        } else if (target.screen === 'UserProfile') {
          rootNavigationRef.navigate('UserProfile', target.params);
        } else {
          rootNavigationRef.navigate('Notifications');
        }

        void markNotificationRead(notification.id)
          .catch((error) => {
            logger.warn('push', 'Failed to mark verified notification as read from a push tap', {
              error: error instanceof Error ? error.name : 'unknown',
            });
          })
          .finally(() => {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.notifications.list(expectedUserId),
            });
          });
      } catch (error) {
        if (
          requestId === navigationRequestIdRef.current
          && currentUserIdRef.current === expectedUserId
        ) {
          logger.warn('push', 'Could not verify a push notification tap', {
            error: error instanceof Error ? error.name : 'unknown',
          });
          rootNavigationRef.navigate('Notifications');
        }
      }
    };

    navigationRetryRef.current = scheduleNavigationWhenReady({
      isReady: () => rootNavigationRef.isReady(),
      onExhausted: () => {
        if (requestId === navigationRequestIdRef.current) {
          logger.debug('push', 'Push tap navigation timed out before the app navigator was ready.');
        }
      },
      onReady: () => {
        void navigate();
      },
    });
  }, [userId]);

  useEffect(() => {
    lastHandledNotificationIdRef.current = null;
    navigationRequestIdRef.current += 1;
    navigationRetryRef.current?.cancel();
    navigationRetryRef.current = null;
  }, [userId]);

  useEffect(() => () => {
    navigationRequestIdRef.current += 1;
    navigationRetryRef.current?.cancel();
    navigationRetryRef.current = null;
  }, []);

  return { openPushTarget };
}
