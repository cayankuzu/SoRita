import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as NativeSplashScreen from 'expo-splash-screen';
import { AppState, StyleSheet, View } from 'react-native';

import { AuthProvider, useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { AppErrorBoundary } from '@/mobile/app/app-shell/startup/AppErrorBoundary';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import { AppProgressBannerProvider } from '@/mobile/app/app-shell/feedback/AppProgressBanner';
import { AppSystemBarsProvider } from '@/mobile/app/app-shell/chrome/AppSystemBars';
import { DeferredRuntimeHosts } from '@/mobile/app/app-shell/providers/DeferredRuntimeHosts';
import { StartupQueryCacheController } from '@/mobile/app/app-shell/providers/StartupQueryCacheController';
import { env } from '@/mobile/app/platform/config/env';
import { StartupSplashScreen } from '@/mobile/app/app-shell/startup/StartupSplashScreen';
import {
  registerAnalyticsProvider,
  trackEvent,
} from '@/mobile/app/platform/analytics/analyticsEvents';
import { sentryAnalyticsProvider } from '@/mobile/app/platform/analytics/sentryAnalyticsProvider';
import {
  getAppLaunchBreakdown,
  getAppLaunchElapsedMs,
} from '@/mobile/app/shared/performance/appLaunch';
import { getPerformanceContext } from '@/mobile/app/shared/performance/performanceContext';

let appStartTracked = false;

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  useEffect(() => {
    const unregister = registerAnalyticsProvider(sentryAnalyticsProvider);

    if (!appStartTracked) {
      appStartTracked = true;
      trackEvent({
        name: 'app_start',
        params: {
          ...getPerformanceContext(),
          cold: true,
          ...getAppLaunchBreakdown(),
        },
      });
    }

    return unregister;
  }, []);

  useEffect(() => {
    let backgroundedAt: number | null = null;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && backgroundedAt != null) {
        trackEvent({
          name: 'app_foreground',
          params: { backgroundDurationMs: Date.now() - backgroundedAt },
        });
        backgroundedAt = null;
      } else if (nextState === 'background') {
        backgroundedAt = Date.now();
      }
    });

    return () => subscription.remove();
  }, []);

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
                <StartupSplashGate>{children}</StartupSplashGate>
                <StartupQueryCacheController />
                <DeferredRuntimeHosts />
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
  const showSplash = !booted;
  const firstShellTrackedRef = React.useRef(false);

  useEffect(() => {
    if (!booted || firstShellTrackedRef.current) {
      return;
    }

    firstShellTrackedRef.current = true;
    trackEvent({
      name: 'screen_first_shell',
      params: {
        durationMs: getAppLaunchElapsedMs(),
        screen: user ? 'authenticated-shell' : 'auth-shell',
      },
    });
  }, [booted, user]);

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

const styles = StyleSheet.create({
  startupGate: {
    flex: 1,
  },
});
