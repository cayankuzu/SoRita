import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Search, Users, X } from 'lucide-react-native';

import type { User } from '@/mobile/app/data/contracts/entities';
import { ModalScaffold } from '@/mobile/app/shared/components/feedback/ModalScaffold';
import { SheetHeader } from '@/mobile/app/shared/components/feedback/SheetHeader';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  avatarSize,
  colors,
  iconSize,
  minTouchSize,
  radius,
  spacing,
  textStyle,
  typography,
} from '@/mobile/app/shared/theme/tokens';
import { buildAdaptiveFlatListProps } from '@/mobile/app/shared/utils/flatList';
import { normalizeSearchQuery, normalizeSearchText } from '@/mobile/app/shared/utils/textSort';

type ProfileConnectionsModalProps = {
  visible: boolean;
  title: string;
  users: User[];
  emptyTitle: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  onClose: () => void;
  onUserPress: (user: User) => void;
};

function matchesUser(user: User, query: string) {
  return (
    normalizeSearchText(user.name).includes(query) ||
    normalizeSearchText(user.username).includes(query) ||
    normalizeSearchText(user.bio).includes(query)
  );
}

export function ProfileConnectionsModal({
  visible,
  title,
  users,
  emptyTitle,
  refreshing = false,
  onRefresh,
  onClose,
  onUserPress,
}: ProfileConnectionsModalProps) {
  const { height, width } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState('');
  const q = normalizeSearchQuery(searchQuery);
  const filteredUsers = useMemo(
    () => (q ? users.filter((user) => matchesUser(user, q)) : users),
    [q, users],
  );
  const listProps = useMemo(
    () =>
      buildAdaptiveFlatListProps({
        itemCount: filteredUsers.length,
        viewportHeight: height,
        viewportWidth: width,
      }),
    [filteredUsers.length, height, width],
  );

  useEffect(() => {
    if (!visible) setSearchQuery('');
  }, [visible]);

  return (
    <ModalScaffold
      accessibilityLabel={title}
      contentContainerStyle={styles.content}
      dismissOnBackdropPress
      onClose={onClose}
      variant="sheet"
      visible={visible}
    >
      <SheetHeader divided onClose={onClose} style={styles.header} title={title} />

      <FlatList
        {...listProps}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <InstantPressable
            accessibilityLabel={`${item.name}, @${item.username}`}
            accessibilityRole="button"
            style={styles.userRow}
            onPress={() => onUserPress(item)}
          >
            <AvatarView uri={item.profilePhoto} name={item.name} size={avatarSize.md} />
            <View style={styles.userBody}>
              <AppText numberOfLines={1} style={styles.userName}>{item.name}</AppText>
              <AppText numberOfLines={1} style={styles.userUsername}>@{item.username}</AppText>
              {item.bio ? (
                <AppText numberOfLines={1} style={styles.userBio}>{item.bio}</AppText>
              ) : null}
            </View>
          </InstantPressable>
        )}
        ListHeaderComponent={
          users.length > 0 ? (
            <View>
              <View style={styles.searchWrap}>
                <Search color={colors.textSoft} size={iconSize.sm} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                  cursorColor={colors.primary}
                  keyboardAppearance="light"
                  placeholder={tr.profile.connections.searchPlaceholder}
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.primary}
                  spellCheck={false}
                  style={styles.searchInput}
                  textContentType="none"
                  returnKeyType="search"
                  underlineColorAndroid="transparent"
                  accessibilityLabel={tr.profile.connections.searchPlaceholder}
                />
                {searchQuery && Platform.OS !== 'ios' ? (
                  <IconButton
                    accessibilityLabel={tr.common.clear}
                    onPress={() => setSearchQuery('')}
                    size="sm"
                  >
                    <X color={colors.textSoft} size={iconSize.sm} />
                  </IconButton>
                ) : null}
              </View>
              {q ? (
                <AppText accessibilityLiveRegion="polite" style={styles.resultCount}>
                  {tr.profile.connections.resultCount(filteredUsers.length)}
                </AppText>
              ) : null}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon={<Users color={colors.textSoft} size={iconSize.lg} />}
            title={q ? tr.profile.connections.searchNoResult : emptyTitle}
            description={q ? tr.profile.connections.searchTryDifferent : ''}
          />
        }
        contentContainerStyle={[styles.list, filteredUsers.length === 0 ? styles.listEmpty : null]}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
        style={styles.listFrame}
      />
    </ModalScaffold>
  );
}

const styles = StyleSheet.create({
  // The list owns its insets so it can scroll edge to edge under the header.
  content: {
    flexShrink: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    gap: 0,
  },
  header: {
    paddingHorizontal: spacing.screen,
  },
  listFrame: {
    flexShrink: 1,
  },
  list: {
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
  },
  listEmpty: {
    flexGrow: 1,
  },
  searchWrap: {
    minHeight: minTouchSize,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    ...typography.bodyText,
    paddingVertical: 0,
  },
  // A plain row, as in every people list: the avatar and name carry it, not a card.
  userRow: {
    minHeight: minTouchSize + spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  userBody: {
    flex: 1,
    minWidth: 0,
  },
  userName: textStyle('labelText', colors.text),
  userUsername: textStyle('compactBodyText', colors.textSoft),
  userBio: {
    marginTop: spacing.xxs,
    ...typography.captionText,
    color: colors.textMuted,
  },
  resultCount: {
    ...typography.captionText,
    color: colors.textSoft,
    paddingVertical: spacing.sm,
    textAlign: 'center',
  },
});
