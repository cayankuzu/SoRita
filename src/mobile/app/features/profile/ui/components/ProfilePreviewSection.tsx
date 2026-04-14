import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ProfileHero } from '@/mobile/app/features/profile/ui/components/ProfileHero';
import { ProfileInterestChips } from '@/mobile/app/features/profile/ui/components/ProfileInterestChips';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

type ProfilePreviewSectionProps = {
  name: string;
  username: string;
  bio?: string;
  profilePhoto?: string;
  coverPhoto?: string;
  interestIds?: string[];
};

export function ProfilePreviewSection({
  name,
  username,
  bio,
  profilePhoto,
  coverPhoto,
  interestIds,
}: ProfilePreviewSectionProps) {
  return (
    <View style={styles.form}>
      <View style={styles.previewCard}>
        <Text style={styles.previewTitle}>{tr.settings.editProfile.profilePreviewTitle}</Text>
        <Text style={styles.previewNote}>{tr.settings.editProfile.profilePreviewNote}</Text>
      </View>

      <View style={styles.previewSurface}>
        <ProfileHero
          name={name}
          username={username}
          bio={bio}
          profilePhoto={profilePhoto}
          coverPhoto={coverPhoto}
          coverBackgroundColor={colors.ownProfileCover}
          stats={[]}
          detailsContent={<ProfileInterestChips interestIds={interestIds} />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  previewCard: {
    gap: 4,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  previewNote: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  previewSurface: {
    backgroundColor: colors.surface,
    marginHorizontal: -16,
  },
});
