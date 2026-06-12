import React from 'react';
import { Text, View } from 'react-native';
import { ArrowLeft, Lock, Mail } from 'lucide-react-native';

import { AuthBrandFooter } from '@/mobile/app/features/auth/ui/components/AuthBrandFooter';
import { AuthField } from '@/mobile/app/features/auth/ui/components/AuthField';
import { authScreenStyles as styles } from '@/mobile/app/features/auth/ui/components/authScreenStyles';
import { SoRitaLogo } from '@/mobile/app/shared/components/brand/SoRitaLogo';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

type AuthLoginViewProps = {
  confirmationEmail?: string | null;
  loginEmail: string;
  loginPassword: string;
  onBack: () => void;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onForgotPassword: () => void;
  onLogin: () => void;
  onOpenRegister: () => void;
  onResendConfirmation: () => void;
};

export function AuthLoginView({
  confirmationEmail,
  loginEmail,
  loginPassword,
  onBack,
  onChangeEmail,
  onChangePassword,
  onForgotPassword,
  onLogin,
  onOpenRegister,
  onResendConfirmation,
}: AuthLoginViewProps) {
  return (
    <Screen scroll={false} contentContainerStyle={styles.authScreen}>
      <View style={styles.authBrandRow}>
        <SoRitaLogo size="xl" />
      </View>

      <InstantPressable onPress={onBack} style={styles.backButton}>
        <ArrowLeft color={colors.textMuted} size={20} />
      </InstantPressable>

      <View style={styles.headerBlock}>
        <Text style={styles.screenTitle}>{tr.auth.login.title}</Text>
        <Text style={styles.screenSubtitle}>{tr.auth.login.subtitle}</Text>
      </View>

      <View style={styles.formBlock}>
        {confirmationEmail ? (
          <View style={styles.confirmationCard}>
            <Text style={styles.confirmationTitle}>{tr.auth.login.confirmationTitle}</Text>
            <Text style={styles.confirmationText}>
              {tr.auth.login.confirmationText(confirmationEmail)}
            </Text>
            <PrimaryButton
              title={tr.auth.login.resendConfirmation}
              variant="secondary"
              onPress={onResendConfirmation}
            />
          </View>
        ) : null}

        <AuthField
          label={tr.auth.login.emailLabel}
          placeholder={tr.auth.login.emailPlaceholder}
          value={loginEmail}
          onChangeText={onChangeEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          icon={<Mail color={colors.textSoft} size={16} />}
        />
        <AuthField
          label={tr.auth.login.passwordLabel}
          placeholder={tr.auth.login.passwordPlaceholder}
          value={loginPassword}
          onChangeText={onChangePassword}
          secureTextEntry
          autoCapitalize="none"
          icon={<Lock color={colors.textSoft} size={16} />}
        />
        <Text style={styles.footerLink} onPress={onForgotPassword}>
          Sifremi unuttum
        </Text>
        <PrimaryButton title={tr.auth.login.submit} onPress={onLogin} />
      </View>

      <Text style={styles.footerText}>
        {tr.auth.login.noAccount}{' '}
        <Text style={styles.footerLink} onPress={onOpenRegister}>
          {tr.auth.login.register}
        </Text>
      </Text>

      <AuthBrandFooter />
    </Screen>
  );
}
