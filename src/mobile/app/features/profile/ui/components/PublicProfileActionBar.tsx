import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { Ellipsis, UserMinus, UserPlus } from 'lucide-react-native';

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
  onFollowPress: () => Promise<void>;
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
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const disabled = hasPendingFollowRequest || isSubmitting;
  const actionLabel = isFollowing
    ? tr.profile.actions.unfollow
    : hasPendingFollowRequest
      ? tr.profile.actions.requestSent
      : tr.profile.actions.follow;
  const handleFollowPress = async () => {
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
            actionLabel
          }
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
            <UserMinus color={colors.textMuted} size={iconSize.xs} />
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
