import React from 'react';
import { Ban } from 'lucide-react-native';
import { FlatList, useWindowDimensions, View } from 'react-native';

import type { User } from '@/mobile/app/data/contracts/entities';
import { SettingsHeader } from '@/mobile/app/features/settings/ui/components/SettingsHeader';
import { settingsScreenStyles as styles } from '@/mobile/app/features/settings/ui/components/settingsScreenStyles';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { avatarSize, colors, iconSize } from '@/mobile/app/shared/theme/tokens';
import { buildAdaptiveFlatListProps } from '@/mobile/app/shared/utils/flatList';

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
  const { height, width } = useWindowDimensions();
  const listProps = React.useMemo(
    () =>
      buildAdaptiveFlatListProps({
        itemCount: blockedUsers.length,
        viewportHeight: height,
        viewportWidth: width,
      }),
    [blockedUsers.length, height, width],
  );

  return (
    <Screen scroll={false} variant="settings">
      <FlatList
        {...listProps}
        accessibilityState={{ busy: refreshing }}
        data={blockedUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <InstantPressable
            accessibilityLabel={`${tr.settings.blocked.viewProfile}: ${item.name}, @${item.username}`}
            accessibilityRole="button"
            style={styles.blockedUserRow}
            onPress={() => onOpenBlockedUser(item.id)}
          >
            <AvatarView uri={item.profilePhoto} name={item.name} size={avatarSize.md} />
            <View style={styles.blockedUserBody}>
              <AppText style={styles.blockedUserName}>{item.name}</AppText>
              <AppText style={styles.blockedUserUsername}>@{item.username}</AppText>
              {item.bio ? (
                <AppText numberOfLines={1} style={styles.blockedUserBio}>{item.bio}</AppText>
              ) : null}
            </View>
            <AppText style={styles.blockedUserAction}>{tr.settings.blocked.viewProfile}</AppText>
          </InstantPressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.blockedSeparator} />}
        ListHeaderComponent={<SettingsHeader title={tr.settings.blocked.title} onBack={onBack} />}
        ListEmptyComponent={
          <EmptyState
            icon={<Ban color={colors.textSoft} size={iconSize.xl} />}
            title={tr.settings.blocked.emptyTitle}
            description={tr.settings.blocked.emptyDescription}
          />
        }
        contentContainerStyle={[
          styles.blockedList,
          blockedUsers.length === 0 ? styles.blockedListEmpty : null,
        ]}
        refreshing={refreshing}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
