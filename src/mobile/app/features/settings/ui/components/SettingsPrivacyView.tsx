import React from 'react';
import { BarChart3, Globe, LockKeyhole } from 'lucide-react-native';
import { View } from 'react-native';

import { PrivacyOption } from '@/mobile/app/features/settings/ui/components/PrivacyOption';
import { SettingsHeader } from '@/mobile/app/features/settings/ui/components/SettingsHeader';
import { settingsScreenStyles as styles } from '@/mobile/app/features/settings/ui/components/settingsScreenStyles';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

type SettingsPrivacyViewProps = {
  analyticsConsentGranted: boolean;
  isPublicAccount: boolean;
  isSavingAnalyticsConsent: boolean;
  isSavingPrivacy: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onSaveAnalyticsConsent: (value: boolean) => void;
  onSavePrivacy: (value: boolean) => void;
  refreshing: boolean;
};

export function SettingsPrivacyView({
  analyticsConsentGranted,
  isPublicAccount,
  isSavingAnalyticsConsent,
  isSavingPrivacy,
  onBack,
  onRefresh,
  onSaveAnalyticsConsent,
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
        <AppText accessibilityRole="header" style={styles.sectionTitle}>
          {tr.settings.privacy.analyticsTitle}
        </AppText>
        <PrivacyOption
          active={analyticsConsentGranted}
          disabled={isSavingAnalyticsConsent}
          icon={<BarChart3 color={analyticsConsentGranted ? colors.primary : colors.textMuted} size={18} />}
          title={tr.settings.privacy.analyticsEnabled}
          description={tr.settings.privacy.analyticsEnabledDescription}
          onPress={() => {
            onSaveAnalyticsConsent(true);
          }}
        />
        <PrivacyOption
          active={!analyticsConsentGranted}
          disabled={isSavingAnalyticsConsent}
          icon={<BarChart3 color={!analyticsConsentGranted ? colors.primary : colors.textMuted} size={18} />}
          title={tr.settings.privacy.analyticsDisabled}
          description={tr.settings.privacy.analyticsDisabledDescription}
          onPress={() => {
            onSaveAnalyticsConsent(false);
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
        {isSavingPrivacy || isSavingAnalyticsConsent ? (
          <AppText
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={styles.savingStatus}
          >
            {isSavingPrivacy ? tr.settings.privacy.saving : tr.settings.privacy.analyticsSaving}
          </AppText>
        ) : null}
      </View>
    </Screen>
  );
}
