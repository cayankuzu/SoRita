import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Search, Users, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { User } from '@/mobile/app/data/contracts/entities';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import { buildAdaptiveFlatListProps } from '@/mobile/app/shared/utils/flatList';
import {
  getAndroidModalWindowProps,
  getModalContentMaxHeight,
  getModalSafeAreaPadding,
} from '@/mobile/app/shared/utils/modalLayout';

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
    user.name.toLowerCase().includes(query) ||
    user.username.toLowerCase().includes(query) ||
    Boolean(user.bio?.toLowerCase().includes(query))
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
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { paddingTop, paddingBottom } = getModalSafeAreaPadding({
    topInset: insets.top,
    bottomInset: insets.bottom,
    topSpacing: 20,
    bottomSpacing: 20,
    minBottomPadding: Platform.OS === 'android' ? 24 : 20,
  });
  const cardMaxHeight = getModalContentMaxHeight({
    viewportHeight: height,
    paddingTop,
    paddingBottom,
    maxHeightRatio: 0.72,
    minHeight: 280,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const q = searchQuery.trim().toLowerCase();
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
    if (!visible) {
      setSearchQuery('');
    }
  }, [visible]);

  return (
    <Modal
      {...getAndroidModalWindowProps({
        navigationBarTranslucent: true,
        statusBarTranslucent: true,
      })}
      visible={visible}
      transparent
      animationType="fade"
      hardwareAccelerated
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <View style={[styles.overlay, { paddingTop, paddingBottom }]}>
        <View style={[styles.card, { maxHeight: cardMaxHeight }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <IconButton
              accessibilityLabel={tr.common.close}
              onPress={onClose}
              style={styles.closeButton}
              variant="surface"
            >
              <X color={colors.textSoft} size={18} />
            </IconButton>
          </View>

          <FlatList
            {...listProps}
            data={filteredUsers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                accessibilityLabel={`${item.name}, @${item.username}`}
                accessibilityRole="button"
                style={styles.userRow}
                onPress={() => onUserPress(item)}
              >
                <AvatarView uri={item.profilePhoto} name={item.name} size={42} />
                <View style={styles.userBody}>
                  <Text style={styles.userName}>{item.name}</Text>
                  <Text style={styles.userUsername}>@{item.username}</Text>
                  {item.bio ? (
                    <ExpandableText text={item.bio} collapsedLines={1} textStyle={styles.userBio} />
                  ) : null}
                </View>
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListHeaderComponent={
              users.length > 0 ? (
                <View style={styles.searchWrap}>
                  <Search color={colors.textSoft} size={16} />
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
                    underlineColorAndroid="transparent"
                    accessibilityLabel={tr.profile.connections.searchPlaceholder}
                  />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <EmptyState
                icon={<Users color={colors.textSoft} size={28} />}
                title={q ? tr.profile.connections.searchNoResult : emptyTitle}
                description={q ? tr.profile.connections.searchTryDifferent : ''}
              />
            }
            contentContainerStyle={[
              styles.list,
              filteredUsers.length === 0 ? styles.listEmpty : null,
            ]}
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
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    maxHeight: '72%',
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  closeButton: {
    width: 44,
    height: 44,
  },
  searchWrap: {
    minHeight: 48,
    marginBottom: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  list: {
    padding: 16,
    paddingTop: 12,
  },
  listEmpty: {
    flexGrow: 1,
  },
  separator: {
    height: 12,
  },
  userRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    padding: 12,
  },
  userBody: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  userUsername: {
    marginTop: 1,
    fontSize: 12,
    color: colors.textSoft,
  },
  userBio: {
    marginTop: 3,
    fontSize: 12,
    color: colors.textMuted,
  },
});
