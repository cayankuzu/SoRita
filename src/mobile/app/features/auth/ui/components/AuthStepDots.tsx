import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';

import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type AuthStepDotsProps = {
  current: number;
  total: number;
};

export function AuthStepDots({ current, total }: AuthStepDotsProps) {
  const progressLabel = tr.settings.editProfile.stepCounter(current + 1, total);

  return (
    <View
      accessibilityLabel={progressLabel}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      accessibilityValue={{ max: total, min: 1, now: current + 1, text: progressLabel }}
      accessible
      style={styles.row}
    >
      {Array.from({ length: total }).map((_, index) => (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
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
    gap: 6,
  },
  dot: {
    width: 14,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBorder,
  },
  dotActive: {
    width: 26,
    backgroundColor: colors.primary,
  },
  dotDone: {
    backgroundColor: colors.primary,
  },
});
