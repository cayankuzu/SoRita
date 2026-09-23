import React, { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Search, Users, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { User } from '@/mobile/app/data/contracts/entities';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { useModalAnimationType } from '@/mobile/app/shared/hooks/useModalAnimationType';
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
import { normalizeSearchText } from '@/mobile/app/shared/utils/textSort';
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
  const animationType = useModalAnimationType('slide');
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
    minHeight: 240,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const q = normalizeSearchText(searchQuery);
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
    if (visible) {
      const announceTimer = setTimeout(() => {
        AccessibilityInfo.announceForAccessibility(title);
      }, 120);

      return () => clearTimeout(announceTimer);
    } else {
      setSearchQuery('');
    }

    return undefined;
  }, [title, visible]);

  return (
    <Modal
      {...getAndroidModalWindowProps({
        navigationBarTranslucent: true,
        statusBarTranslucent: true,
      })}
      visible={visible}
      transparent
      animationType={animationType}
      hardwareAccelerated
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <KeyboardAvoidingView
        accessibilityViewIsModal
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        importantForAccessibility="yes"
        onAccessibilityEscape={onClose}
        style={[styles.overlay, { paddingTop, paddingBottom }]}
      >
        <InstantPressable
          disableFeedback
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={onClose}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[styles.card, { maxHeight: cardMaxHeight }]}>
          <View accessibilityElementsHidden style={styles.handle} />
          <View style={styles.header}>
            <AppText accessibilityRole="header" style={styles.title}>{title}</AppText>
            <IconButton
              accessibilityLabel={tr.common.close}
              onPress={onClose}
              style={styles.closeButton}
              variant="surface"
            >
              <X color={colors.textSoft} size={iconSize.sm} />
            </IconButton>
          </View>

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
                  <AppText style={styles.userName}>{item.name}</AppText>
                  <AppText style={styles.userUsername}>@{item.username}</AppText>
                  {item.bio ? (
                    <ExpandableText text={item.bio} collapsedLines={1} textStyle={styles.userBio} />
                  ) : null}
                </View>
              </InstantPressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
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
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 648,
    alignSelf: 'center',
    maxHeight: '90%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  handle: {
    width: 34,
    height: 4,
    marginTop: spacing.sm,
    marginBottom: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  title: textStyle('compactTitleText', colors.text),
  closeButton: {
    width: minTouchSize,
    height: minTouchSize,
  },
  searchWrap: {
    minHeight: minTouchSize,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
  list: {
    padding: spacing.md,
    paddingTop: spacing.md,
  },
  listEmpty: {
    flexGrow: 1,
  },
  separator: {
    height: 10,
  },
  userRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
  },
  userBody: {
    flex: 1,
  },
  userName: textStyle('labelText', colors.text),
  userUsername: {
    marginTop: 1,
    ...typography.compactBodyText,
    color: colors.textSoft,
  },
  userBio: {
    marginTop: spacing.xs,
    ...typography.captionText,
    color: colors.textMuted,
  },
  resultCount: {
    ...typography.captionText,
    color: colors.textSoft,
    paddingTop: spacing.md,
    textAlign: 'center',
  },
});
