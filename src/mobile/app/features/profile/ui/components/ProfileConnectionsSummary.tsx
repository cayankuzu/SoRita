import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ProfileInterestChips } from '@/mobile/app/features/profile/ui/components/ProfileInterestChips';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

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
        <Pressable style={styles.connectionButton} onPress={onOpenFollowers}>
          <Text style={styles.connectionValue}>{followerCount}</Text>
          <Text style={styles.connectionLabel}>{tr.profile.stats.follower}</Text>
        </Pressable>
        <Pressable style={styles.connectionButton} onPress={onOpenFollowing}>
          <Text style={styles.connectionValue}>{followingCount}</Text>
          <Text style={styles.connectionLabel}>{tr.profile.stats.following}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  detailsStack: {
    marginTop: 16,
    gap: 14,
  },
  connectionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  connectionButton: {
    flex: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  connectionLabel: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textSoft,
  },
});
