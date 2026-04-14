import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { CommentComposer } from '@/mobile/app/features/social/ui/components/comment-panel/CommentComposer';
import { commentPanelStyles as styles } from '@/mobile/app/features/social/ui/components/comment-panel/commentPanelStyles';
import type { ReplyTarget } from '@/mobile/app/features/social/ui/components/comment-panel/commentPanelTypes';
import { CommentThread } from '@/mobile/app/features/social/ui/components/comment-panel/CommentThread';
import { LikersPanel } from '@/mobile/app/features/social/ui/components/LikersPanel';
import type { FeedActionComment } from '@/mobile/app/features/social/ui/components/FeedActionTypes';
import { ReportActionSheet } from '@/mobile/app/shared/components/feedback/ReportActionSheet';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

type CommentPanelProps = {
  visible: boolean;
  comments: FeedActionComment[];
  commentText: string;
  editingCommentId?: string | null;
  activeReportCommentId?: string | null;
  reportReason: string;
  currentUserName?: string;
  currentUserPhoto?: string;
  replyingTo?: ReplyTarget | null;
  submitting?: boolean;
  onClose: () => void;
  onCommentTextChange: (value: string) => void;
  onSubmit: () => void;
  onStartEdit: (comment: FeedActionComment) => void;
  onStartReply: (comment: FeedActionComment) => void;
  onCancelEdit: () => void;
  onCancelReply: () => void;
  onDeleteComment: (commentId: string) => void;
  onToggleCommentLike: (commentId: string) => void;
  onStartReport: (commentId: string) => void;
  onCloseReport: () => void;
  onReportReasonChange: (value: string) => void;
  onReportSubmit: (commentId: string) => void;
  refreshing?: boolean;
  onRefreshComments?: () => void;
  onRefreshLikers?: () => void;
  onUserPress?: (userId: string) => void;
};

export function CommentPanel({
  visible,
  comments,
  commentText,
  editingCommentId = null,
  activeReportCommentId = null,
  reportReason,
  currentUserName,
  currentUserPhoto,
  replyingTo = null,
  submitting = false,
  onClose,
  onCommentTextChange,
  onSubmit,
  onStartEdit,
  onStartReply,
  onCancelEdit,
  onCancelReply,
  onDeleteComment,
  onToggleCommentLike,
  onStartReport,
  onCloseReport,
  onReportReasonChange,
  onReportSubmit,
  refreshing = false,
  onRefreshComments,
  onRefreshLikers,
  onUserPress,
}: CommentPanelProps) {
  const insets = useSafeAreaInsets();
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [activeLikedComment, setActiveLikedComment] = useState<FeedActionComment | null>(null);
  const [composerHeight, setComposerHeight] = useState(132);

  const totalComments = useMemo(() => {
    const countTree = (items: FeedActionComment[]) =>
      items.reduce((total, item) => total + 1 + countTree(item.replies || []), 0);

    return countTree(comments);
  }, [comments]);

  useEffect(() => {
    if (!visible) {
      setActiveLikedComment(null);
    }
  }, [visible]);

  const toggleReplies = (commentId: string) => {
    setExpandedReplies((current) => ({
      ...current,
      [commentId]: !(current[commentId] ?? true),
    }));
  };

  const composerInset = Math.max(insets.bottom, 12);
  const modalBottomInset = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : insets.bottom;
  const composerKeyboardOffset = 0;
  const commentScrollBottomPadding = composerHeight + composerInset + composerKeyboardOffset + 18;

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <View style={[styles.sheetOverlay, { paddingBottom: modalBottomInset }]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheetKeyboard}
          >
            <View style={styles.commentSheet}>
              <View style={styles.handle} />

              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetTitle}>Yorumlar</Text>
                  <Text style={styles.sheetSubtitle}>{totalComments} yorum</Text>
                </View>
                <Pressable onPress={onClose} style={styles.sheetCloseButton}>
                  <X color={colors.textSoft} size={18} />
                </Pressable>
              </View>

              <View style={styles.sheetBody}>
                <ScrollView
                  style={styles.commentScroll}
                  contentContainerStyle={[
                    styles.commentScrollContent,
                    { paddingBottom: commentScrollBottomPadding },
                  ]}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    onRefreshComments ? (
                      <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefreshComments}
                        tintColor={colors.primary}
                      />
                    ) : undefined
                  }
                >
                  {comments.length === 0 ? (
                    <View style={styles.emptyComments}>
                      <Text style={styles.emptyCommentsTitle}>{tr.cards.emptyComments}</Text>
                      <Text style={styles.emptyCommentsDescription}>Ilk yorumu sen yaz.</Text>
                    </View>
                  ) : (
                    <CommentThread
                      comments={comments}
                      editingCommentId={editingCommentId}
                      expandedReplies={expandedReplies}
                      onDeleteComment={onDeleteComment}
                      onShowCommentLikers={setActiveLikedComment}
                      onStartEdit={onStartEdit}
                      onStartReply={onStartReply}
                      onStartReport={onStartReport}
                      onToggleCommentLike={onToggleCommentLike}
                      onToggleReplies={toggleReplies}
                      onUserPress={onUserPress}
                    />
                  )}
                </ScrollView>

                <CommentComposer
                  commentText={commentText}
                  currentUserName={currentUserName}
                  currentUserPhoto={currentUserPhoto}
                  editingCommentId={editingCommentId}
                  replyingTo={replyingTo}
                  submitting={submitting}
                  composerInset={composerInset}
                  composerKeyboardOffset={composerKeyboardOffset}
                  onCancelEdit={onCancelEdit}
                  onCancelReply={onCancelReply}
                  onCommentTextChange={onCommentTextChange}
                  onHeightChange={setComposerHeight}
                  onSubmit={onSubmit}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <ReportActionSheet
        visible={Boolean(activeReportCommentId)}
        title="Yorumu bildir"
        description="Bu yorumu neden bildirmek istedigini sec."
        reportReason={reportReason}
        onReportReasonChange={onReportReasonChange}
        onClose={onCloseReport}
        onSubmit={() => {
          if (activeReportCommentId) {
            onReportSubmit(activeReportCommentId);
          }
        }}
      />

      <Modal
        visible={Boolean(activeLikedComment)}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveLikedComment(null)}
        statusBarTranslucent
      >
        <View style={[styles.sheetOverlay, { paddingBottom: modalBottomInset }]}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setActiveLikedComment(null)}
          />
          <View
            style={[
              styles.innerSheetCard,
              {
                paddingBottom: Math.max(insets.bottom + 8, 20),
              },
            ]}
          >
            <LikersPanel
              likeCount={activeLikedComment?.likes || 0}
              likers={activeLikedComment?.likers || []}
              onClose={() => setActiveLikedComment(null)}
              refreshing={refreshing}
              onRefresh={onRefreshLikers}
              onUserPress={(userId) => {
                setActiveLikedComment(null);
                onUserPress?.(userId);
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
