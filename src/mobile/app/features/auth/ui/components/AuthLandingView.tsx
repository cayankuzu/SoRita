import React from 'react';
import { Text, View } from 'react-native';

import { SoRitaLogo } from '@/mobile/app/shared/components/brand/SoRitaLogo';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { authScreenStyles as styles } from '@/mobile/app/features/auth/ui/components/authScreenStyles';

type AuthLandingViewProps = {
  onLoginPress: () => void;
  onRegisterPress: () => void;
};

export function AuthLandingView({ onLoginPress, onRegisterPress }: AuthLandingViewProps) {
  return (
    <Screen scroll={false} contentContainerStyle={styles.landingScreen}>
      <View style={styles.landingContent}>
        <View style={styles.logoWrap}>
          <SoRitaLogo size="xl" />
        </View>
        <Text style={styles.landingSubtitle}>{tr.auth.landing.subtitle}</Text>

        <PrimaryButton title={tr.auth.landing.login} variant="secondary" onPress={onLoginPress} />
        <PrimaryButton title={tr.auth.landing.register} onPress={onRegisterPress} />
      </View>
    </Screen>
  );
}
