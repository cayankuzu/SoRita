import React from 'react';
import { Globe, LockKeyhole } from 'lucide-react-native';
import { View } from 'react-native';

import { PrivacyOption } from '@/mobile/app/features/settings/ui/components/PrivacyOption';
import { SettingsHeader } from '@/mobile/app/features/settings/ui/components/SettingsHeader';
import { settingsScreenStyles as styles } from '@/mobile/app/features/settings/ui/components/settingsScreenStyles';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

type SettingsPrivacyViewProps = {
  isPublicAccount: boolean;
  isSavingPrivacy: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onSavePrivacy: (value: boolean) => void;
  refreshing: boolean;
};

export function SettingsPrivacyView({
  isPublicAccount,
  isSavingPrivacy,
  onBack,
  onRefresh,
  onSavePrivacy,
  refreshing,
}: SettingsPrivacyViewProps) {
  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh} variant="settings">
      <SettingsHeader title={tr.settings.privacy.title} onBack={onBack} />
      <View style={styles.form}>
        <PrivacyOption
          active={isPublicAccount}
          disabled={isSavingPrivacy}
          icon={<Globe color={isPublicAccount ? colors.primary : colors.textMuted} size={18} />}
          title={tr.settings.privacy.public}
          description={tr.settings.privacy.publicDescription}
          onPress={() => {
            onSavePrivacy(true);
          }}
        />
        <PrivacyOption
          active={!isPublicAccount}
          disabled={isSavingPrivacy}
          icon={<LockKeyhole color={!isPublicAccount ? colors.primary : colors.textMuted} size={18} />}
          title={tr.settings.privacy.private}
          description={tr.settings.privacy.privateDescription}
          onPress={() => {
            onSavePrivacy(false);
          }}
        />
      </View>
    </Screen>
  );
}
