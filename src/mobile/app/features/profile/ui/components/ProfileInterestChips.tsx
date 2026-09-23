import React from 'react';
import { StyleSheet, View } from 'react-native';

import { PROFILE_INTEREST_META } from '@/mobile/app/catalog/profileInterests';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { Badge } from '@/mobile/app/shared/components/ui/Badge';
import { t } from '@/mobile/app/shared/i18n';
import { colors, spacing, textStyle } from '@/mobile/app/shared/theme/tokens';

type ProfileInterestChipsProps = {
  interestIds?: string[];
  title?: string | null;
};

export function ProfileInterestChips({
  interestIds,
  title = t.profile.interestsTitle,
}: ProfileInterestChipsProps) {
  const labels = Array.from(
    new Set(
      (interestIds || [])
        .map((interestId) => PROFILE_INTEREST_META[interestId]?.label || interestId)
        .filter(Boolean),
    ),
  );

  if (labels.length === 0) {
    return null;
  }

  const visibleLabels = labels.slice(0, 3);
  const remainingCount = Math.max(0, labels.length - visibleLabels.length);

  return (
    <View style={styles.section}>
      {title ? <AppText accessibilityRole="header" style={styles.title}>{title}</AppText> : null}

      <View style={styles.row}>
        {visibleLabels.map((label) => (
          <Badge key={label} label={label} tone="primary" />
        ))}
        {remainingCount > 0 ? <Badge label={`+${remainingCount}`} numeric /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  title: textStyle('labelText', colors.textSoft),
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
});
