import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ProfileInterestChips } from '@/mobile/app/features/profile/ui/components/ProfileInterestChips';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  controlSize,
  fontWeight,
  hitSlopFor,
  spacing,
  tabularNumbers,
  textStyle,
} from '@/mobile/app/shared/theme/tokens';

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
          hitSlop={hitSlopFor(controlSize.default)}
          accessibilityLabel={`${tr.profile.connections.followers}: ${tr.profile.connections.resultCount(safeFollowerCount)}`}
          accessibilityRole="button"
          style={styles.connectionButton}
          onPress={onOpenFollowers}
        >
          <AppText style={styles.connectionValue}>{safeFollowerCount}</AppText>
          <AppText style={styles.connectionLabel}>{tr.profile.stats.follower}</AppText>
        </InstantPressable>
        <InstantPressable
          hitSlop={hitSlopFor(controlSize.default)}
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
    minWidth: controlSize.default,
    minHeight: controlSize.default,
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxs,
  },
  connectionValue: { ...textStyle('bodyText', colors.text, fontWeight.strong), ...tabularNumbers },
  connectionLabel: textStyle('metadataText', colors.textSoft),
});
