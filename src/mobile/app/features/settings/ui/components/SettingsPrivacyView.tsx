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
  onBack: () => void;
  onRefresh: () => void;
  onSavePrivacy: (value: boolean) => void;
  refreshing: boolean;
};

export function SettingsPrivacyView({
  isPublicAccount,
  onBack,
  onRefresh,
  onSavePrivacy,
  refreshing,
}: SettingsPrivacyViewProps) {
  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <SettingsHeader title={tr.settings.privacy.title} onBack={onBack} />
      <View style={styles.form}>
        <PrivacyOption
          active={isPublicAccount}
          icon={<Globe color={isPublicAccount ? colors.onPrimary : colors.textMuted} size={20} />}
          title={tr.settings.privacy.public}
          description={tr.settings.privacy.publicDescription}
          onPress={() => {
            onSavePrivacy(true);
          }}
        />
        <PrivacyOption
          active={!isPublicAccount}
          icon={<LockKeyhole color={!isPublicAccount ? colors.onPrimary : colors.textMuted} size={20} />}
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
