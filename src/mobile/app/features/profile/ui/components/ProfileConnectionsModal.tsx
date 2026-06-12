import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Search, Users, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { User } from '@/mobile/app/data/contracts/entities';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

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
  const [searchQuery, setSearchQuery] = useState('');
  const q = searchQuery.trim().toLowerCase();
  const filteredUsers = useMemo(
    () => (q ? users.filter((user) => matchesUser(user, q)) : users),
    [q, users],
  );

  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      hardwareAccelerated
      navigationBarTranslucent
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      <View style={[styles.overlay, { paddingTop: 20 + insets.top, paddingBottom: 20 + insets.bottom }]}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X color={colors.textSoft} size={18} />
            </Pressable>
          </View>

          {users.length > 0 ? (
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
                placeholder="Kullanici ara..."
                placeholderTextColor={colors.textSoft}
                selectionColor={colors.primary}
                spellCheck={false}
                style={styles.searchInput}
                textContentType="none"
                underlineColorAndroid="transparent"
              />
            </View>
          ) : null}

          {filteredUsers.length === 0 ? (
            <EmptyState
              icon={<Users color={colors.textSoft} size={28} />}
              title={q ? 'Sonuc bulunamadi' : emptyTitle}
              description={q ? 'Farkli bir arama dene.' : ''}
            />
          ) : (
            <ScrollView
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
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
            >
              {filteredUsers.map((user) => (
                <Pressable key={user.id} style={styles.userRow} onPress={() => onUserPress(user)}>
                  <AvatarView uri={user.profilePhoto} name={user.name} size={42} />
                  <View style={styles.userBody}>
                    <Text style={styles.userName}>{user.name}</Text>
                    <Text style={styles.userUsername}>@{user.username}</Text>
                    {user.bio ? (
                      <ExpandableText text={user.bio} collapsedLines={1} textStyle={styles.userBio} />
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
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
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  searchWrap: {
    minHeight: 42,
    marginHorizontal: 16,
    marginTop: 12,
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
    gap: 12,
  },
  userRow: {
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
