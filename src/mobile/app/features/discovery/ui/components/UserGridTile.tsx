import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { User } from '@/mobile/app/data/contracts/entities';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { HighlightedText } from '@/mobile/app/shared/components/ui/HighlightedText';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  avatarSize,
  colors,
  controlSize,
  fontWeight,
  hitSlopFor,
  radius,
  spacing,
  textStyle,
} from '@/mobile/app/shared/theme/tokens';
import { getResponsiveDiscoveryTileWidth } from '@/mobile/app/shared/utils/layout';

export type UserGridTileProps = {
  user: User;
  fillWidth?: boolean;
  compact?: boolean;
  isFollowing: boolean;
  isPending?: boolean;
  onPress: () => void;
  onPressIn?: () => void;
  onFollowPress: () => void | Promise<void>;
  searchQuery?: string;
};

/**
 * A person in a suggestion list: photo, name, username and a line of bio,
 * with a compact Follow beside them, the way Instagram lists suggestions.
 * Each person used to be a card with a cover band and a full-width button,
 * about a quarter of the screen tall.
 */
function UserGridTileComponent({
  user,
  fillWidth = false,
  compact = false,
  isFollowing,
  isPending = false,
  onPress,
  onPressIn,
  onFollowPress,
  searchQuery,
}: UserGridTileProps) {
  const { columnGap, height, width } = useAppLayout();
  const tileWidth = getResponsiveDiscoveryTileWidth(width, height, columnGap);
  const followStatus = isFollowing
    ? tr.cards.following
    : isPending
      ? tr.profile.actions.requestSent
      : tr.cards.follow;
  const followActionLabel = isFollowing ? tr.profile.actions.unfollow : followStatus;

  return (
    <View style={[styles.row, fillWidth ? styles.fillWidth : { width: tileWidth }]}>
      <InstantPressable
        accessibilityLabel={`${user.name}, @${user.username}`}
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={onPressIn}
        style={styles.identity}
      >
        <AvatarView uri={user.profilePhoto} name={user.name} size={avatarSize.md} />
        <View style={styles.copy}>
          <AppText numberOfLines={1} style={styles.name}>
            <HighlightedText query={searchQuery} text={user.name} />
          </AppText>
          <AppText numberOfLines={1} style={styles.username}>
            <HighlightedText query={searchQuery} text={`@${user.username}`} />
          </AppText>
          {user.bio && !compact ? (
            <AppText numberOfLines={1} style={styles.bio}>
              <HighlightedText query={searchQuery} text={user.bio} />
            </AppText>
          ) : null}
        </View>
      </InstantPressable>

      <InstantPressable
        accessibilityLabel={`${followActionLabel}: ${user.name}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: isPending, selected: isFollowing }}
        disabled={isPending}
        hapticFeedback="light"
        hitSlop={hitSlopFor(controlSize.compact)}
        onPress={() => onFollowPress()}
        style={({ busy }) => [
          styles.followButton,
          isFollowing || isPending || busy ? styles.followButtonPassive : null,
        ]}
      >
        {({ busy }) => (
          <View style={styles.followButtonContent}>
            {busy ? <ActivityIndicator color={colors.textMuted} size="small" /> : null}
            <AppText
              accessibilityLiveRegion={busy ? 'polite' : 'none'}
              numberOfLines={1}
              style={[
                styles.followButtonText,
                isFollowing || isPending || busy ? styles.followButtonTextPassive : null,
              ]}
            >
              {busy ? tr.common.loading : followStatus}
            </AppText>
          </View>
        )}
      </InstantPressable>
    </View>
  );
}

function areUserGridTilePropsEqual(
  previous: UserGridTileProps,
  next: UserGridTileProps,
) {
  return (
    previous.user === next.user &&
    previous.fillWidth === next.fillWidth &&
    previous.compact === next.compact &&
    previous.isFollowing === next.isFollowing &&
    previous.isPending === next.isPending
    && previous.searchQuery === next.searchQuery &&
    previous.onFollowPress === next.onFollowPress &&
    previous.onPress === next.onPress &&
    previous.onPressIn === next.onPressIn
  );
}

export const UserGridTile = React.memo(
  UserGridTileComponent,
  areUserGridTilePropsEqual,
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  fillWidth: {
    width: '100%',
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: controlSize.large,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
  },
  name: textStyle('labelText', colors.text, fontWeight.strong),
  username: textStyle('metadataText', colors.textSoft),
  bio: textStyle('metadataText', colors.textMuted),
  followButton: {
    minHeight: controlSize.compact,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  followButtonPassive: {
    backgroundColor: colors.surfaceMuted,
  },
  followButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  followButtonText: textStyle('labelText', colors.onPrimary, fontWeight.strong),
  followButtonTextPassive: {
    color: colors.text,
  },
});
