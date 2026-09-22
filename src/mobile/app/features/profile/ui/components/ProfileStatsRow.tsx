import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { colors, fontWeight, spacing, textStyle, typography } from '@/mobile/app/shared/theme/tokens';

type ProfileStat = {
  label: string;
  value: number;
};

type ProfileStatsRowProps = {
  stats: ProfileStat[];
};

export function ProfileStatsRow({ stats }: ProfileStatsRowProps) {
  return (
    <View
      accessible
      accessibilityLabel={stats.map((stat) => `${stat.value} ${stat.label}`).join(', ')}
      accessibilityRole="summary"
      style={styles.row}
    >
      {stats.map((stat) => (
        <View key={stat.label} style={styles.item}>
          <AppText style={styles.value}>{stat.value}</AppText>
          <AppText style={styles.label}>{stat.label}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  value: textStyle('compactTitleText', colors.text, fontWeight.medium),
  label: {
    marginTop: spacing.xxs,
    ...typography.metadataText,
    color: colors.textSoft,
  },
});
