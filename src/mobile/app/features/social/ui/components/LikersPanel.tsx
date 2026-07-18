import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Search, Users, X } from 'lucide-react-native';

import type { FeedActionLiker } from '@/mobile/app/features/social/ui/components/FeedActionTypes';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import { formatAbsoluteDateTime } from '@/mobile/app/shared/utils/dateTime';
import { buildAdaptiveFlatListProps } from '@/mobile/app/shared/utils/flatList';

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
    liker.name.toLowerCase().includes(query) ||
    liker.username.toLowerCase().includes(query)
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
  const q = searchQuery.trim().toLowerCase();
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
      style={styles.panel}
      contentContainerStyle={[
        styles.panelContent,
        filteredLikers.length === 0 ? styles.panelContentEmpty : null,
      ]}
      data={filteredLikers}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Pressable
          style={styles.likerRow}
          onPress={() => onUserPress?.(item.id)}
          disabled={!onUserPress}
        >
          <AvatarView uri={item.profilePhoto} name={item.name} size={32} />
          <View style={styles.likerBody}>
            <Text style={styles.panelTitle}>{item.name}</Text>
            <Text style={styles.panelMuted}>@{item.username}</Text>
            {item.likedAt ? (
              <Text style={styles.panelMuted}>
                {tr.cards.likedAt(formatAbsoluteDateTime(item.likedAt))}
              </Text>
            ) : null}
          </View>
        </Pressable>
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={
        <View>
          <View style={styles.panelHeader}>
            <View style={styles.panelTitleRow}>
              <Users color={colors.danger} size={16} />
              <Text style={styles.panelTitle}>
                {tr.cards.likedBy}
                {likeCount > 0 ? ` (${likeCount})` : ''}
              </Text>
            </View>
            <Pressable onPress={onClose} accessibilityLabel={tr.common.close} accessibilityRole="button">
              <X color={colors.textSoft} size={16} />
            </Pressable>
          </View>

          {likers.length > 0 ? (
            <View style={styles.searchWrap}>
              <Search color={colors.textSoft} size={15} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={tr.cards.likersSearchPlaceholder}
                placeholderTextColor={colors.textSoft}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={tr.cards.likersSearchPlaceholder}
              />
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.panelMuted}>{q ? tr.cards.likersSearchNoResult : tr.cards.noLikes}</Text>
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
    maxHeight: 320,
  },
  panelContent: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  panelContentEmpty: {
    flexGrow: 1,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  searchWrap: {
    minHeight: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    paddingVertical: 8,
  },
  panelMuted: {
    fontSize: 12,
    color: colors.textSoft,
  },
  separator: {
    height: 10,
  },
  likerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  likerBody: {
    flex: 1,
  },
});
