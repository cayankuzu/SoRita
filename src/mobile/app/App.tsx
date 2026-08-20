import 'react-native-gesture-handler';

import React from 'react';

import { RootNavigator } from '@/mobile/app/app-shell/navigation/RootNavigator';
import { AppProviders } from '@/mobile/app/app-shell/providers/AppProviders';
import { AppErrorBoundary } from '@/mobile/app/app-shell/startup/AppErrorBoundary';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import { wrapWithSentry } from '@/mobile/app/platform/observability/sentry';

function MobileApp() {
  return (
    <AppErrorBoundary onReset={() => queryClient.clear()}>
      <AppProviders>
        <RootNavigator />
      </AppProviders>
    </AppErrorBoundary>
  );
}

export default wrapWithSentry(MobileApp);
