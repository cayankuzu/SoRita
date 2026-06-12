import 'react-native-gesture-handler';

import React from 'react';
import { StatusBar } from 'react-native';

import { RootNavigator } from '@/mobile/app/app-shell/navigation/RootNavigator';
import { AppProviders } from '@/mobile/app/app-shell/providers/AppProviders';
import { wrapWithSentry } from '@/mobile/app/platform/observability/sentry';
import { colors } from '@/mobile/app/shared/theme/tokens';

function MobileApp() {
  return (
    <AppProviders>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} translucent={false} />
      <RootNavigator />
    </AppProviders>
  );
}

export default wrapWithSentry(MobileApp);
