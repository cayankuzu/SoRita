import React, { startTransition, useEffect, useState } from 'react';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { notificationRuntime } from '@/mobile/app/platform/notifications/runtime';
import { runAfterNextPaint } from '@/mobile/app/shared/utils/interaction';

function NotificationPresentationController() {
  useEffect(() => {
    if (!notificationRuntime.featureEnabled) {
      return;
    }

    const { ensureForegroundNotificationPresentation } = require('@/mobile/app/app-shell/notifications/PushNotificationsController') as
      typeof import('@/mobile/app/app-shell/notifications/PushNotificationsController');

    void ensureForegroundNotificationPresentation().catch((error) => {
      logger.debug('providers', 'Failed to ensure foreground notification presentation', error);
    });
  }, []);

  return null;
}

function DeferredPushNotificationsController() {
  const { booted, user } = useAuth();

  if (!booted || !user) {
    return null;
  }

  const { PushNotificationsController } = require('@/mobile/app/app-shell/notifications/PushNotificationsController') as
    typeof import('@/mobile/app/app-shell/notifications/PushNotificationsController');

  return <PushNotificationsController />;
}

function DeferredSystemPushNotificationsController() {
  const { booted, user } = useAuth();

  if (!booted || !user) {
    return null;
  }

  const { SystemPushNotificationsController } = require('@/mobile/app/app-shell/notifications/SystemPushNotificationsController') as
    typeof import('@/mobile/app/app-shell/notifications/SystemPushNotificationsController');

  return <SystemPushNotificationsController />;
}

type RuntimeHostLoader = {
  key: string;
  load: () => React.ComponentType;
};

const runtimeHostLoaders: RuntimeHostLoader[] = [
  {
    key: 'toast',
    load: () => require('@/mobile/app/platform/feedback/ToastHost').ToastHost,
  },
  {
    key: 'network',
    load: () => require('@/mobile/app/platform/network/OfflineIndicator').OfflineIndicator,
  },
  {
    key: 'outbox',
    load: () => require('@/mobile/app/app-shell/providers/OutboxSyncController').OutboxSyncController,
  },
  {
    key: 'video-cache',
    load: () => require('@/mobile/app/platform/media/VideoCacheController').VideoCacheController,
  },
  {
    key: 'media-memory',
    load: () => require('@/mobile/app/platform/media/MediaMemoryController').MediaMemoryController,
  },
  { key: 'notification-presentation', load: () => NotificationPresentationController },
  { key: 'push-notifications', load: () => DeferredPushNotificationsController },
  { key: 'system-notifications', load: () => DeferredSystemPushNotificationsController },
  {
    key: 'media-prompt',
    load: () => require('@/mobile/app/platform/media/MediaPickerPromptHost').MediaPickerPromptHost,
  },
  {
    key: 'video-camera',
    load: () => require('@/mobile/app/platform/media/VideoCameraCaptureHost').VideoCameraCaptureHost,
  },
  {
    key: 'media-library',
    load: () => require('@/mobile/app/platform/media/MediaLibrarySelectionHost').MediaLibrarySelectionHost,
  },
];

const RuntimeHost = React.memo(function RuntimeHost({ load }: Pick<RuntimeHostLoader, 'load'>) {
  const [Host] = useState(load);
  return <Host />;
});

/** Reveals one non-critical native host per paint so startup never evaluates them as a burst. */
export function DeferredRuntimeHosts() {
  const { booted } = useAuth();
  const [visibleHostCount, setVisibleHostCount] = useState(0);

  useEffect(() => {
    if (!booted) {
      return;
    }

    let cancelled = false;
    let cancelNextReveal: () => void = () => undefined;
    let nextCount = 0;

    const revealNextHost = () => {
      cancelNextReveal = runAfterNextPaint(() => {
        if (cancelled) {
          return;
        }

        nextCount += 1;
        startTransition(() => setVisibleHostCount(nextCount));

        if (nextCount < runtimeHostLoaders.length) {
          revealNextHost();
        }
      });
    };

    revealNextHost();
    return () => {
      cancelled = true;
      cancelNextReveal();
    };
  }, [booted]);

  return (
    <>
      {runtimeHostLoaders.slice(0, visibleHostCount).map((host) => (
        <RuntimeHost key={host.key} load={host.load} />
      ))}
    </>
  );
}
