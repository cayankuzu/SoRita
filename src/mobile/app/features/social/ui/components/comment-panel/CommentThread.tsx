import React from 'react';
import {
  Pressable,
  Text,
  View,
} from 'react-native';
import {
  ChevronDown,
  ChevronUp,
  Heart,
  MoreHorizontal,
  Reply,
} from 'lucide-react-native';

import type { FeedActionComment } from '@/mobile/app/features/social/ui/components/FeedActionTypes';
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
import { commentPanelStyles as styles } from '@/mobile/app/features/social/ui/components/comment-panel/commentPanelStyles';

const commentTextVariant: RichTextVariant = 'comment';

type CommentThreadProps = {
  comments: FeedActionComment[];
  editingCommentId?: string | null;
  expandedReplies: Record<string, boolean>;
  onOpenCommentMenu: (comment: FeedActionComment) => void;
  onShowCommentLikers: (comment: FeedActionComment) => void;
  onStartReply: (comment: FeedActionComment) => void;
  onToggleCommentLike: (commentId: string) => void;
  onToggleReplies: (commentId: string) => void;
  onUserPress?: (userId: string) => void;
};

export function CommentThread({
  comments,
  editingCommentId = null,
  expandedReplies,
  onOpenCommentMenu,
  onShowCommentLikers,
  onStartReply,
  onToggleCommentLike,
  onToggleReplies,
  onUserPress,
}: CommentThreadProps) {
  const userIdByMention = React.useMemo(() => {
    const map = new Map<string, string>();
    const visit = (items: FeedActionComment[]) => {
      items.forEach((item) => {
        if (item.username && item.userId) {
          map.set(item.username.toLowerCase(), item.userId);
        }

        if (item.replies?.length) {
          visit(item.replies);
        }
      });
    };

    visit(comments);
    return map;
  }, [comments]);

  const handleMentionPress = React.useCallback(
    (mention: string) => {
      const username = mention.replace(/^@/, '').toLowerCase();
      const targetUserId = userIdByMention.get(username);

      if (targetUserId) {
        onUserPress?.(targetUserId);
      }
    },
    [onUserPress, userIdByMention],
  );

  const renderComment = (comment: FeedActionComment, depth = 0): React.ReactNode => {
    const isEditing = editingCommentId === comment.id;
    const isEdited = hasMeaningfulUpdate(comment.createdAt, comment.updatedAt);
    const replies = comment.replies || [];
    const repliesExpanded = expandedReplies[comment.id] ?? true;
    const isReply = depth > 0;

    return (
      <View
        key={comment.id}
        style={[
          styles.commentItem,
          isReply ? styles.replyCommentItem : null,
        ]}
      >
        {isReply ? <View pointerEvents="none" style={styles.replyItemRail} /> : null}

        <Pressable
          onPress={() => comment.userId && onUserPress?.(comment.userId)}
          disabled={!comment.userId || !onUserPress}
          style={styles.commentAvatarButton}
        >
          <AvatarView
            uri={comment.userProfilePhoto}
            name={comment.userName}
            size={depth > 0 ? 34 : 42}
          />
        </Pressable>

        <View style={[styles.commentMain, isReply ? styles.replyCommentMain : null]}>
          <View style={[styles.commentBubble, isReply ? styles.replyBubble : null]}>
            <View style={styles.commentTopRow}>
              <Pressable
                onPress={() => comment.userId && onUserPress?.(comment.userId)}
                disabled={!comment.userId || !onUserPress}
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
              </Pressable>

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
                    size={17}
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
              onMentionPress={onUserPress ? handleMentionPress : undefined}
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
                <Reply color={colors.textSoft} size={13} />
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
                    size={16}
                  />
                </InstantPressable>
              ) : null}
            </View>
          </View>

          {replies.length > 0 ? (
            <View style={styles.replySection}>
              {repliesExpanded ? (
                <View style={styles.replyThread}>
                  {replies.map((reply) => renderComment(reply, depth + 1))}
                </View>
              ) : null}

              <InstantPressable
                accessibilityLabel={repliesExpanded ? tr.cards.hideReplies : tr.cards.viewReplies(replies.length)}
                accessibilityRole="button"
                style={styles.replyToggleButton}
                onPress={() => onToggleReplies(comment.id)}
                hitSlop={8}
              >
                {repliesExpanded ? (
                  <ChevronUp color={colors.textSoft} size={14} />
                ) : (
                  <ChevronDown color={colors.textSoft} size={14} />
                )}
                <Text style={styles.replyToggleText}>
                  {repliesExpanded ? tr.cards.hideReplies : tr.cards.viewReplies(replies.length)}
                </Text>
              </InstantPressable>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return <>{comments.map((comment) => renderComment(comment))}</>;
}
