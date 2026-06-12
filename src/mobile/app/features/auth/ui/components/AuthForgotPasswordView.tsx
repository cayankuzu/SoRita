import React from 'react';
import { Text, View } from 'react-native';
import { ArrowLeft, Mail } from 'lucide-react-native';

import { AuthBrandFooter } from '@/mobile/app/features/auth/ui/components/AuthBrandFooter';
import { AuthField } from '@/mobile/app/features/auth/ui/components/AuthField';
import { authScreenStyles as styles } from '@/mobile/app/features/auth/ui/components/authScreenStyles';
import { SoRitaLogo } from '@/mobile/app/shared/components/brand/SoRitaLogo';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { colors } from '@/mobile/app/shared/theme/tokens';

type AuthForgotPasswordViewProps = {
  email: string;
  onBack: () => void;
  onChangeEmail: (value: string) => void;
  onSubmit: () => void;
};

export function AuthForgotPasswordView({
  email,
  onBack,
  onChangeEmail,
  onSubmit,
}: AuthForgotPasswordViewProps) {
  return (
    <Screen scroll={false} contentContainerStyle={styles.authScreen}>
      <View style={styles.authBrandRow}>
        <SoRitaLogo size="xl" />
      </View>

      <InstantPressable onPress={onBack} style={styles.backButton}>
        <ArrowLeft color={colors.textMuted} size={20} />
      </InstantPressable>

      <View style={styles.headerBlock}>
        <Text style={styles.screenTitle}>Sifreni sifirla</Text>
        <Text style={styles.screenSubtitle}>
          E-posta adresine guvenli bir sifirlama baglantisi gonderelim.
        </Text>
      </View>

      <View style={styles.formBlock}>
        <AuthField
          label="E-posta"
          placeholder="ornek@email.com"
          value={email}
          onChangeText={onChangeEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          icon={<Mail color={colors.textSoft} size={16} />}
        />
        <PrimaryButton title="Sifirlama maili gonder" onPress={onSubmit} />
      </View>

      <Text style={styles.footerText}>
        Hatirladin mi?{' '}
        <Text style={styles.footerLink} onPress={onBack}>
          Giris yap
        </Text>
      </Text>

      <AuthBrandFooter />
    </Screen>
  );
}
