import React from 'react';
import {
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import { ProfileInterestChips } from '@/mobile/app/features/profile/ui/components/ProfileInterestChips';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, fontWeight, spacing, textStyle, touch } from '@/mobile/app/shared/theme/tokens';

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
  const safeFollowerCount = Math.max(0, Math.trunc(followerCount));
  const safeFollowingCount = Math.max(0, Math.trunc(followingCount));

  return (
    <View style={styles.detailsStack}>
      <ProfileInterestChips interestIds={interestIds} />
      <View style={styles.connectionsRow}>
        <InstantPressable
          accessibilityLabel={`${tr.profile.connections.followers}: ${tr.profile.connections.resultCount(safeFollowerCount)}`}
          accessibilityRole="button"
          style={styles.connectionButton}
          onPress={onOpenFollowers}
        >
          <AppText style={styles.connectionValue}>{safeFollowerCount}</AppText>
          <AppText style={styles.connectionLabel}>{tr.profile.stats.follower}</AppText>
        </InstantPressable>
        <InstantPressable
          accessibilityLabel={`${tr.profile.connections.following}: ${tr.profile.connections.resultCount(safeFollowingCount)}`}
          accessibilityRole="button"
          style={styles.connectionButton}
          onPress={onOpenFollowing}
        >
          <AppText style={styles.connectionValue}>{safeFollowingCount}</AppText>
          <AppText style={styles.connectionLabel}>{tr.profile.stats.following}</AppText>
        </InstantPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  detailsStack: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  connectionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.lg,
  },
  connectionButton: {
    minWidth: Platform.OS === 'ios' ? touch.ios : touch.android,
    minHeight: Platform.OS === 'ios' ? touch.ios : touch.android,
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxs,
  },
  connectionValue: textStyle('bodyText', colors.text, fontWeight.strong),
  connectionLabel: textStyle('metadataText', colors.textSoft),
});
