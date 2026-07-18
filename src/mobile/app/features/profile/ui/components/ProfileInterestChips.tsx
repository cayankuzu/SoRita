import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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

  return (
    <View style={styles.section}>
      {title ? <Text style={styles.title}>{title}</Text> : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        directionalLockEnabled
      >
        {labels.map((label) => (
          <View key={label} style={styles.chip}>
            <Text style={styles.chipText}>{label}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 12,
  },
  chip: {
    borderRadius: radius.pill,
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
});
