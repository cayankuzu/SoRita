import React, { useMemo } from 'react';
import {
  Pressable,
  StyleProp,
  Text,
  TextStyle,
  View,
} from 'react-native';
import {
  ChevronDown,
  ChevronUp,
  Heart,
  Pencil,
  Reply,
  Trash2,
} from 'lucide-react-native';

import type { FeedActionComment } from '@/mobile/app/features/social/ui/components/FeedActionTypes';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { formatAbsoluteDateTime } from '@/mobile/app/shared/utils/dateTime';
import { commentPanelStyles as styles } from '@/mobile/app/features/social/ui/components/comment-panel/commentPanelStyles';

function CommentContent({
  content,
  style,
}: {
  content: string;
  style?: StyleProp<TextStyle>;
}) {
  const parts = useMemo(() => content.split(/(@[a-zA-Z0-9_]+)/g), [content]);

  return (
    <ExpandableText
      text={content}
      collapsedLines={3}
      textStyle={style}
      renderContent={() =>
        parts.map((part, index) => (
          <Text
            key={`${part}-${index}`}
            style={part.startsWith('@') ? styles.mentionText : undefined}
          >
            {part}
          </Text>
        ))
      }
    />
  );
}

type CommentThreadProps = {
  comments: FeedActionComment[];
  editingCommentId?: string | null;
  expandedReplies: Record<string, boolean>;
  onDeleteComment: (commentId: string) => void;
  onShowCommentLikers: (comment: FeedActionComment) => void;
  onStartEdit: (comment: FeedActionComment) => void;
  onStartReply: (comment: FeedActionComment) => void;
  onStartReport: (commentId: string) => void;
  onToggleCommentLike: (commentId: string) => void;
  onToggleReplies: (commentId: string) => void;
  onUserPress?: (userId: string) => void;
};

export function CommentThread({
  comments,
  editingCommentId = null,
  expandedReplies,
  onDeleteComment,
  onShowCommentLikers,
  onStartEdit,
  onStartReply,
  onStartReport,
  onToggleCommentLike,
  onToggleReplies,
  onUserPress,
}: CommentThreadProps) {
  const renderComment = (comment: FeedActionComment, depth = 0): React.ReactNode => {
    const isEditing = editingCommentId === comment.id;
    const isEdited =
      new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 1000;
    const replies = comment.replies || [];
    const repliesExpanded = expandedReplies[comment.id] ?? true;

    return (
      <View
        key={comment.id}
        style={[
          styles.commentItem,
          depth > 0 ? styles.replyCommentItem : null,
        ]}
      >
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

        <View style={styles.commentMain}>
          <View style={styles.commentTopRow}>
            <Pressable
              onPress={() => comment.userId && onUserPress?.(comment.userId)}
              disabled={!comment.userId || !onUserPress}
              style={styles.commentIdentity}
            >
              <Text style={styles.commentAuthor}>{comment.userName}</Text>
              <View style={styles.commentMetaRow}>
                {comment.username ? (
                  <Text style={styles.commentMeta}>@{comment.username}</Text>
                ) : null}
                <Text style={styles.commentMeta}>{formatAbsoluteDateTime(comment.createdAt)}</Text>
                {isEdited ? (
                  <Text style={styles.commentEdited}>
                    {`Duzenleme: ${formatAbsoluteDateTime(comment.updatedAt)}`}
                  </Text>
                ) : null}
              </View>
            </Pressable>

            <View style={styles.commentLikeColumn}>
              <Pressable
                style={styles.commentLikeButton}
                onPress={() => onToggleCommentLike(comment.id)}
                onLongPress={() => {
                  if ((comment.likers || []).length > 0) {
                    onShowCommentLikers(comment);
                  }
                }}
                delayLongPress={500}
              >
                <Heart
                  color={comment.liked ? colors.danger : colors.textSoft}
                  size={18}
                  fill={comment.liked ? colors.danger : 'transparent'}
                />
              </Pressable>
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
            </View>
          </View>

          <CommentContent content={comment.content} style={styles.commentContent} />

          <View style={styles.commentActionRow}>
            <Pressable onPress={() => onStartReply(comment)} style={styles.commentInlineAction}>
              <Reply color={colors.textSoft} size={13} />
              <Text style={styles.commentInlineActionText}>{tr.cards.reply}</Text>
            </Pressable>

            {comment.canEdit ? (
              <Pressable onPress={() => onStartEdit(comment)} style={styles.commentInlineAction}>
                <Pencil color={isEditing ? colors.primary : colors.textSoft} size={13} />
                <Text
                  style={[
                    styles.commentInlineActionText,
                    isEditing ? styles.commentInlineActionTextActive : null,
                  ]}
                >
                  {tr.cards.editComment}
                </Text>
              </Pressable>
            ) : null}

            {comment.canDelete ? (
              <Pressable onPress={() => onDeleteComment(comment.id)} style={styles.commentInlineAction}>
                <Trash2 color={colors.danger} size={13} />
                <Text style={[styles.commentInlineActionText, styles.commentInlineDangerText]}>
                  {tr.common.delete}
                </Text>
              </Pressable>
            ) : null}

            {comment.canReport ? (
              <Pressable onPress={() => onStartReport(comment.id)} style={styles.commentInlineAction}>
                <Text style={styles.commentInlineActionText}>{tr.cards.report}</Text>
              </Pressable>
            ) : null}
          </View>

          {replies.length > 0 ? (
            <View style={styles.replySection}>
              {repliesExpanded ? (
                <View style={styles.replyThread}>
                  {replies.map((reply) => renderComment(reply, depth + 1))}
                </View>
              ) : null}

              <Pressable style={styles.replyToggleButton} onPress={() => onToggleReplies(comment.id)}>
                {repliesExpanded ? (
                  <ChevronUp color={colors.textSoft} size={14} />
                ) : (
                  <ChevronDown color={colors.textSoft} size={14} />
                )}
                <Text style={styles.replyToggleText}>
                  {repliesExpanded ? tr.cards.hideReplies : tr.cards.viewReplies(replies.length)}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return <>{comments.map((comment) => renderComment(comment))}</>;
}
