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
  onHeightChange: (height: number) => void;
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
  onHeightChange,
  onSubmit,
}: CommentComposerProps) {
  const composerPlaceholder = editingCommentId
    ? tr.cards.editComment
    : replyingTo?.username
      ? tr.cards.replyPlaceholder(replyingTo.username)
      : tr.cards.commentPlaceholder;

  return (
    <View
      style={[
        styles.composerDock,
        {
          paddingBottom: composerInset,
          marginBottom: composerKeyboardOffset,
        },
      ]}
      onLayout={(event) => {
        onHeightChange(event.nativeEvent.layout.height);
      }}
    >
      {editingCommentId ? (
        <View style={styles.composerBanner}>
          <Text style={styles.composerBannerText}>{tr.cards.editingComment}</Text>
          <Pressable onPress={onCancelEdit}>
            <Text style={styles.composerBannerAction}>{tr.cards.cancelEditComment}</Text>
          </Pressable>
        </View>
      ) : null}

      {replyingTo ? (
        <View style={styles.composerBanner}>
          <Text style={styles.composerBannerText}>{tr.cards.replyingTo(replyingTo.userName)}</Text>
          <Pressable onPress={onCancelReply}>
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
            style={styles.reactionButton}
            onPress={() =>
              onCommentTextChange(commentText ? `${commentText} ${reaction}` : reaction)
            }
          >
            <Text style={styles.reactionEmoji}>{reaction}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.composerRow}>
        <AvatarView
          uri={currentUserPhoto}
          name={currentUserName || 'SoRita'}
          size={42}
        />
        <View style={styles.composerInputWrap}>
          <TextInput
            value={commentText}
            onChangeText={onCommentTextChange}
            maxLength={COMMENT_MAX_LENGTH}
            placeholder={composerPlaceholder}
            placeholderTextColor={colors.textSoft}
            style={styles.commentInput}
            editable={!submitting}
            multiline
          />
        </View>
        <Pressable
          style={[styles.sendButton, submitting ? styles.disabledAction : null]}
          onPress={onSubmit}
          disabled={submitting}
        >
          <Send color={colors.onPrimary} size={16} />
        </Pressable>
      </View>
    </View>
  );
}
