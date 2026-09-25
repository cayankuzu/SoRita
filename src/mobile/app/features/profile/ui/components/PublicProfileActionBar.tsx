import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { Ellipsis, UserCheck, UserPlus } from 'lucide-react-native';

import { UnfollowConfirmModal } from '@/mobile/app/shared/components/feedback/UnfollowConfirmModal';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize, minTouchSize, radius, spacing, textStyle } from '@/mobile/app/shared/theme/tokens';

type PublicProfileActionBarProps = {
  hasPendingFollowRequest: boolean;
  isBlockedByCurrent: boolean;
  isFollowing: boolean;
  // A private account takes a new request to see again after unfollowing.
  isPrivateAccount?: boolean;
  onFollowPress: () => Promise<void>;
  onMorePress: () => void;
  onUnblockPress: () => void;
  username: string;
};

export function PublicProfileActionBar({
  hasPendingFollowRequest,
  isBlockedByCurrent,
  isFollowing,
  isPrivateAccount = false,
  onFollowPress,
  onMorePress,
  onUnblockPress,
  username,
}: PublicProfileActionBarProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [confirmUnfollowVisible, setConfirmUnfollowVisible] = React.useState(false);
  const disabled = hasPendingFollowRequest || isSubmitting;
  // Following reads as a state, as on Instagram; unfollowing asks first. One
  // tap used to unfollow at once, and on a private account that meant
  // sending a new request to see them again.
  const actionLabel = isFollowing
    ? tr.profile.actions.following
    : hasPendingFollowRequest
      ? tr.profile.actions.requestSent
      : tr.profile.actions.follow;
  const submitFollow = async () => {
    if (disabled) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onFollowPress();
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleFollowPress = async () => {
    if (isFollowing) {
      setConfirmUnfollowVisible(true);
      return;
    }

    await submitFollow();
  };

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
          accessibilityHint={isFollowing ? tr.profile.actions.unfollowHint : undefined}
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          accessibilityState={{
            busy: isSubmitting,
            disabled,
            selected: isFollowing || hasPendingFollowRequest,
          }}
          disabled={disabled}
          onPress={handleFollowPress}
          style={[
            styles.followButton,
            isFollowing || hasPendingFollowRequest ? styles.followButtonPassive : null,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator
              color={isFollowing ? colors.textMuted : colors.onPrimary}
              size="small"
            />
          ) : isFollowing ? (
            <UserCheck color={colors.textMuted} size={iconSize.xs} />
          ) : (
            <UserPlus
              color={hasPendingFollowRequest ? colors.textMuted : colors.onPrimary}
              size={iconSize.xs}
            />
          )}
          <AppText
            style={[
              styles.followText,
              isFollowing || hasPendingFollowRequest ? styles.followTextPassive : null,
            ]}
          >
            {actionLabel}
          </AppText>
        </InstantPressable>
      )}

      <IconButton
        accessibilityLabel={tr.profile.actions.menuTitle}
        onPress={onMorePress}
        style={styles.moreButton}
        variant="surface"
      >
        <Ellipsis color={colors.textMuted} size={iconSize.sm} />
      </IconButton>

      <UnfollowConfirmModal
        target={confirmUnfollowVisible ? { isPrivateAccount, username } : null}
        onClose={() => setConfirmUnfollowVisible(false)}
        onConfirm={async () => {
          setConfirmUnfollowVisible(false);
          await submitFollow();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  profileActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  followButton: {
    minHeight: minTouchSize,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  followButtonPassive: {
    backgroundColor: colors.surfaceMuted,
  },
  followText: textStyle('labelText', colors.onPrimary),
  followTextPassive: {
    color: colors.textMuted,
  },
  unblockButton: {
    minHeight: minTouchSize,
    paddingHorizontal: spacing.md,
  },
  unblockButtonText: textStyle('labelText', colors.textMuted),
  moreButton: {
    width: minTouchSize,
    height: minTouchSize,
    borderRadius: radius.md,
  },
});
