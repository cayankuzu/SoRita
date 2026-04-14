import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { User } from '@/mobile/app/data/contracts/entities';
import { discoveryTileStyles as styles } from '@/mobile/app/features/discovery/ui/components/discoveryTileStyles';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { tr } from '@/mobile/app/shared/i18n/tr';

export type UserGridTileProps = {
  user: User;
  isFollowing: boolean;
  isPending?: boolean;
  onPress: () => void;
  onFollowPress: () => void;
};

function UserGridTileComponent({
  user,
  isFollowing,
  isPending = false,
  onPress,
  onFollowPress,
}: UserGridTileProps) {
  return (
    <Pressable onPress={onPress} style={styles.tile}>
      <View style={styles.userCover}>
        {user.coverPhoto ? <Image source={{ uri: user.coverPhoto }} style={StyleSheet.absoluteFillObject} /> : null}
      </View>

      <View style={styles.userAvatarWrap}>
        <View style={styles.userAvatarFrame}>
          <AvatarView uri={user.profilePhoto} name={user.name} size={60} />
        </View>
      </View>

      <View style={styles.userTileBody}>
        <ExpandableText text={user.name} collapsedLines={1} textStyle={styles.tileTitle} showIndicator={false} />
        <ExpandableText text={`@${user.username}`} collapsedLines={1} textStyle={styles.ownerUsername} showIndicator={false} />
        {user.bio ? (
          <ExpandableText text={user.bio} collapsedLines={1} textStyle={styles.tileDescription} />
        ) : null}
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onFollowPress();
          }}
          style={[styles.followButton, isFollowing || isPending ? styles.followButtonPassive : null]}
        >
          <Text
            style={[
              styles.followButtonText,
              isFollowing || isPending ? styles.followButtonTextPassive : null,
            ]}
          >
            {isFollowing ? tr.cards.following : isPending ? 'Istek gonderildi' : tr.cards.follow}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function areUserGridTilePropsEqual(previous: UserGridTileProps, next: UserGridTileProps) {
  return (
    previous.user === next.user &&
    previous.isFollowing === next.isFollowing &&
    previous.isPending === next.isPending
  );
}

export const UserGridTile = React.memo(UserGridTileComponent, areUserGridTilePropsEqual);
