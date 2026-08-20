import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import {
  Ellipsis,
  Heart,
  MessageCircle,
  Share2,
} from 'lucide-react-native';

import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { triggerHaptic } from '@/mobile/app/shared/hooks/useHaptic';
import { colors, radius, touch, typography } from '@/mobile/app/shared/theme/tokens';

type FeedActionButtonsProps = {
  commentCount: number;
  likeCount: number;
  liked: boolean;
  onCommentPress: () => void;
  onCommentsIntent: () => void;
  onLikePress: () => void;
  onLikersPress: () => void;
  onOverflowPress?: () => void;
  onSharePress?: () => void;
  overflowActionLabel: string;
  showCommentAction: boolean;
  showComments: boolean;
  showOverflowAction: boolean;
  showShareAction: boolean;
};

function LikeAction(props: Pick<FeedActionButtonsProps, 'liked' | 'likeCount' | 'onLikePress' | 'onLikersPress'>) {
  return (
    <InstantPressable
      accessibilityLabel={props.liked ? tr.cards.unlikeAction : tr.cards.likeAction}
      accessibilityRole="button"
      accessibilityState={{ selected: props.liked }}
      style={[styles.actionButton, props.liked ? styles.likeActionActive : null]}
      onPress={() => {
        triggerHaptic('light');
        props.onLikePress();
      }}
      onLongPress={props.onLikersPress}
      delayLongPress={500}
    >
      <Heart
        size={16}
        color={props.liked ? colors.danger : colors.textMuted}
        fill={props.liked ? colors.danger : 'transparent'}
      />
      <Text
        accessible={false}
        style={[
          styles.actionCount,
          props.liked ? styles.actionCountLiked : null,
          props.likeCount === 0 ? styles.actionCountEmpty : null,
        ]}
      >
        {props.likeCount}
      </Text>
    </InstantPressable>
  );
}

function CommentAction(props: Pick<
  FeedActionButtonsProps,
  'commentCount' | 'onCommentPress' | 'onCommentsIntent' | 'showComments'
>) {
  return (
    <InstantPressable
      accessibilityLabel={tr.cards.commentAction}
      accessibilityRole="button"
      accessibilityState={{ expanded: props.showComments }}
      style={[styles.actionButton, props.showComments ? styles.primaryActionActive : null]}
      onPressIn={props.onCommentsIntent}
      onPress={props.onCommentPress}
    >
      <MessageCircle size={16} color={props.showComments ? colors.primary : colors.textMuted} />
      <Text
        accessible={false}
        style={[
          styles.actionCount,
          props.showComments ? styles.actionCountPrimary : null,
          props.commentCount === 0 ? styles.actionCountEmpty : null,
        ]}
      >
        {props.commentCount}
      </Text>
    </InstantPressable>
  );
}

export function FeedActionButtons(props: FeedActionButtonsProps) {
  return (
    <View style={styles.actions}>
      <LikeAction {...props} />

      {props.showCommentAction ? (
        <CommentAction {...props} />
      ) : null}

      {props.showShareAction && props.onSharePress ? (
        <InstantPressable
          accessibilityLabel={tr.cards.share}
          accessibilityRole="button"
          style={styles.actionButton}
          onPress={props.onSharePress}
        >
          <Share2 size={16} color={colors.textMuted} />
        </InstantPressable>
      ) : null}

      {props.showOverflowAction && props.onOverflowPress ? (
        <InstantPressable
          accessibilityLabel={props.overflowActionLabel}
          accessibilityRole="button"
          style={styles.actionButton}
          onPress={props.onOverflowPress}
        >
          <Ellipsis size={16} color={colors.textMuted} />
        </InstantPressable>
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 6,
  },
  actionButton: {
    minWidth: Platform.OS === 'ios' ? touch.ios : touch.android,
    minHeight: Platform.OS === 'ios' ? touch.ios : touch.android,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionCount: {
    minWidth: 12,
    textAlign: 'center',
    ...typography.metadataText,
    fontWeight: '700',
    color: colors.textMuted,
  },
  actionCountLiked: { color: colors.danger },
  actionCountPrimary: { color: colors.primary },
  actionCountEmpty: { opacity: 0 },
  likeActionActive: { backgroundColor: colors.dangerBg },
  primaryActionActive: { backgroundColor: colors.primaryBg },
});
