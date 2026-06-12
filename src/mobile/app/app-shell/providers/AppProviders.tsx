import React, { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { AppErrorBoundary } from '@/mobile/app/app-shell/startup/AppErrorBoundary';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import { env } from '@/mobile/app/platform/config/env';
import { notificationRuntime } from '@/mobile/app/platform/notifications/runtime';

type AppProvidersProps = {
  children: React.ReactNode;
};

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
            <DeferredPushNotificationsController />
            {children}
          </AuthProvider>
        </QueryClientProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
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
