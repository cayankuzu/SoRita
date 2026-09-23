import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/mobile/app/shared/components/ui/Chip';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { colors, spacing } from '@/mobile/app/shared/theme/tokens';

type NotificationCategoryTabsProps = {
  tabs: Array<{ key: string; label: string }>;
  activeKey: string;
  onChange: (key: string) => void;
};

/**
 * The same filter chips Explore uses. The header's subtitle announces how
 * many notifications the chosen category holds.
 */
export function NotificationCategoryTabs({
  tabs,
  activeKey,
  onChange,
}: NotificationCategoryTabsProps) {
  const { screenPadding } = useAppLayout();

  return (
    <ScrollView
      horizontal
      style={styles.scroll}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingHorizontal: screenPadding }]}
    >
      {tabs.map((tab) => (
        <Chip
          key={tab.key}
          kind="filter"
          label={tab.label}
          onPress={() => onChange(tab.key)}
          selected={activeKey === tab.key}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    backgroundColor: colors.surface,
  },
  content: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
});
