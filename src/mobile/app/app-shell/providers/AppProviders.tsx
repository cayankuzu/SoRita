import React, { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { AppErrorBoundary } from '@/mobile/app/app-shell/startup/AppErrorBoundary';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import {
  fetchVisibleDataContext,
  fetchVisibleListsPage,
} from '@/mobile/app/data/repositories/visibleDataRepository';
import { AppProgressBannerProvider } from '@/mobile/app/app-shell/feedback/AppProgressBanner';
import { env } from '@/mobile/app/platform/config/env';
import { MediaLibrarySelectionHost } from '@/mobile/app/platform/media/MediaLibrarySelectionHost';
import { MediaPickerPromptHost } from '@/mobile/app/platform/media/MediaPickerPromptHost';
import { notificationRuntime } from '@/mobile/app/platform/notifications/runtime';

type AppProvidersProps = {
  children: React.ReactNode;
};

const PREWARM_VISIBLE_LIST_PAGE_SIZE = 20;
const PUBLIC_VIEWER_ID = '__public__';
const VISIBLE_DATA_STALE_TIME_MS = 1000 * 60 * 3;

export function AppProviders({ children }: AppProvidersProps) {
  if (!env.hasRequiredStartupConfig) {
    const { AppConfigErrorScreen } = require('@/mobile/app/app-shell/startup/AppConfigErrorScreen') as
      typeof import('@/mobile/app/app-shell/startup/AppConfigErrorScreen');

    return (
      <SafeAreaProvider>
        <AppConfigErrorScreen missingEnvVars={env.missingRequiredStartupEnvVars} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppErrorBoundary
        onReset={() => {
          queryClient.clear();
        }}
      >
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppProgressBannerProvider>
              <NotificationPresentationController />
              <VisibleDataWarmupController />
              <DeferredPushNotificationsController />
              {children}
              <MediaPickerPromptHost />
              <MediaLibrarySelectionHost />
            </AppProgressBannerProvider>
          </AuthProvider>
        </QueryClientProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

function VisibleDataWarmupController() {
  const { booted, user } = useAuth();

  useEffect(() => {
    if (!booted || !user?.id) {
      return;
    }

    const viewerId = user.id || PUBLIC_VIEWER_ID;
    const hasFreshContext =
      (queryClient.getQueryState(queryKeys.visibleData.context(viewerId))?.dataUpdatedAt || 0) >
      Date.now() - VISIBLE_DATA_STALE_TIME_MS;
    const hasFreshLists =
      (queryClient.getQueryState(
        queryKeys.visibleData.lists(viewerId, {
          pageSize: PREWARM_VISIBLE_LIST_PAGE_SIZE,
        }),
      )?.dataUpdatedAt || 0) > Date.now() - VISIBLE_DATA_STALE_TIME_MS;

    if (hasFreshContext && hasFreshLists) {
      return;
    }

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) {
        return;
      }

      void (async () => {
        try {
          const context = await queryClient.ensureQueryData({
            queryKey: queryKeys.visibleData.context(viewerId),
            queryFn: () => fetchVisibleDataContext(user.id),
            staleTime: VISIBLE_DATA_STALE_TIME_MS,
          });
          const listsData = await queryClient.fetchInfiniteQuery({
            queryKey: queryKeys.visibleData.lists(viewerId, {
              pageSize: PREWARM_VISIBLE_LIST_PAGE_SIZE,
            }),
            queryFn: ({ pageParam = 0 }) =>
              fetchVisibleListsPage({
                allUsers: context.allUsers,
                blockRows: context.blockRows,
                limit: PREWARM_VISIBLE_LIST_PAGE_SIZE,
                offset: pageParam,
                viewerId: user.id,
              }),
            initialPageParam: 0,
            getNextPageParam: (lastPage, allPages) =>
              !Array.isArray(lastPage) || lastPage.length < PREWARM_VISIBLE_LIST_PAGE_SIZE
                ? undefined
                : allPages.reduce(
                    (total, page) => total + (Array.isArray(page) ? page.length : 0),
                    0,
                  ),
            staleTime: VISIBLE_DATA_STALE_TIME_MS,
          });
          const lists = listsData.pages.flat();

          queryClient.setQueryData(queryKeys.visibleData.snapshot(viewerId), {
            ...context,
            lists,
          });
        } catch {
          // Warmup is best-effort; the live screen queries will retry if this fails.
        }
      })();
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [booted, user?.id]);

  return null;
}

function NotificationPresentationController() {
  useEffect(() => {
    if (!notificationRuntime.featureEnabled) {
      return;
    }

    const { ensureForegroundNotificationPresentation } = require('@/mobile/app/app-shell/notifications/PushNotificationsController') as
      typeof import('@/mobile/app/app-shell/notifications/PushNotificationsController');

    void ensureForegroundNotificationPresentation().catch(() => undefined);
  }, []);

  return null;
}

function DeferredPushNotificationsController() {
  const { booted, user } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!notificationRuntime.featureEnabled || !booted || !user) {
      setReady(false);
      return;
    }

    let mounted = true;
    const task = InteractionManager.runAfterInteractions(() => {
      if (mounted) {
        setReady(true);
      }
    });

    return () => {
      mounted = false;
      task.cancel();
    };
  }, [booted, user]);

  if (!notificationRuntime.featureEnabled || !booted || !user || !ready) {
    return null;
  }

  const { PushNotificationsController } = require('@/mobile/app/app-shell/notifications/PushNotificationsController') as
    typeof import('@/mobile/app/app-shell/notifications/PushNotificationsController');

  return <PushNotificationsController />;
}
