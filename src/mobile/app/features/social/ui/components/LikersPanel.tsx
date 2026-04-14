import React from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Users, X } from 'lucide-react-native';

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

export function LikersPanel({
  likeCount,
  likers,
  onClose,
  refreshing = false,
  onRefresh,
  onUserPress,
}: LikersPanelProps) {
  return (
    <ScrollView
      style={styles.panel}
      contentContainerStyle={styles.panelContent}
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
      {likers.length === 0 ? (
        <Text style={styles.panelMuted}>{tr.cards.noLikes}</Text>
      ) : (
        <View style={styles.likerList}>
          {likers.map((liker) => (
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
