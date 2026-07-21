import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PROFILE_INTEREST_META } from '@/mobile/app/catalog/profileInterests';
import { t } from '@/mobile/app/shared/i18n';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

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

  const visibleLabels = labels.slice(0, 5);
  const remainingCount = Math.max(0, labels.length - visibleLabels.length);

  return (
    <View style={styles.section}>
      {title ? <Text style={styles.title}>{title}</Text> : null}

      <View style={styles.row}>
        {visibleLabels.map((label) => (
          <View key={label} style={styles.chip}>
            <Text style={styles.chipText}>{label}</Text>
          </View>
        ))}
        {remainingCount > 0 ? (
          <View style={[styles.chip, styles.moreChip]}>
            <Text style={[styles.chipText, styles.moreChipText]}>+{remainingCount}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 6,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSoft,
  },
  row: {
    maxHeight: 62,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingRight: 10,
  },
  chip: {
    borderRadius: radius.pill,
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  moreChip: {
    backgroundColor: colors.surfaceMuted,
  },
  moreChipText: {
    color: colors.textMuted,
  },
});
