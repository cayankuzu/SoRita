import React, { startTransition, useEffect, useState } from 'react';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { useMediaLibrarySelectionState } from '@/mobile/app/platform/media/mediaLibrarySelectionController';
import { useMediaPickerPromptState } from '@/mobile/app/platform/media/mediaPickerPromptController';
import { useVideoCameraCaptureState } from '@/mobile/app/platform/media/videoCameraCaptureController';
import { notificationRuntime } from '@/mobile/app/platform/notifications/runtime';
import { runAfterNextPaint } from '@/mobile/app/shared/utils/interaction';

function NotificationPresentationController() {
  const { booted, user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!booted || !userId || !notificationRuntime.featureEnabled) {
      return;
    }

    const { ensureForegroundNotificationPresentation } = require('@/mobile/app/app-shell/notifications/PushNotificationsController') as
      typeof import('@/mobile/app/app-shell/notifications/PushNotificationsController');

    void ensureForegroundNotificationPresentation().catch((error) => {
      logger.debug('providers', 'Failed to ensure foreground notification presentation', error);
    });
  }, [booted, userId]);

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

function OnDemandMediaPickerPromptHost() {
  const { visible } = useMediaPickerPromptState();
  if (!visible) {
    return null;
  }

  const { MediaPickerPromptHost } = require('@/mobile/app/platform/media/MediaPickerPromptHost') as
    typeof import('@/mobile/app/platform/media/MediaPickerPromptHost');
  return <MediaPickerPromptHost />;
}

function OnDemandVideoCameraCaptureHost() {
  const { visible } = useVideoCameraCaptureState();
  if (!visible) {
    return null;
  }

  const { VideoCameraCaptureHost } = require('@/mobile/app/platform/media/VideoCameraCaptureHost') as
    typeof import('@/mobile/app/platform/media/VideoCameraCaptureHost');
  return <VideoCameraCaptureHost />;
}

function OnDemandMediaLibrarySelectionHost() {
  const { visible } = useMediaLibrarySelectionState();
  if (!visible) {
    return null;
  }

  const { MediaLibrarySelectionHost } = require('@/mobile/app/platform/media/MediaLibrarySelectionHost') as
    typeof import('@/mobile/app/platform/media/MediaLibrarySelectionHost');
  return <MediaLibrarySelectionHost />;
}

type RuntimeHostLoader = {
  key: string;
  load: () => React.ComponentType;
};

const runtimeHostLoaders: RuntimeHostLoader[] = [
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
    load: () => OnDemandMediaPickerPromptHost,
  },
  {
    key: 'video-camera',
    load: () => OnDemandVideoCameraCaptureHost,
  },
  {
    key: 'media-library',
    load: () => OnDemandMediaLibrarySelectionHost,
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
