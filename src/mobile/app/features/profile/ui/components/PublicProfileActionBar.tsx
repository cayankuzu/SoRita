import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ellipsis, UserMinus, UserPlus } from 'lucide-react-native';

import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type PublicProfileActionBarProps = {
  hasPendingFollowRequest: boolean;
  isBlockedByCurrent: boolean;
  isFollowing: boolean;
  onFollowPress: () => void;
  onMorePress: () => void;
  onUnblockPress: () => void;
};

export function PublicProfileActionBar({
  hasPendingFollowRequest,
  isBlockedByCurrent,
  isFollowing,
  onFollowPress,
  onMorePress,
  onUnblockPress,
}: PublicProfileActionBarProps) {
  return (
    <View style={styles.profileActionRow}>
      {isBlockedByCurrent ? (
        <PrimaryButton
          title={tr.profile.actions.unblock}
          variant="secondary"
          onPress={onUnblockPress}
          style={styles.unblockButton}
          textStyle={styles.unblockButtonText}
        />
      ) : (
        <InstantPressable
          accessibilityLabel={
            isFollowing
              ? tr.profile.actions.following
              : hasPendingFollowRequest
                ? tr.profile.actions.requestSent
                : tr.profile.actions.follow
          }
          accessibilityRole="button"
          accessibilityState={{ selected: isFollowing || hasPendingFollowRequest }}
          onPress={onFollowPress}
          style={[
            styles.followButton,
            isFollowing || hasPendingFollowRequest ? styles.followButtonPassive : null,
          ]}
        >
          {isFollowing ? (
            <UserMinus color={colors.textMuted} size={14} />
          ) : (
            <UserPlus
              color={hasPendingFollowRequest ? colors.textMuted : colors.onPrimary}
              size={14}
            />
          )}
          <Text
            style={[
              styles.followText,
              isFollowing || hasPendingFollowRequest ? styles.followTextPassive : null,
            ]}
          >
            {isFollowing
              ? tr.profile.actions.following
              : hasPendingFollowRequest
                ? tr.profile.actions.requestSent
                : tr.profile.actions.follow}
          </Text>
        </InstantPressable>
      )}

      <IconButton
        accessibilityLabel={tr.profile.actions.menuTitle}
        onPress={onMorePress}
        style={styles.moreButton}
        variant="surface"
      >
        <Ellipsis color={colors.textMuted} size={18} />
      </IconButton>
    </View>
  );
}

const styles = StyleSheet.create({
  profileActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  followButton: {
    minHeight: 44,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  followButtonPassive: {
    backgroundColor: colors.surfaceMuted,
  },
  followText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  followTextPassive: {
    color: colors.textMuted,
  },
  unblockButton: {
    minHeight: 44,
    paddingHorizontal: 14,
  },
  unblockButtonText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  moreButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
  },
});
