import React from 'react';
import { Ban } from 'lucide-react-native';
import { Text, View } from 'react-native';

import type { User } from '@/mobile/app/data/contracts/entities';
import { SettingsHeader } from '@/mobile/app/features/settings/ui/components/SettingsHeader';
import { settingsScreenStyles as styles } from '@/mobile/app/features/settings/ui/components/settingsScreenStyles';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

type SettingsBlockedUsersViewProps = {
  blockedUsers: User[];
  onBack: () => void;
  onOpenBlockedUser: (userId: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
};

export function SettingsBlockedUsersView({
  blockedUsers,
  onBack,
  onOpenBlockedUser,
  onRefresh,
  refreshing,
}: SettingsBlockedUsersViewProps) {
  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <SettingsHeader title={tr.settings.blocked.title} onBack={onBack} />
      {blockedUsers.length === 0 ? (
        <EmptyState
          icon={<Ban color={colors.textSoft} size={34} />}
          title={tr.settings.blocked.emptyTitle}
          description={tr.settings.blocked.emptyDescription}
        />
      ) : (
        <View style={styles.blockedList}>
          {blockedUsers.map((blockedUser) => (
            <InstantPressable
              key={blockedUser.id}
              style={styles.blockedUserRow}
              onPress={() => onOpenBlockedUser(blockedUser.id)}
            >
              <AvatarView uri={blockedUser.profilePhoto} name={blockedUser.name} size={48} />
              <View style={styles.blockedUserBody}>
                <Text style={styles.blockedUserName}>{blockedUser.name}</Text>
                <Text style={styles.blockedUserUsername}>@{blockedUser.username}</Text>
                {blockedUser.bio ? (
                  <ExpandableText text={blockedUser.bio} collapsedLines={1} textStyle={styles.blockedUserBio} />
                ) : null}
              </View>
              <Text style={styles.blockedUserAction}>Profili gor</Text>
            </InstantPressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
