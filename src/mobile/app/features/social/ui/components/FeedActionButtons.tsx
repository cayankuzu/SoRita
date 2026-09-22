import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  Ellipsis,
  Heart,
  MessageCircle,
  Share2,
} from 'lucide-react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { triggerHaptic } from '@/mobile/app/shared/hooks/useHaptic';
import {
  colors,
  fontWeight,
  iconSize,
  radius,
  spacing,
  touch,
  typography,
} from '@/mobile/app/shared/theme/tokens';

type FeedActionButtonsProps = {
  commentCount: number;
  likeCount: number;
  liked: boolean;
  onCommentPress: () => void;
  onCommentsIntent: () => void;
  onLikePress: () => void | Promise<void>;
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
    <View style={styles.likeActionGroup}>
      <InstantPressable
        accessibilityLabel={props.liked ? tr.cards.unlikeAction : tr.cards.likeAction}
        accessibilityRole="button"
        accessibilityState={{ selected: props.liked }}
        style={[styles.actionButton, props.liked ? styles.likeActionActive : null]}
        onPress={() => {
          triggerHaptic('light');
          return props.onLikePress();
        }}
      >
        <Heart
          size={iconSize.sm}
          color={props.liked ? colors.danger : colors.textMuted}
          fill={props.liked ? colors.danger : 'transparent'}
        />
      </InstantPressable>

      <InstantPressable
        accessibilityHint={tr.cards.likedBy}
        accessibilityLabel={`${tr.cards.likedBy}: ${props.likeCount}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: props.likeCount === 0 }}
        disabled={props.likeCount === 0}
        style={styles.likeCountButton}
        onPress={props.onLikersPress}
      >
        <AppText
          accessible={false}
          style={[
            styles.actionCount,
            props.liked ? styles.actionCountLiked : null,
          ]}
        >
          {props.likeCount}
        </AppText>
      </InstantPressable>
    </View>
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
      <MessageCircle size={iconSize.sm} color={props.showComments ? colors.primary : colors.textMuted} />
      <AppText
        accessible={false}
        style={[
          styles.actionCount,
          props.showComments ? styles.actionCountPrimary : null,
          props.commentCount === 0 ? styles.actionCountEmpty : null,
        ]}
      >
        {props.commentCount}
      </AppText>
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
          <Share2 size={iconSize.sm} color={colors.textMuted} />
        </InstantPressable>
      ) : null}

      {props.showOverflowAction && props.onOverflowPress ? (
        <InstantPressable
          accessibilityLabel={props.overflowActionLabel}
          accessibilityRole="button"
          style={styles.actionButton}
          onPress={props.onOverflowPress}
        >
          <Ellipsis size={iconSize.sm} color={colors.textMuted} />
        </InstantPressable>
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    minWidth: Platform.OS === 'ios' ? touch.ios : touch.android,
    minHeight: Platform.OS === 'ios' ? touch.ios : touch.android,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  likeActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeCountButton: {
    minWidth: Platform.OS === 'ios' ? touch.ios : touch.android,
    minHeight: Platform.OS === 'ios' ? touch.ios : touch.android,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCount: {
    minWidth: 12,
    textAlign: 'center',
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.textMuted,
  },
  actionCountLiked: { color: colors.danger },
  actionCountPrimary: { color: colors.primary },
  actionCountEmpty: { opacity: 0 },
  likeActionActive: { backgroundColor: colors.dangerBg },
  primaryActionActive: { backgroundColor: colors.primaryBg },
});
