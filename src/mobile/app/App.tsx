import 'react-native-gesture-handler';

import React from 'react';

import { RootNavigator } from '@/mobile/app/app-shell/navigation/RootNavigator';
import { AppProviders } from '@/mobile/app/app-shell/providers/AppProviders';
import { wrapWithSentry } from '@/mobile/app/platform/observability/sentry';
import { AppErrorBoundary } from '@/mobile/app/shared/components/AppErrorBoundary';

function MobileApp() {
  return (
    <AppErrorBoundary>
      <AppProviders>
        <RootNavigator />
      </AppProviders>
    </AppErrorBoundary>
  );
}

export default wrapWithSentry(MobileApp);
