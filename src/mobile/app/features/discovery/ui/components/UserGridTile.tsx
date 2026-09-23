import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import type { User } from '@/mobile/app/data/contracts/entities';
import { discoveryTileStyles as styles } from '@/mobile/app/features/discovery/ui/components/discoveryTileStyles';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { HighlightedText } from '@/mobile/app/shared/components/ui/HighlightedText';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { avatarSize, colors } from '@/mobile/app/shared/theme/tokens';
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
    <View
      style={[
        styles.tile,
        styles.userTile,
        compact ? styles.tileCompact : null,
        fillWidth ? styles.tileFullWidth : { width: tileWidth },
      ]}
    >
      <InstantPressable
        accessibilityLabel={`${user.name}, @${user.username}`}
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={onPressIn}
        style={styles.userTileMainAction}
      >
        <View style={styles.userCover}>
          {user.coverPhoto ? (
            <AppImage
              uri={user.coverPhoto}
              style={styles.userCover}
              accessibilityLabel={tr.cards.listCoverImageLabel(user.name)}
            />
          ) : null}
        </View>

        <View style={styles.userAvatarWrap}>
          <View style={styles.userAvatarFrame}>
            <AvatarView uri={user.profilePhoto} name={user.name} size={avatarSize.md} />
          </View>
        </View>

        <View style={[styles.userTileBody, styles.userTileBodyMain]}>
          <AppText numberOfLines={1} style={styles.tileTitle}>
            <HighlightedText query={searchQuery} text={user.name} />
          </AppText>
          <AppText numberOfLines={1} style={styles.ownerUsername}>
            <HighlightedText query={searchQuery} text={`@${user.username}`} />
          </AppText>
          {user.bio && !compact ? (
            <AppText numberOfLines={1} style={styles.tileDescription}>
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
