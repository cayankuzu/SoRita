import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ProfileInterestChips } from '@/mobile/app/features/profile/ui/components/ProfileInterestChips';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius, typography } from '@/mobile/app/shared/theme/tokens';

type ProfileConnectionsSummaryProps = {
  followerCount: number;
  followingCount: number;
  interestIds?: string[];
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
};

export function ProfileConnectionsSummary({
  followerCount,
  followingCount,
  interestIds = [],
  onOpenFollowers,
  onOpenFollowing,
}: ProfileConnectionsSummaryProps) {
  return (
    <View style={styles.detailsStack}>
      <ProfileInterestChips interestIds={interestIds} />
      <View style={styles.connectionsRow}>
        <InstantPressable
          accessibilityLabel={`${followerCount} ${tr.profile.stats.follower}`}
          accessibilityRole="button"
          style={styles.connectionButton}
          onPress={onOpenFollowers}
        >
          <Text style={styles.connectionValue}>{followerCount}</Text>
          <Text style={styles.connectionLabel}>{tr.profile.stats.follower}</Text>
        </InstantPressable>
        <InstantPressable
          accessibilityLabel={`${followingCount} ${tr.profile.stats.following}`}
          accessibilityRole="button"
          style={styles.connectionButton}
          onPress={onOpenFollowing}
        >
          <Text style={styles.connectionValue}>{followingCount}</Text>
          <Text style={styles.connectionLabel}>{tr.profile.stats.following}</Text>
        </InstantPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  detailsStack: {
    marginTop: 12,
    gap: 10,
  },
  connectionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  connectionButton: {
    flex: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  connectionLabel: {
    marginTop: 2,
    ...typography.metadataText,
    color: colors.textSoft,
  },
});
