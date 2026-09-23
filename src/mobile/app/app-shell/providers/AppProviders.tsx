import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NativeSplashScreen from 'expo-splash-screen';
import { AppState, StyleSheet, View } from 'react-native';

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
  initializePostHogAnalytics,
  posthogAnalyticsProvider,
  refreshPostHogRemoteKillSwitches,
} from '@/mobile/app/platform/analytics/posthogAnalyticsProvider';
import { hydrateAnalyticsConsent } from '@/mobile/app/platform/analytics/analyticsConsent';
import {
  getAppLaunchBreakdown,
  getAppLaunchElapsedMs,
} from '@/mobile/app/shared/performance/appLaunch';
import { REMOTE_KILL_SWITCH_TTL_MS } from '@/mobile/app/platform/analytics/remoteKillSwitches';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { getPerformanceContext } from '@/mobile/app/shared/performance/performanceContext';
import { SoRitaLogo } from '@/mobile/app/shared/components/brand/SoRitaLogo';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, fontWeight, spacing, typography, zIndex } from '@/mobile/app/shared/theme/tokens';
import { StartupShellReadyContext } from '@/mobile/app/app-shell/startup/StartupShellReadyContext';
import { shouldShowStartupSplash } from '@/mobile/app/app-shell/startup/startupSplashState';

let appStartTracked = false;
const CURRENT_YEAR = new Date().getFullYear();

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  useEffect(() => {
    const unregister = registerAnalyticsProvider(sentryAnalyticsProvider);
    const unregisterPostHog = registerAnalyticsProvider(posthogAnalyticsProvider);
    void initializePostHogAnalytics();
    void hydrateAnalyticsConsent();

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

    return () => {
      unregisterPostHog();
      unregister();
    };
  }, []);

  useEffect(() => {
    let backgroundedAt: number | null = null;
    const remoteFlagRefreshInterval = setInterval(() => {
      // The capability gate also expires independently at this TTL, so a
      // delayed timer cannot leave a stale remote allow decision active.
      void refreshPostHogRemoteKillSwitches();
    }, REMOTE_KILL_SWITCH_TTL_MS);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        // Invalidate stale flags synchronously, then refresh them before any
        // subsequent PostHog event is eligible for capture.
        void refreshPostHogRemoteKillSwitches();

        if (backgroundedAt != null) {
          trackEvent({
            name: 'app_foreground',
            params: { backgroundDurationMs: Date.now() - backgroundedAt },
          });
        }
        backgroundedAt = null;
      } else if (nextState === 'background') {
        backgroundedAt = Date.now();
      }
    });

    return () => {
      clearInterval(remoteFlagRefreshInterval);
      subscription.remove();
    };
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
  const showSplash = shouldShowStartupSplash({ booted, shellReady });
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
              <AppText style={styles.startupMetaText}>
                {tr.brand.copyright(CURRENT_YEAR)}
              </AppText>
              <View style={styles.startupPoweredRow}>
                <AppText style={styles.startupDeveloperText}>{tr.brand.developer}</AppText>
                <AppText style={styles.startupMetaText}> {tr.brand.poweredBy}</AppText>
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
    zIndex: zIndex.raised,
  },
  startupBrand: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  startupFooter: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing['2xl'],
  },
  startupPoweredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startupMetaText: {
    ...typography.metadataText,
    color: colors.textSoft,
    lineHeight: typography.compactTitleText.fontSize,
    textAlign: 'center',
  },
  startupDeveloperText: {
    ...typography.metadataText,
    color: colors.text,
    fontWeight: fontWeight.strong,
    lineHeight: typography.compactTitleText.fontSize,
  },
});
