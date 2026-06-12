import React, { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Search, Users, X } from 'lucide-react-native';

import type { FeedActionLiker } from '@/mobile/app/features/social/ui/components/FeedActionTypes';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import { formatAbsoluteDateTime } from '@/mobile/app/shared/utils/dateTime';

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
  const [searchQuery, setSearchQuery] = useState('');
  const q = searchQuery.trim().toLowerCase();
  const filteredLikers = useMemo(
    () => (q ? likers.filter((liker) => matchesLiker(liker, q)) : likers),
    [likers, q],
  );

  return (
    <ScrollView
      style={styles.panel}
      contentContainerStyle={styles.panelContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        ) : undefined
      }
    >
      <View style={styles.panelHeader}>
        <View style={styles.panelTitleRow}>
          <Users color={colors.danger} size={16} />
          <Text style={styles.panelTitle}>
            {tr.cards.likedBy}
            {likeCount > 0 ? ` (${likeCount})` : ''}
          </Text>
        </View>
        <Pressable onPress={onClose}>
          <X color={colors.textSoft} size={16} />
        </Pressable>
      </View>

      {likers.length > 0 ? (
        <View style={styles.searchWrap}>
          <Search color={colors.textSoft} size={15} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Begenenlerde ara..."
            placeholderTextColor={colors.textSoft}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      ) : null}

      {filteredLikers.length === 0 ? (
        <Text style={styles.panelMuted}>{q ? 'Sonuc bulunamadi' : tr.cards.noLikes}</Text>
      ) : (
        <View style={styles.likerList}>
          {filteredLikers.map((liker) => (
            <Pressable
              key={liker.id}
              style={styles.likerRow}
              onPress={() => onUserPress?.(liker.id)}
              disabled={!onUserPress}
            >
              <AvatarView uri={liker.profilePhoto} name={liker.name} size={32} />
              <View>
                <Text style={styles.panelTitle}>{liker.name}</Text>
                <Text style={styles.panelMuted}>@{liker.username}</Text>
                {liker.likedAt ? (
                  <Text style={styles.panelMuted}>{`Begeni: ${formatAbsoluteDateTime(liker.likedAt)}`}</Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
  },
  panelContent: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  likerList: {
    gap: 10,
  },
  likerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
