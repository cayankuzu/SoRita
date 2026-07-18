import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { User } from '@/mobile/app/data/contracts/entities';
import { discoveryTileStyles as styles } from '@/mobile/app/features/discovery/ui/components/discoveryTileStyles';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { getResponsiveDiscoveryTileWidth } from '@/mobile/app/shared/utils/layout';

export type UserGridTileProps = {
  user: User;
  fillWidth?: boolean;
  isFollowing: boolean;
  isPending?: boolean;
  onPress: () => void;
  onFollowPress: () => void;
};

function UserGridTileComponent({
  user,
  fillWidth = false,
  isFollowing,
  isPending = false,
  onPress,
  onFollowPress,
}: UserGridTileProps) {
  const { columnGap, height, width } = useAppLayout();
  const tileWidth = getResponsiveDiscoveryTileWidth(width, height, columnGap);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tile,
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
          <AvatarView uri={user.profilePhoto} name={user.name} size={60} />
        </View>
      </View>

      <View style={styles.userTileBody}>
        <ExpandableText
          text={user.name}
          collapsedLines={1}
          textStyle={styles.tileTitle}
          showIndicator={false}
        />
        <ExpandableText
          text={`@${user.username}`}
          collapsedLines={1}
          textStyle={styles.ownerUsername}
          showIndicator={false}
        />
        {user.bio ? (
          <ExpandableText
            text={user.bio}
            collapsedLines={1}
            textStyle={styles.tileDescription}
          />
        ) : null}
        <InstantPressable
          onPress={(event) => {
            event.stopPropagation();
            onFollowPress();
          }}
          style={[
            styles.followButton,
            isFollowing || isPending ? styles.followButtonPassive : null,
          ]}
          preventRepeatWhileBusy={false}
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
    previous.isFollowing === next.isFollowing &&
    previous.isPending === next.isPending
  );
}

export const UserGridTile = React.memo(
  UserGridTileComponent,
  areUserGridTilePropsEqual,
);
