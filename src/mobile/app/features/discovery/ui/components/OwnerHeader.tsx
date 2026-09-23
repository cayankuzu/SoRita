import React from 'react';
import { Pressable, View } from 'react-native';

import type { User } from '@/mobile/app/data/contracts/entities';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { discoveryTileStyles as styles } from '@/mobile/app/features/discovery/ui/components/discoveryTileStyles';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { avatarSize } from '@/mobile/app/shared/theme/tokens';

type OwnerHeaderProps = {
  owner: User;
  onPress?: () => void;
  onPressIn?: () => void;
};

export function OwnerHeader({ owner, onPress, onPressIn }: OwnerHeaderProps) {
  const interactive = Boolean(onPress);

  return (
    <Pressable
      accessibilityLabel={`${tr.cards.profile}: ${owner.name}, @${owner.username}`}
      accessibilityRole={interactive ? 'button' : undefined}
      disabled={!interactive}
      onPress={onPress}
      onPressIn={interactive ? onPressIn : undefined}
      style={styles.ownerHeader}
    >
      <AvatarView uri={owner.profilePhoto} name={owner.name} size={avatarSize.xs} />
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
