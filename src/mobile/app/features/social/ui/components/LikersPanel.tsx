import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Search, Users, X } from 'lucide-react-native';

import type { FeedActionLiker } from '@/mobile/app/features/social/ui/components/FeedActionTypes';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  avatarSize,
  colors,
  fontWeight,
  iconSize,
  minTouchSize,
  radius,
  spacing,
  textStyle,
  typography,
} from '@/mobile/app/shared/theme/tokens';
import { formatRelativeDateTime } from '@/mobile/app/shared/utils/dateTime';
import { buildAdaptiveFlatListProps } from '@/mobile/app/shared/utils/flatList';
import { normalizeSearchText } from '@/mobile/app/shared/utils/textSort';

type LikersPanelProps = {
  likeCount: number;
  likers: FeedActionLiker[];
  onClose: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  onUserPress?: (userId: string) => void;
};

function matchesLiker(liker: FeedActionLiker, query: string) {
  return (
    normalizeSearchText(liker.name).includes(query) ||
    normalizeSearchText(liker.username).includes(query)
  );
}

export function LikersPanel({
  likeCount,
  likers,
  onClose,
  refreshing = false,
  onRefresh,
  onUserPress,
}: LikersPanelProps) {
  const { height, width } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState('');
  const q = normalizeSearchText(searchQuery);
  const filteredLikers = useMemo(
    () => (q ? likers.filter((liker) => matchesLiker(liker, q)) : likers),
    [likers, q],
  );
  const listProps = useMemo(
    () =>
      buildAdaptiveFlatListProps({
        itemCount: filteredLikers.length,
        viewportHeight: height,
        viewportWidth: width,
      }),
    [filteredLikers.length, height, width],
  );

  return (
    <FlatList
      {...listProps}
      accessibilityState={{ busy: refreshing }}
      style={styles.panel}
      contentContainerStyle={[
        styles.panelContent,
        filteredLikers.length === 0 ? styles.panelContentEmpty : null,
      ]}
      data={filteredLikers}
      keyExtractor={(item) => item.id}
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <Pressable
          accessibilityLabel={`${item.name}, @${item.username}`}
          accessibilityRole={onUserPress ? 'button' : undefined}
          style={styles.likerRow}
          onPress={() => onUserPress?.(item.id)}
          disabled={!onUserPress}
        >
          <AvatarView uri={item.profilePhoto} name={item.name} size={avatarSize.md} />
          <View style={styles.likerBody}>
            <AppText style={styles.panelTitle}>{item.name}</AppText>
            <AppText style={styles.panelMuted}>@{item.username}</AppText>
            {item.likedAt ? (
              <AppText style={styles.panelMuted}>
                {tr.cards.likedAt(formatRelativeDateTime(item.likedAt))}
              </AppText>
            ) : null}
          </View>
        </Pressable>
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={
        <View>
          <View style={styles.panelHeader}>
            <View style={styles.panelTitleRow}>
              <Users color={colors.danger} size={iconSize.sm} />
              <AppText accessibilityRole="header" style={styles.panelTitle}>
                {tr.cards.likedBy}
                {likeCount > 0 ? ` (${likeCount})` : ''}
              </AppText>
            </View>
            <IconButton
              accessibilityLabel={tr.common.close}
              onPress={onClose}
              variant="ghost"
            >
              <X color={colors.textSoft} size={iconSize.sm} />
            </IconButton>
          </View>

          {likers.length > 0 ? (
            <View style={styles.searchWrap}>
              <Search color={colors.textSoft} size={iconSize.xs} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={tr.cards.likersSearchPlaceholder}
                placeholderTextColor={colors.textSoft}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={tr.cards.likersSearchPlaceholder}
                returnKeyType="search"
              />
              {searchQuery ? (
                <IconButton
                  accessibilityLabel={tr.common.clear}
                  onPress={() => setSearchQuery('')}
                  size="sm"
                  variant="ghost"
                >
                  <X color={colors.textSoft} size={iconSize.sm} />
                </IconButton>
              ) : null}
            </View>
          ) : null}

          {q ? (
            <AppText accessibilityLiveRegion="polite" style={styles.searchResultCount}>
              {tr.profile.connections.resultCount(filteredLikers.length)}
            </AppText>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <AppText accessibilityLiveRegion={q ? 'polite' : 'none'} style={styles.panelMuted}>
          {q ? tr.cards.likersSearchNoResult : tr.cards.noLikes}
        </AppText>
      }
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    maxHeight: 288,
  },
  panelContent: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  panelContentEmpty: {
    flexGrow: 1,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  panelTitle: textStyle('metadataText', colors.text, fontWeight.strong),
  searchWrap: {
    minHeight: minTouchSize,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    ...typography.compactBodyText,
    paddingVertical: spacing.sm,
  },
  searchResultCount: {
    marginBottom: spacing.sm,
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.textSoft,
  },
  panelMuted: textStyle('compactBodyText', colors.textSoft),
  separator: {
    height: 8,
  },
  likerRow: {
    minHeight: minTouchSize,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  likerBody: {
    flex: 1,
  },
});
