import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import {
  ChevronDown,
  ChevronUp,
  Heart,
  MoreHorizontal,
} from 'lucide-react-native';

import type { FeedActionComment } from '@/mobile/app/features/social/ui/components/FeedActionTypes';
import { commentPanelStyles as styles } from '@/mobile/app/features/social/ui/components/comment-panel/commentPanelStyles';
import type { MoreRepliesRow } from '@/mobile/app/features/social/ui/components/comment-panel/commentTree';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  avatarSize,
  colors,
  controlSize,
  hitSlopFor,
  iconSize,
} from '@/mobile/app/shared/theme/tokens';
import {
  formatRelativeDateTime,
  hasMeaningfulUpdate,
} from '@/mobile/app/shared/utils/dateTime';
import type { RichTextVariant } from '@/mobile/app/shared/utils/richText';

const commentTextVariant: RichTextVariant = 'comment';

type CommentThreadProps = {
  comment: FeedActionComment;
  depth: number;
  editingCommentId?: string | null;
  moreReplies: MoreRepliesRow | null;
  repliesExpanded: boolean;
  replyCount: number;
  onLoadMoreReplies: (rootCommentId: string) => void;
  onMentionPress?: (mention: string) => void;
  onOpenCommentMenu: (comment: FeedActionComment) => void;
  onShowCommentLikers: (comment: FeedActionComment) => void;
  onStartReply: (comment: FeedActionComment) => void;
  onToggleCommentLike: (commentId: string) => void | Promise<void>;
  onToggleReplies: (commentId: string) => void;
  onUserPress?: (userId: string) => void;
};

type CommentAuthorPressableProps = {
  children: React.ReactNode;
  comment: FeedActionComment;
  onUserPress?: (userId: string) => void;
  style: StyleProp<ViewStyle>;
};

function CommentAuthorPressable({
  children,
  comment,
  onUserPress,
  style,
}: CommentAuthorPressableProps) {
  const disabled = !comment.userId || !onUserPress;

  return (
    <InstantPressable
      accessibilityLabel={comment.userName}
      accessibilityRole={disabled ? 'text' : 'button'}
      disabled={disabled}
      onPress={() => {
        if (comment.userId) onUserPress?.(comment.userId);
      }}
      style={style}
    >
      {children}
    </InstantPressable>
  );
}

/**
 * One comment, laid out the way YouTube and Reddit do it: no box around it,
 * the name and time on one line, the text, then a quiet row of actions.
 * Replies sit indented under their comment's text, hidden behind a "N yanıt"
 * toggle until asked for.
 */
