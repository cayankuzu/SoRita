import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, fontWeight, typography } from '@/mobile/app/shared/theme/tokens';

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
          <Text style={styles.value}>{stat.value}</Text>
          <Text style={styles.label}>{stat.label}</Text>
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
    gap: 10,
    marginTop: 12,
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  value: {
    ...typography.compactSectionText,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  label: {
    marginTop: 2,
    ...typography.metadataText,
    color: colors.textSoft,
  },
});
