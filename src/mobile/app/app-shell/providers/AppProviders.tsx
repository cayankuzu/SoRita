import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NativeSplashScreen from 'expo-splash-screen';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { AuthProvider, useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import { AppProgressBannerProvider } from '@/mobile/app/app-shell/feedback/AppProgressBanner';
import { AppSystemBarsProvider } from '@/mobile/app/app-shell/chrome/AppSystemBars';
import { DeferredRuntimeHosts } from '@/mobile/app/app-shell/providers/DeferredRuntimeHosts';
import { StartupQueryCacheController } from '@/mobile/app/app-shell/providers/StartupQueryCacheController';
import { env } from '@/mobile/app/platform/config/env';
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
import { SoRitaLogo } from '@/mobile/app/shared/components/brand/SoRitaLogo';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, typography } from '@/mobile/app/shared/theme/tokens';
import { StartupShellReadyContext } from '@/mobile/app/app-shell/startup/StartupShellReadyContext';

let appStartTracked = false;
const CURRENT_YEAR = new Date().getFullYear();
const MINIMUM_BRANDED_SPLASH_MS = 800;

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
    </SafeAreaProvider>
  );
}

function StartupSplashGate({ children }: AppProvidersProps) {
  const { booted, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [shellReady, setShellReady] = React.useState(false);
  const [minimumSplashElapsed, setMinimumSplashElapsed] = React.useState(false);
  const showSplash = !booted || !shellReady || !minimumSplashElapsed;
  const firstShellTrackedRef = React.useRef(false);
  const nativeSplashHiddenRef = React.useRef(false);
  const markShellReady = React.useCallback(() => {
    setShellReady(true);
  }, []);
  const hideNativeSplash = React.useCallback(() => {
    if (nativeSplashHiddenRef.current) {
      return;
    }

    nativeSplashHiddenRef.current = true;
    void NativeSplashScreen.hideAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setMinimumSplashElapsed(true);
    }, MINIMUM_BRANDED_SPLASH_MS);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (showSplash || firstShellTrackedRef.current) {
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
  }, [showSplash, user]);

  useEffect(() => {
    if (!showSplash) {
      hideNativeSplash();
    }
  }, [hideNativeSplash, showSplash]);

  return (
    <StartupShellReadyContext.Provider value={markShellReady}>
      <View style={styles.startupGate}>
        {booted ? children : null}
        {showSplash ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onLayout={hideNativeSplash}
            pointerEvents="none"
            style={styles.startupSplash}
          >
            <View style={styles.startupBrand}>
              <SoRitaLogo size="xl" />
            </View>
            <View
              style={[
                styles.startupFooter,
                { paddingBottom: Math.max(insets.bottom + 18, 28) },
              ]}
            >
              <Text style={styles.startupMetaText}>
                {tr.brand.copyright(CURRENT_YEAR)}
              </Text>
              <View style={styles.startupPoweredRow}>
                <Text style={styles.startupDeveloperText}>{tr.brand.developer}</Text>
                <Text style={styles.startupMetaText}> {tr.brand.poweredBy}</Text>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </StartupShellReadyContext.Provider>
  );
}

const styles = StyleSheet.create({
  startupGate: {
    flex: 1,
    backgroundColor: colors.background,
  },
  startupSplash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    zIndex: 1,
  },
  startupBrand: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  startupFooter: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 24,
  },
  startupPoweredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startupMetaText: {
    ...typography.metadataText,
    color: colors.textSoft,
    lineHeight: 15,
    textAlign: 'center',
  },
  startupDeveloperText: {
    ...typography.metadataText,
    color: colors.text,
    fontWeight: '700',
    lineHeight: 15,
  },
});
