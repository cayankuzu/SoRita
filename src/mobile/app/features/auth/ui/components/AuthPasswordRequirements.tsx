import React from 'react';
import { StyleSheet, View } from 'react-native';

import { getAuthPasswordRequirementProgress } from '@/mobile/app/features/auth/application/authPasswordRequirements';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius, typography } from '@/mobile/app/shared/theme/tokens';

type AuthPasswordRequirementsProps = {
  password: string;
};

export function AuthPasswordRequirements({ password }: AuthPasswordRequirementsProps) {
  const progress = getAuthPasswordRequirementProgress(password);
  const progressLabel = tr.auth.passwordHint.requirementsProgress(progress.met, progress.total);

  return (
    <View
      accessibilityLabel={tr.auth.passwordHint.requirementsTitle}
      accessibilityRole="progressbar"
      accessibilityValue={{
        max: progress.total,
        min: 0,
        now: progress.met,
        text: progressLabel,
      }}
      accessible
      style={styles.block}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.meter}
      >
        {progress.requirements.map((requirement) => (
          <View
            key={requirement.id}
            style={[
              styles.meterItem,
              requirement.met
                ? progress.met === progress.total
                  ? styles.meterComplete
                  : styles.meterProgress
                : null,
            ]}
          />
        ))}
      </View>
      <AppText style={styles.label}>{progressLabel}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 6,
  },
  meter: {
    flexDirection: 'row',
    gap: 4,
  },
  meterItem: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBorder,
  },
  meterProgress: {
    backgroundColor: colors.warning,
  },
  meterComplete: {
    backgroundColor: colors.secondary,
  },
  label: {
    ...typography.metadataText,
    color: colors.textMuted,
  },
});
