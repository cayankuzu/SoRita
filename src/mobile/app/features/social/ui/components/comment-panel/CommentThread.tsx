import React from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  ChevronDown,
  ChevronUp,
  Heart,
  MoreHorizontal,
  Reply,
} from 'lucide-react-native';

import type { FeedActionComment } from '@/mobile/app/features/social/ui/components/FeedActionTypes';
import { commentPanelStyles as styles } from '@/mobile/app/features/social/ui/components/comment-panel/commentPanelStyles';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import {
  formatAbsoluteDateTime,
  hasMeaningfulUpdate,
} from '@/mobile/app/shared/utils/dateTime';
import type { RichTextVariant } from '@/mobile/app/shared/utils/richText';

const commentTextVariant: RichTextVariant = 'comment';

type CommentThreadProps = {
  comment: FeedActionComment;
  depth: number;
  editingCommentId?: string | null;
  hiddenReplyCount: number;
  repliesExpanded: boolean;
  replyCount: number;
  onLoadMoreReplies: (commentId: string) => void;
  onMentionPress?: (mention: string) => void;
  onOpenCommentMenu: (comment: FeedActionComment) => void;
  onShowCommentLikers: (comment: FeedActionComment) => void;
  onStartReply: (comment: FeedActionComment) => void;
  onToggleCommentLike: (commentId: string) => void;
  onToggleReplies: (commentId: string) => void;
  onUserPress?: (userId: string) => void;
};

type CommentAuthorPressableProps = {
  children: React.ReactNode;
  comment: FeedActionComment;
  onUserPress?: (userId: string) => void;
  style: React.ComponentProps<typeof Pressable>['style'];
};

function CommentAuthorPressable({
  children,
  comment,
  onUserPress,
  style,
}: CommentAuthorPressableProps) {
  const disabled = !comment.userId || !onUserPress;

  return (
    <Pressable
      accessibilityLabel={comment.userName}
      accessibilityRole={disabled ? undefined : 'button'}
      disabled={disabled}
      onPress={() => comment.userId && onUserPress?.(comment.userId)}
      style={style}
    >
      {children}
    </Pressable>
  );
}

