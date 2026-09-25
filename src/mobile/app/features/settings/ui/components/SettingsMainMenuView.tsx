import React from 'react';
import { View } from 'react-native';

import { SettingsHeader } from '@/mobile/app/features/settings/ui/components/SettingsHeader';
import {
  SettingsMenuSection,
  type SettingsMenuItem,
} from '@/mobile/app/features/settings/ui/components/SettingsMenuSection';
import { settingsScreenStyles as styles } from '@/mobile/app/features/settings/ui/components/settingsScreenStyles';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';

type SettingsMainMenuViewProps = {
  onBack: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  sections: Array<{ title: string; items: SettingsMenuItem[] }>;
  // The installed build, for support and for people checking an update.
  versionLabel?: string | null;
};

export function SettingsMainMenuView({
  onBack,
  onRefresh,
  refreshing,
  sections,
  versionLabel,
}: SettingsMainMenuViewProps) {
  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh} variant="settings">
      <SettingsHeader title={tr.settings.title} onBack={onBack} />
      <View style={styles.sectionStack}>
        {sections.map((section) => (
          <SettingsMenuSection key={section.title} title={section.title} items={section.items} />
        ))}
      </View>
      {versionLabel ? (
        <AppText style={styles.versionLabel}>{tr.settings.version(versionLabel)}</AppText>
      ) : null}
    </Screen>
  );
}
