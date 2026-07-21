import React from 'react';
import { Pressable, View } from 'react-native';

import type { User } from '@/mobile/app/data/contracts/entities';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { discoveryTileStyles as styles } from '@/mobile/app/features/discovery/ui/components/discoveryTileStyles';

type OwnerHeaderProps = {
  owner: User;
  onPress?: () => void;
};

export function OwnerHeader({ owner, onPress }: OwnerHeaderProps) {
  return (
    <Pressable onPress={onPress} style={styles.ownerHeader}>
      <AvatarView uri={owner.profilePhoto} name={owner.name} size={16} />
      <View style={styles.ownerBody}>
        <ExpandableText text={owner.name} collapsedLines={1} textStyle={styles.ownerName} showIndicator={false} />
        <ExpandableText
          text={`@${owner.username}`}
          collapsedLines={1}
          textStyle={styles.ownerUsername}
          showIndicator={false}
        />
      </View>
    </Pressable>
  );
}
