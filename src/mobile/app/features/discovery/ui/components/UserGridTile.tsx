import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { User } from '@/mobile/app/data/contracts/entities';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { HighlightedText } from '@/mobile/app/shared/components/ui/HighlightedText';
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

export type UserGridTileProps = {
  user: User;
  isFollowing: boolean;
  isPending?: boolean;
  onPress: () => void;
  onPressIn?: () => void;
  onFollowPress: () => void | Promise<void>;
  searchQuery?: string;
};

/**
 * A suggested person in Explore's three-column grid, like the other tabs:
 * photo, name and username centred over a compact Follow, the way
 * Instagram's suggestion cards stack them. The tile fills its grid cell.
 */
function UserGridTileComponent({
  user,
  isFollowing,
  isPending = false,
  onPress,
  onPressIn,
  onFollowPress,
  searchQuery,
}: UserGridTileProps) {
  const followStatus = isFollowing
    ? tr.cards.following
    : isPending
      ? tr.profile.actions.requestSent
      : tr.cards.follow;
  const followActionLabel = isFollowing ? tr.profile.actions.unfollow : followStatus;

  return (
    <View style={styles.tile}>
      <InstantPressable
        accessibilityLabel={`${user.name}, @${user.username}`}
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={onPressIn}
        style={styles.identity}
      >
        <AvatarView uri={user.profilePhoto} name={user.name} size={avatarSize.lg} />
        <View style={styles.copy}>
          <AppText numberOfLines={1} style={styles.name}>
            <HighlightedText query={searchQuery} text={user.name} />
          </AppText>
          <AppText numberOfLines={1} style={styles.username}>
            <HighlightedText query={searchQuery} text={`@${user.username}`} />
          </AppText>
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
  tile: {
    width: '100%',
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  identity: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  copy: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  name: textStyle('labelText', colors.text, fontWeight.strong),
  username: textStyle('metadataText', colors.textSoft),
  followButton: {
    minHeight: controlSize.compact,
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
  followButtonText: textStyle('metadataText', colors.onPrimary, fontWeight.strong),
  followButtonTextPassive: {
    color: colors.text,
  },
});
