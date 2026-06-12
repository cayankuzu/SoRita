import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

import { ProfileStatsRow } from '@/mobile/app/features/profile/ui/components/ProfileStatsRow';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type ProfileStat = {
  label: string;
  value: number;
};

type ProfileHeroProps = {
  name: string;
  username: string;
  bio?: string;
  profilePhoto?: string;
  coverPhoto?: string;
  coverBackgroundColor: string;
  stats: ProfileStat[];
  action?: React.ReactNode;
  detailsContent?: React.ReactNode;
  onProfilePhotoPress?: () => void;
  onCoverPhotoPress?: () => void;
  onBackPress?: () => void;
};

export function ProfileHero({
  name,
  username,
  bio,
  profilePhoto,
  coverPhoto,
  coverBackgroundColor,
  stats,
  action,
  detailsContent,
  onProfilePhotoPress,
  onCoverPhotoPress,
  onBackPress,
}: ProfileHeroProps) {
  return (
    <View style={styles.header}>
      <View style={[styles.coverWrap, { backgroundColor: coverBackgroundColor }]}>
        {coverPhoto ? (
          <Pressable onPress={onCoverPhotoPress} style={styles.coverPressable}>
            <AppImage
              uri={coverPhoto}
              style={styles.coverImage}
              accessibilityLabel={`${name} kapak fotografi`}
            />
          </Pressable>
        ) : null}

        {onBackPress ? (
          <Pressable onPress={onBackPress} style={styles.backButton}>
            <ArrowLeft color={colors.onPrimary} size={20} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.avatarRow}>
          <Pressable onPress={onProfilePhotoPress} style={styles.avatarFrame}>
            <AvatarView uri={profilePhoto} name={name} size={84} />
          </Pressable>

          {action ? <View style={styles.actionSlot}>{action}</View> : null}
        </View>

        <Text style={styles.name}>{name}</Text>
        <Text style={styles.username}>@{username}</Text>
        {bio ? <ExpandableText text={bio} collapsedLines={3} textStyle={styles.bio} /> : null}

        {detailsContent}
        {stats.length > 0 ? <ProfileStatsRow stats={stats} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.surface,
  },
  coverWrap: {
    height: 112,
    position: 'relative',
  },
  coverPressable: {
    flex: 1,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    left: 12,
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkOverlay,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginTop: -26,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  avatarFrame: {
    borderRadius: radius.pill,
    padding: 4,
    backgroundColor: colors.surface,
  },
  actionSlot: {
    flexShrink: 1,
    marginBottom: 4,
  },
  name: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  username: {
    fontSize: 14,
    color: colors.textSoft,
  },
  bio: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
});
