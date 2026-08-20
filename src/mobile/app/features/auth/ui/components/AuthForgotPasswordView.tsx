import React from 'react';
import { Text, View } from 'react-native';
import { ArrowLeft, Mail } from 'lucide-react-native';

import { AuthBrandFooter } from '@/mobile/app/features/auth/ui/components/AuthBrandFooter';
import { AuthField } from '@/mobile/app/features/auth/ui/components/AuthField';
import { authScreenStyles as styles } from '@/mobile/app/features/auth/ui/components/authScreenStyles';
import { SoRitaLogo } from '@/mobile/app/shared/components/brand/SoRitaLogo';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { useAuthLayoutMode } from '@/mobile/app/features/auth/ui/components/useAuthLayoutMode';

type AuthForgotPasswordViewProps = {
  email: string;
  onBack: () => void;
  onChangeEmail: (value: string) => void;
  onSubmit: () => void | Promise<void>;
};

export function AuthForgotPasswordView({
  email,
  onBack,
  onChangeEmail,
  onSubmit,
}: AuthForgotPasswordViewProps) {
  const compact = useAuthLayoutMode();

  return (
    <Screen variant="form" contentContainerStyle={styles.authScreen}>
      <View style={[styles.authBrandRow, compact ? styles.authBrandRowCompact : null]}>
        <SoRitaLogo size={compact ? 'lg' : 'xl'} />
      </View>

      <IconButton accessibilityLabel={tr.common.back} onPress={onBack} style={styles.backButton}>
        <ArrowLeft color={colors.textMuted} size={18} />
      </IconButton>

      <View style={[styles.headerBlock, compact ? styles.headerBlockCompact : null]}>
        <Text style={styles.screenTitle}>{tr.auth.forgotPassword.title}</Text>
        <Text style={styles.screenSubtitle}>{tr.auth.forgotPassword.subtitle}</Text>
      </View>

      <View style={styles.formBlock}>
        <AuthField
          label={tr.auth.login.emailLabel}
          placeholder={tr.auth.login.emailPlaceholder}
          value={email}
          onChangeText={onChangeEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={() => onSubmit()}
          icon={<Mail color={colors.textMuted} size={14} />}
        />
        <PrimaryButton title={tr.auth.forgotPassword.sendAction} onPress={onSubmit} />
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>{tr.auth.forgotPassword.remembered}</Text>
        <InstantPressable
          accessibilityLabel={tr.auth.forgotPassword.loginAction}
          accessibilityRole="link"
          onPress={onBack}
          style={styles.footerLinkButton}
        >
          <Text style={styles.footerLink}>{tr.auth.forgotPassword.loginAction}</Text>
        </InstantPressable>
      </View>

      <AuthBrandFooter />
    </Screen>
  );
}
