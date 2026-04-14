import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';

import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type AuthStepDotsProps = {
  current: number;
  total: number;
};

export function AuthStepDots({ current, total }: AuthStepDotsProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === current ? styles.dotActive : null,
            index < current ? styles.dotDone : null,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 16,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBorder,
  },
  dotActive: {
    width: 30,
    backgroundColor: colors.primary,
  },
  dotDone: {
    backgroundColor: colors.primary,
  },
});
