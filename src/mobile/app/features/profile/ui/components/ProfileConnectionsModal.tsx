import React from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Users, X } from 'lucide-react-native';
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { paddingTop: 20 + insets.top, paddingBottom: 20 + insets.bottom }]}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X color={colors.textSoft} size={18} />
            </Pressable>
          </View>

          {users.length === 0 ? (
            <EmptyState
              icon={<Users color={colors.textSoft} size={28} />}
              title={emptyTitle}
              description=""
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
              {users.map((user) => (
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
