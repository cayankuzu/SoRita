import React, { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as NativeSplashScreen from 'expo-splash-screen';
import { StyleSheet, View } from 'react-native';

import { AuthProvider, useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { AppErrorBoundary } from '@/mobile/app/app-shell/startup/AppErrorBoundary';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import {
  HOME_FEED_ALGORITHM_VERSION,
  HOME_FEED_STALE_TIME_MS,
} from '@/mobile/app/data/hooks/useHomeFeedQuery';
import {
  fetchHomeFeedPage,
  type HomeFeedCursor,
} from '@/mobile/app/data/repositories/homeFeedRepository';
import { AppProgressBannerProvider } from '@/mobile/app/app-shell/feedback/AppProgressBanner';
import { AppSystemBarsProvider } from '@/mobile/app/app-shell/chrome/AppSystemBars';
import { env } from '@/mobile/app/platform/config/env';
import { MediaLibrarySelectionHost } from '@/mobile/app/platform/media/MediaLibrarySelectionHost';
import { MediaPickerPromptHost } from '@/mobile/app/platform/media/MediaPickerPromptHost';
import { VideoCameraCaptureHost } from '@/mobile/app/platform/media/VideoCameraCaptureHost';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { OfflineIndicator } from '@/mobile/app/platform/network/OfflineIndicator';
import { notificationRuntime } from '@/mobile/app/platform/notifications/runtime';
import { StartupSplashScreen } from '@/mobile/app/app-shell/startup/StartupSplashScreen';

type AppProvidersProps = {
  children: React.ReactNode;
};

const STARTUP_SPLASH_MIN_MS = 800;
const STARTUP_SPLASH_MAX_PREFETCH_MS = 2_200;

export function AppProviders({ children }: AppProvidersProps) {
  useEffect(() => {
    if (!env.hasRequiredStartupConfig) {
      void NativeSplashScreen.hideAsync().catch(() => undefined);
    }
  }, []);

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
            <AppSystemBarsProvider>
              <AppProgressBannerProvider>
                <OfflineIndicator />
                <NotificationPresentationController />
                <DeferredPushNotificationsController />
                <DeferredSystemPushNotificationsController />
                <StartupSplashGate>{children}</StartupSplashGate>
                <MediaPickerPromptHost />
                <VideoCameraCaptureHost />
                <MediaLibrarySelectionHost />
              </AppProgressBannerProvider>
            </AppSystemBarsProvider>
          </AuthProvider>
        </QueryClientProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

function StartupSplashGate({ children }: AppProvidersProps) {
  const { booted, user } = useAuth();
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [warmupReady, setWarmupReady] = useState(false);
  const showSplash = !booted || !minimumElapsed || !warmupReady;

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setMinimumElapsed(true);
    }, STARTUP_SPLASH_MIN_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!booted) {
      setWarmupReady(false);
      return;
    }

    if (!user?.id) {
      setWarmupReady(true);
      return;
    }

    const queryKey = queryKeys.feed.page(user.id, HOME_FEED_ALGORITHM_VERSION);

    if (queryClient.getQueryData(queryKey)) {
      setWarmupReady(true);
      return;
    }

    let active = true;
    const maxTimeout = setTimeout(() => {
      if (active) {
        setWarmupReady(true);
      }
    }, STARTUP_SPLASH_MAX_PREFETCH_MS);

    setWarmupReady(false);
    void queryClient
      .prefetchInfiniteQuery({
        initialPageParam: null as HomeFeedCursor | null,
        queryKey,
        queryFn: ({ pageParam }) =>
          fetchHomeFeedPage({
            cursor: (pageParam as HomeFeedCursor | null) ?? null,
            viewerId: user.id,
          }),
        staleTime: HOME_FEED_STALE_TIME_MS,
      })
      .catch((error) => {
        logger.debug('providers', 'Startup feed warmup failed', error);
      })
      .finally(() => {
        clearTimeout(maxTimeout);

        if (active) {
          setWarmupReady(true);
        }
      });

    return () => {
      active = false;
      clearTimeout(maxTimeout);
    };
  }, [booted, user?.id]);

  useEffect(() => {
    if (!showSplash) {
      void NativeSplashScreen.hideAsync().catch(() => undefined);
    }
  }, [showSplash]);

  return (
    <View style={styles.startupGate}>
      {children}
      {showSplash ? <StartupSplashScreen /> : null}
    </View>
  );
}

function NotificationPresentationController() {
  useEffect(() => {
    if (!notificationRuntime.featureEnabled) {
      return;
    }

    const { ensureForegroundNotificationPresentation } = require('@/mobile/app/app-shell/notifications/PushNotificationsController') as
      typeof import('@/mobile/app/app-shell/notifications/PushNotificationsController');

    void ensureForegroundNotificationPresentation().catch((err) => { logger.debug('providers', 'Failed to ensure foreground notification presentation', err); });
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

const styles = StyleSheet.create({
  startupGate: {
    flex: 1,
  },
});
