import 'react-native-gesture-handler';

import React from 'react';
import { StatusBar } from 'react-native';

import { RootNavigator } from '@/mobile/app/app-shell/navigation/RootNavigator';
import { AppProviders } from '@/mobile/app/app-shell/providers/AppProviders';
import { colors } from '@/mobile/app/shared/theme/tokens';

export default function MobileApp() {
  return (
    <AppProviders>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} translucent={false} />
      <RootNavigator />
    </AppProviders>
  );
}