export function CommentThread({
  comment,
  depth,
  editingCommentId = null,
  hiddenReplyCount,
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
  const isEdited = hasMeaningfulUpdate(comment.createdAt, comment.updatedAt);
  const isReply = depth > 0;
  const depthStyle = isReply ? { marginLeft: Math.min(depth, 3) * 14 } : null;

  return (
    <View
      style={[
        styles.commentItem,
        isReply ? styles.replyCommentItem : null,
        depthStyle,
      ]}
    >
      {isReply ? <View pointerEvents="none" style={styles.replyItemRail} /> : null}

      <CommentAuthorPressable
        comment={comment}
        onUserPress={onUserPress}
        style={styles.commentAvatarButton}
      >
        <AvatarView
          uri={comment.userProfilePhoto}
          name={comment.userName}
          size={isReply ? 34 : 42}
        />
      </CommentAuthorPressable>

      <View style={[styles.commentMain, isReply ? styles.replyCommentMain : null]}>
        <View style={[styles.commentBubble, isReply ? styles.replyBubble : null]}>
          <View style={styles.commentTopRow}>
            <CommentAuthorPressable
              comment={comment}
              onUserPress={onUserPress}
              style={styles.commentIdentity}
            >
              <View style={styles.commentAuthorRow}>
                <Text numberOfLines={1} style={styles.commentAuthor}>{comment.userName}</Text>
                {comment.pendingSync ? (
                  <Text style={styles.commentPending}>{tr.cards.commentSyncing}</Text>
                ) : null}
                {isEdited ? (
                  <Text style={styles.commentEdited}>{tr.cards.editedLabel}</Text>
                ) : null}
              </View>
              <View style={styles.commentMetaRow}>
                {comment.username ? (
                  <Text numberOfLines={1} style={styles.commentMeta}>@{comment.username}</Text>
                ) : null}
                {comment.username ? <View style={styles.commentMetaDot} /> : null}
                <Text style={styles.commentMeta}>{formatAbsoluteDateTime(comment.createdAt)}</Text>
              </View>
            </CommentAuthorPressable>

            <InstantPressable
              accessibilityLabel={comment.liked ? tr.cards.unlikeComment : tr.cards.likeComment}
              accessibilityRole="button"
              style={styles.commentLikeColumn}
              onPress={() => onToggleCommentLike(comment.id)}
              onLongPress={() => onShowCommentLikers(comment)}
              delayLongPress={500}
              preventRepeatWhileBusy={false}
            >
              <View style={[styles.commentLikeButton, comment.liked ? styles.commentLikeButtonActive : null]}>
                <Heart
                  color={comment.liked ? colors.danger : colors.textSoft}
                  size={15}
                  fill={comment.liked ? colors.danger : 'transparent'}
                />
              </View>
              {comment.likes ? (
                <Text
                  style={[
                    styles.commentLikeCount,
                    comment.liked ? styles.commentLikeCountActive : null,
                  ]}
                >
                  {comment.likes}
                </Text>
              ) : null}
            </InstantPressable>
          </View>

          <ExpandableText
            text={comment.content}
            collapsedLines={isReply ? 4 : 5}
            onMentionPress={onMentionPress}
            textStyle={[styles.commentContent, isReply ? styles.replyContent : null]}
            variant={commentTextVariant}
          />

          <View style={styles.commentActionRow}>
            <InstantPressable
              accessibilityLabel={tr.cards.replyToComment}
              accessibilityRole="button"
              onPress={() => onStartReply(comment)}
              style={styles.commentInlineAction}
              hitSlop={8}
            >
              <Reply color={colors.textSoft} size={12} />
              <Text style={styles.commentInlineActionText}>{tr.cards.reply}</Text>
            </InstantPressable>

            {comment.canEdit || comment.canDelete || comment.canReport || comment.content.trim() ? (
              <InstantPressable
                accessibilityLabel={tr.cards.commentMenuAction}
                accessibilityRole="button"
                onPress={() => onOpenCommentMenu(comment)}
                style={[
                  styles.commentInlineMenuButton,
                  isEditing ? styles.commentInlineMenuButtonActive : null,
                ]}
                hitSlop={8}
              >
                <MoreHorizontal
                  color={isEditing ? colors.primary : colors.textSoft}
                  size={14}
                />
              </InstantPressable>
            ) : null}
          </View>
        </View>

        {replyCount > 0 ? (
          <View style={styles.replySection}>
            <InstantPressable
              accessibilityLabel={repliesExpanded ? tr.cards.hideReplies : tr.cards.viewReplies(replyCount)}
              accessibilityRole="button"
              style={styles.replyToggleButton}
              onPress={() => onToggleReplies(comment.id)}
              hitSlop={8}
            >
              {repliesExpanded ? (
                <ChevronUp color={colors.textSoft} size={12} />
              ) : (
                <ChevronDown color={colors.textSoft} size={12} />
              )}
              <Text style={styles.replyToggleText}>
                {repliesExpanded ? tr.cards.hideReplies : tr.cards.viewReplies(replyCount)}
              </Text>
            </InstantPressable>

            {repliesExpanded && hiddenReplyCount > 0 ? (
              <InstantPressable
                accessibilityLabel={tr.cards.viewReplies(hiddenReplyCount)}
                accessibilityRole="button"
                style={styles.replyToggleButton}
                onPress={() => onLoadMoreReplies(comment.id)}
                hitSlop={8}
              >
                <ChevronDown color={colors.textSoft} size={12} />
                <Text style={styles.replyToggleText}>
                  {tr.cards.viewReplies(hiddenReplyCount)}
                </Text>
              </InstantPressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