export function CommentThread({
  comment,
  depth,
  editingCommentId = null,
  moreReplies,
  repliesExpanded,
  replyCount,
  onLoadMoreReplies,
  onMentionPress,
  onOpenCommentMenu,
  onShowCommentLikers,
  onStartReply,
  onToggleCommentLike,
  onToggleReplies,
  onUserPress,
}: CommentThreadProps) {
  const isEditing = editingCommentId === comment.id;
  const isReply = depth > 0;
  const likeCount = Math.max(0, Math.trunc(comment.likes ?? 0));
  const meta = [
    formatRelativeDateTime(comment.createdAt),
    hasMeaningfulUpdate(comment.createdAt, comment.updatedAt) ? tr.cards.editedLabel : null,
  ].filter(Boolean).join(' · ');
  const hasMenu =
    comment.canEdit || comment.canDelete || comment.canReport || Boolean(comment.content.trim());

  return (
    <View style={[styles.commentItem, isReply ? styles.replyCommentItem : null]}>
      <CommentAuthorPressable
        comment={comment}
        onUserPress={onUserPress}
        style={styles.commentAvatarButton}
      >
        <AvatarView
          uri={comment.userProfilePhoto}
          name={comment.userName}
          size={isReply ? avatarSize.xs : avatarSize.sm}
        />
      </CommentAuthorPressable>

      <View style={styles.commentMain}>
        <View style={styles.commentHeaderRow}>
          <CommentAuthorPressable
            comment={comment}
            onUserPress={onUserPress}
            style={styles.commentAuthorButton}
          >
            <AppText numberOfLines={1} style={styles.commentAuthor}>{comment.userName}</AppText>
          </CommentAuthorPressable>
          <AppText numberOfLines={1} style={styles.commentMeta}>{meta}</AppText>
        </View>

        {comment.pendingSync ? (
          <AppText accessibilityLiveRegion="polite" style={styles.commentPending}>
            {tr.cards.commentSyncing}
          </AppText>
        ) : null}

        <ExpandableText
          text={comment.content}
          collapsedLines={isReply ? 4 : 5}
          onMentionPress={onMentionPress}
          textStyle={styles.commentContent}
          variant={commentTextVariant}
        />

        <View style={styles.commentActionRow}>
          <InstantPressable
            accessibilityLabel={comment.liked ? tr.cards.unlikeComment : tr.cards.likeComment}
            accessibilityRole="button"
            accessibilityState={{ selected: comment.liked }}
            hitSlop={hitSlopFor(controlSize.compact)}
            onPress={() => onToggleCommentLike(comment.id)}
            style={styles.commentIconAction}
          >
            <Heart
              color={comment.liked ? colors.danger : colors.textSoft}
              fill={comment.liked ? colors.danger : 'transparent'}
              size={iconSize.sm}
            />
          </InstantPressable>

          {likeCount > 0 ? (
            <InstantPressable
              accessibilityLabel={`${tr.cards.likedBy}: ${likeCount}`}
              accessibilityRole="button"
              hitSlop={hitSlopFor(controlSize.compact)}
              onPress={() => onShowCommentLikers(comment)}
              style={styles.commentCountAction}
            >
              <AppText
                style={[
                  styles.commentLikeCount,
                  comment.liked ? styles.commentLikeCountActive : null,
                ]}
              >
                {likeCount}
              </AppText>
            </InstantPressable>
          ) : null}

          <InstantPressable
            accessibilityLabel={tr.cards.replyToComment}
            accessibilityRole="button"
            hitSlop={hitSlopFor(controlSize.compact)}
            onPress={() => onStartReply(comment)}
            style={styles.commentTextAction}
          >
            <AppText style={styles.commentActionText}>{tr.cards.reply}</AppText>
          </InstantPressable>

          {hasMenu ? (
            <InstantPressable
              accessibilityLabel={tr.cards.commentMenuAction}
              accessibilityRole="button"
              accessibilityState={{ selected: isEditing }}
              hitSlop={hitSlopFor(controlSize.compact)}
              onPress={() => onOpenCommentMenu(comment)}
              style={[styles.commentIconAction, styles.commentMenuAction]}
            >
              <MoreHorizontal
                color={isEditing ? colors.primary : colors.textSoft}
                size={iconSize.sm}
              />
            </InstantPressable>
          ) : null}
        </View>

        {replyCount > 0 ? (
          <InstantPressable
            accessibilityLabel={repliesExpanded ? tr.cards.hideReplies : tr.cards.viewReplies(replyCount)}
            accessibilityRole="button"
            accessibilityState={{ expanded: repliesExpanded }}
            hitSlop={hitSlopFor(controlSize.compact)}
            onPress={() => onToggleReplies(comment.id)}
            style={styles.replyToggleButton}
          >
            {repliesExpanded ? (
              <ChevronUp color={colors.primary} size={iconSize.sm} />
            ) : (
              <ChevronDown color={colors.primary} size={iconSize.sm} />
            )}
            <AppText style={styles.replyToggleText}>
              {repliesExpanded ? tr.cards.hideReplies : tr.cards.viewReplies(replyCount)}
            </AppText>
          </InstantPressable>
        ) : null}

        {moreReplies ? (
          <InstantPressable
            accessibilityLabel={tr.cards.moreReplies(moreReplies.count)}
            accessibilityRole="button"
            hitSlop={hitSlopFor(controlSize.compact)}
            onPress={() => onLoadMoreReplies(moreReplies.rootId)}
            style={styles.replyToggleButton}
          >
            <ChevronDown color={colors.primary} size={iconSize.sm} />
            <AppText style={styles.replyToggleText}>{tr.cards.moreReplies(moreReplies.count)}</AppText>
          </InstantPressable>
        ) : null}
      </View>
    </View>
  );
}
