import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '@/mobile/app/shared/theme/tokens';

type ProfileStat = {
  label: string;
  value: number;
};

type ProfileStatsRowProps = {
  stats: ProfileStat[];
};

export function ProfileStatsRow({ stats }: ProfileStatsRowProps) {
  return (
    <View style={styles.row}>
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
    gap: 12,
    marginTop: 16,
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  label: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textSoft,
  },
});
