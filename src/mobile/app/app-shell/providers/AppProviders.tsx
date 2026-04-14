import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { PushNotificationsController } from '@/mobile/app/app-shell/notifications/PushNotificationsController';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import { env } from '@/mobile/app/platform/config/env';

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {env.pushNotificationsEnabled ? <PushNotificationsController /> : null}
          {children}
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
