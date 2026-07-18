import React from 'react';
import { Mail } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { PasswordToggle } from '@/mobile/app/features/settings/ui/components/PasswordToggle';
import { SettingsHeader } from '@/mobile/app/features/settings/ui/components/SettingsHeader';
import { settingsScreenStyles as styles } from '@/mobile/app/features/settings/ui/components/settingsScreenStyles';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { TextField } from '@/mobile/app/shared/components/ui/TextField';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

type SettingsPasswordViewProps = {
  currentPassword: string;
  email: string;
  onBack: () => void;
  onChangeCurrentPassword: (value: string) => void;
  onRefresh: () => void;
  onSendResetMail: () => void;
  onTogglePasswordVisibility: () => void;
  refreshing: boolean;
  resetMailSent: boolean;
  showPassword: boolean;
};

export function SettingsPasswordView({
  currentPassword,
  email,
  onBack,
  onChangeCurrentPassword,
  onRefresh,
  onSendResetMail,
  onTogglePasswordVisibility,
  refreshing,
  resetMailSent,
  showPassword,
}: SettingsPasswordViewProps) {
  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <SettingsHeader title={tr.settings.password.title} onBack={onBack} />

      <View style={styles.form}>
        <View style={styles.emailInfoCard}>
          <View style={styles.emailInfoHeader}>
            <Mail color={colors.primary} size={16} />
            <Text style={styles.emailInfoLabel}>{tr.settings.password.emailLabel}</Text>
          </View>
          <Text style={styles.emailInfoValue}>{email}</Text>
          <Text style={styles.emailInfoText}>{tr.settings.password.emailInfo(email)}</Text>
        </View>

        <View style={styles.passwordField}>
          <TextField
            label={tr.settings.password.currentLabel}
            value={currentPassword}
            onChangeText={onChangeCurrentPassword}
            secureTextEntry={!showPassword}
            helper={tr.settings.password.resetHint}
            autoCapitalize="none"
          />
          <PasswordToggle visible={showPassword} onPress={onTogglePasswordVisibility} />
        </View>

        <PrimaryButton title={tr.settings.password.resetAction} onPress={onSendResetMail} />

        {resetMailSent ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>{tr.settings.password.sentTitle}</Text>
            <Text style={styles.successText}>{tr.settings.password.sentDescription(email)}</Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
