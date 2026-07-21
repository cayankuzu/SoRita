import React from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Send } from 'lucide-react-native';

import type { ReplyTarget } from '@/mobile/app/features/social/ui/components/comment-panel/commentPanelTypes';
import { COMMENT_MAX_LENGTH } from '@/mobile/app/shared/validation/contentLimits';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { commentPanelStyles as styles } from '@/mobile/app/features/social/ui/components/comment-panel/commentPanelStyles';

const QUICK_REACTIONS = [
  '\u2764\uFE0F',
  '\uD83D\uDE4C',
  '\uD83D\uDD25',
  '\uD83D\uDC4F',
  '\uD83D\uDE22',
  '\uD83D\uDE0D',
  '\uD83D\uDE2E',
  '\uD83D\uDE02',
];

type CommentComposerProps = {
  commentText: string;
  currentUserName?: string;
  currentUserPhoto?: string;
  editingCommentId?: string | null;
  replyingTo?: ReplyTarget | null;
  submitting?: boolean;
  composerInset: number;
  composerKeyboardOffset: number;
  onCancelEdit: () => void;
  onCancelReply: () => void;
  onCommentTextChange: (value: string) => void;
  onSubmit: () => void;
};

export function CommentComposer({
  commentText,
  currentUserName,
  currentUserPhoto,
  editingCommentId = null,
  replyingTo = null,
  submitting = false,
  composerInset,
  composerKeyboardOffset,
  onCancelEdit,
  onCancelReply,
  onCommentTextChange,
  onSubmit,
}: CommentComposerProps) {
  const inputRef = React.useRef<TextInput | null>(null);
  const trimmedCommentText = commentText.trim();
  const canSubmit = trimmedCommentText.length > 0 && !submitting;
  const characterCount = commentText.length;
  const composerPlaceholder = editingCommentId
    ? tr.cards.editComment
    : replyingTo?.username
      ? tr.cards.replyPlaceholder(replyingTo.username)
      : tr.cards.commentPlaceholder;
  const composerIsContextual = Boolean(editingCommentId || replyingTo);

  React.useEffect(() => {
    if (!editingCommentId && !replyingTo) {
      return;
    }

    const timeoutId = setTimeout(() => {
      inputRef.current?.focus();
    }, 80);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [editingCommentId, replyingTo]);

  const appendReaction = React.useCallback(
    (reaction: string) => {
      if (submitting) {
        return;
      }

      const nextValue = commentText ? `${commentText} ${reaction}` : reaction;

      onCommentTextChange(nextValue.slice(0, COMMENT_MAX_LENGTH));
      inputRef.current?.focus();
    },
    [commentText, onCommentTextChange, submitting],
  );

  return (
    <View
      style={[
        styles.composerDock,
        {
          paddingBottom: composerInset,
          marginBottom: composerKeyboardOffset,
        },
      ]}
    >
      {editingCommentId ? (
        <View style={[styles.composerBanner, styles.composerBannerEdit]}>
          <View style={styles.composerBannerBody}>
            <Text style={styles.composerBannerText}>{tr.cards.editingComment}</Text>
            <Text style={styles.composerBannerSubtext}>{tr.cards.editComment}</Text>
          </View>
          <Pressable
            onPress={onCancelEdit}
            accessibilityLabel={tr.common.cancel}
            accessibilityRole="button"
            style={styles.composerBannerActionButton}
          >
            <Text style={styles.composerBannerAction}>{tr.cards.cancelEditComment}</Text>
          </Pressable>
        </View>
      ) : null}

      {replyingTo ? (
        <View style={[styles.composerBanner, styles.composerBannerReply]}>
          <View style={styles.composerBannerBody}>
            <Text style={styles.composerBannerText}>{tr.cards.replyingTo(replyingTo.userName)}</Text>
            {replyingTo.username ? (
              <Text style={styles.composerBannerSubtext}>@{replyingTo.username}</Text>
            ) : null}
          </View>
          <Pressable
            onPress={onCancelReply}
            accessibilityLabel={tr.common.cancel}
            accessibilityRole="button"
            style={styles.composerBannerActionButton}
          >
            <Text style={styles.composerBannerAction}>{tr.cards.cancelReply}</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.reactionRow}
        keyboardShouldPersistTaps="handled"
      >
        {QUICK_REACTIONS.map((reaction) => (
          <Pressable
            key={reaction}
            disabled={submitting}
            accessibilityLabel={tr.cards.quickReactionLabel(reaction)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.reactionButton,
              pressed ? styles.reactionButtonPressed : null,
              submitting ? styles.disabledAction : null,
            ]}
            onPress={() => appendReaction(reaction)}
          >
            <Text style={styles.reactionEmoji}>{reaction}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.composerRow}>
        <AvatarView
          uri={currentUserPhoto}
          name={currentUserName || 'SoRita'}
          size={36}
        />
        <View style={[styles.composerInputWrap, composerIsContextual ? styles.composerInputWrapActive : null]}>
          <TextInput
            ref={inputRef}
            value={commentText}
            onChangeText={onCommentTextChange}
            maxLength={COMMENT_MAX_LENGTH}
            placeholder={composerPlaceholder}
            placeholderTextColor={colors.textSoft}
            style={styles.commentInput}
            accessibilityLabel={composerPlaceholder}
            editable={!submitting}
            multiline
            returnKeyType="default"
            textAlignVertical="top"
          />
          {characterCount > 0 ? (
            <Text
              style={[
                styles.commentInputCounter,
                characterCount > COMMENT_MAX_LENGTH * 0.9 ? styles.commentInputCounterWarn : null,
              ]}
            >
              {characterCount}/{COMMENT_MAX_LENGTH}
            </Text>
          ) : null}
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.sendButton,
            !canSubmit ? styles.sendButtonDisabled : null,
            pressed && canSubmit ? styles.sendButtonPressed : null,
          ]}
          onPress={onSubmit}
          disabled={!canSubmit}
          accessibilityLabel={tr.common.send}
          accessibilityRole="button"
        >
          <Send color={canSubmit ? colors.onPrimary : colors.textDisabled} size={15} />
        </Pressable>
      </View>
    </View>
  );
}
