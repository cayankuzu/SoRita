import React from 'react';
import { View } from 'react-native';

import { SettingsHeader } from '@/mobile/app/features/settings/ui/components/SettingsHeader';
import {
  SettingsMenuSection,
  type SettingsMenuItem,
} from '@/mobile/app/features/settings/ui/components/SettingsMenuSection';
import { settingsScreenStyles as styles } from '@/mobile/app/features/settings/ui/components/settingsScreenStyles';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';

type SettingsMainMenuViewProps = {
  onBack: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  sections: Array<{ title: string; items: SettingsMenuItem[] }>;
};

export function SettingsMainMenuView({
  onBack,
  onRefresh,
  refreshing,
  sections,
}: SettingsMainMenuViewProps) {
  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <SettingsHeader title={tr.settings.title} onBack={onBack} />
      <View style={styles.sectionStack}>
        {sections.map((section) => (
          <SettingsMenuSection key={section.title} title={section.title} items={section.items} />
        ))}
      </View>
    </Screen>
  );
}
