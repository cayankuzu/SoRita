import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { User } from '@/mobile/app/data/contracts/entities';
import { discoveryTileStyles as styles } from '@/mobile/app/features/discovery/ui/components/discoveryTileStyles';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { HighlightedText } from '@/mobile/app/shared/components/ui/HighlightedText';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { tr } from '@/mobile/app/shared/i18n/tr';
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

  return (
    <Pressable
      accessibilityLabel={`${user.name}, @${user.username}`}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={onPressIn}
      style={[
        styles.tile,
        styles.userTile,
        compact ? styles.tileCompact : null,
        fillWidth ? styles.tileFullWidth : { width: tileWidth },
      ]}
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
          <AvatarView uri={user.profilePhoto} name={user.name} size={38} />
        </View>
      </View>

      <View style={styles.userTileBody}>
        <ExpandableText
          text={user.name}
          collapsedLines={1}
          textStyle={styles.tileTitle}
          showIndicator={false}
          renderContent={() => <HighlightedText query={searchQuery} text={user.name} />}
        />
        <ExpandableText
          text={`@${user.username}`}
          collapsedLines={1}
          textStyle={styles.ownerUsername}
          showIndicator={false}
          renderContent={() => <HighlightedText query={searchQuery} text={`@${user.username}`} />}
        />
        {user.bio && !compact ? (
          <ExpandableText
            text={user.bio}
            collapsedLines={1}
            textStyle={styles.tileDescription}
            renderContent={() => <HighlightedText query={searchQuery} text={user.bio || ''} />}
          />
        ) : null}
        <InstantPressable
          accessibilityState={{ selected: isFollowing || isPending }}
          hapticFeedback="light"
          hitSlop={5}
          onPress={(event) => {
            event.stopPropagation();
            return onFollowPress();
          }}
          style={[
            styles.followButton,
            isFollowing || isPending ? styles.followButtonPassive : null,
          ]}
        >
          <Text
            style={[
              styles.followButtonText,
              isFollowing || isPending ? styles.followButtonTextPassive : null,
            ]}
          >
            {isFollowing
              ? tr.cards.following
              : isPending
                ? tr.profile.actions.requestSent
                : tr.cards.follow}
          </Text>
        </InstantPressable>
      </View>
    </Pressable>
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
