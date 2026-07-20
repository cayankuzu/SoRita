import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { showToast } from '@/mobile/app/platform/feedback/toast';
import { CommentComposer } from '@/mobile/app/features/social/ui/components/comment-panel/CommentComposer';
import { CommentActionSheet } from '@/mobile/app/features/social/ui/components/comment-panel/CommentActionSheet';
import { commentPanelStyles as styles } from '@/mobile/app/features/social/ui/components/comment-panel/commentPanelStyles';
import type { ReplyTarget } from '@/mobile/app/features/social/ui/components/comment-panel/commentPanelTypes';
import { CommentThread } from '@/mobile/app/features/social/ui/components/comment-panel/CommentThread';
import { LikersPanel } from '@/mobile/app/features/social/ui/components/LikersPanel';
import type { FeedActionComment } from '@/mobile/app/features/social/ui/components/FeedActionTypes';
import { ReportActionSheet } from '@/mobile/app/shared/components/feedback/ReportActionSheet';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import {
  getAndroidModalWindowProps,
  getModalContentMaxHeight,
  getModalSafeAreaPadding,
} from '@/mobile/app/shared/utils/modalLayout';

const ANDROID_MODAL_BASE_INSET = 22;
const ANDROID_KEYBOARD_EXTRA_LIFT = 10;
const COMPOSER_DOCK_BOTTOM_PADDING = 10;

type CommentPanelProps = {
  visible: boolean;
  comments: FeedActionComment[];
  commentText: string;
  editingCommentId?: string | null;
  activeReportCommentId?: string | null;
  reportDetails?: string;
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
  onLoadMoreComments?: () => void;
  onToggleCommentLike: (commentId: string) => void;
  onStartReport: (commentId: string) => void;
  onCloseReport: () => void;
  onReportDetailsChange: (value: string) => void;
  onReportReasonChange: (value: string) => void;
  onReportSubmit: (commentId: string) => void;
  refreshing?: boolean;
  onRefreshComments?: () => void;
  onRefreshLikers?: () => void;
  onUserPress?: (userId: string) => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
};

export function CommentPanel({
  visible,
  comments,
  commentText,
  editingCommentId = null,
  activeReportCommentId = null,
  reportDetails = '',
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
  onLoadMoreComments,
  onToggleCommentLike,
  onStartReport,
  onCloseReport,
  onReportDetailsChange,
  onReportReasonChange,
  onReportSubmit,
  refreshing = false,
  onRefreshComments,
  onRefreshLikers,
  onUserPress,
  hasNextPage = false,
  isFetchingNextPage = false,
}: CommentPanelProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { paddingTop: overlayTopPadding, paddingBottom: overlayBottomPadding } =
    getModalSafeAreaPadding({
      topInset: insets.top,
      bottomInset: insets.bottom,
      topSpacing: 20,
      bottomSpacing: 8,
      minBottomPadding: Platform.OS === 'android' ? ANDROID_MODAL_BASE_INSET : 8,
    });
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [activeLikedComment, setActiveLikedComment] = useState<FeedActionComment | null>(null);
  const [activeMenuComment, setActiveMenuComment] = useState<FeedActionComment | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const totalComments = useMemo(() => {
    const countTree = (items: FeedActionComment[]): number =>
      items.reduce((total, item) => total + 1 + countTree(item.replies || []), 0);

    return countTree(comments);
  }, [comments]);

  useEffect(() => {
    if (!visible) {
      setActiveLikedComment(null);
      setActiveMenuComment(null);
      setKeyboardHeight(0);
    }
  }, [visible]);

  const handleClose = React.useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const handleCopyComment = React.useCallback(async (comment: FeedActionComment) => {
    try {
      await Clipboard.setStringAsync(comment.content);
      showToast(tr.cards.commentCopied, 'success');
    } catch {
      showToast(tr.cards.commentCopyFailed, 'error');
    }
  }, []);

  useEffect(() => {
    if (!visible || Platform.OS !== 'android') {
      return;
    }

    const handleKeyboardShow = (event: { endCoordinates?: { height?: number } }) => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
    };
    const handleKeyboardHide = () => {
      setKeyboardHeight(0);
    };

    const showSubscription = Keyboard.addListener('keyboardDidShow', handleKeyboardShow);
    const frameSubscription = Keyboard.addListener('keyboardDidChangeFrame', handleKeyboardShow);
    const hideSubscription = Keyboard.addListener('keyboardDidHide', handleKeyboardHide);

    return () => {
      showSubscription.remove();
      frameSubscription.remove();
      hideSubscription.remove();
    };
  }, [visible]);

  const toggleReplies = (commentId: string) => {
    setExpandedReplies((current) => ({
      ...current,
      [commentId]: !(current[commentId] ?? true),
    }));
  };

  // The modal overlay already reserves the device safe area. Keeping a second
  // system inset inside the composer created a large empty block below the input.
  const composerInset = COMPOSER_DOCK_BOTTOM_PADDING;
  const modalBottomInset = overlayBottomPadding;
  const composerKeyboardOffset =
    Platform.OS === 'android'
      ? Math.max(keyboardHeight - modalBottomInset + ANDROID_KEYBOARD_EXTRA_LIFT, 0)
      : 0;
  const commentSheetMaxHeight = getModalContentMaxHeight({
    viewportHeight: windowHeight,
    paddingTop: overlayTopPadding,
    paddingBottom: modalBottomInset,
    maxHeightRatio: 0.92,
    minHeight: 360,
  });
  const preferredCommentSheetHeight = Math.max(Math.round(windowHeight * 0.84), 420);
  const commentSheetHeight = Math.min(commentSheetMaxHeight, preferredCommentSheetHeight);
  const commentSheetMinHeight = Math.min(commentSheetHeight, 360);

  return (
    <>
      <Modal
        {...getAndroidModalWindowProps({
          navigationBarTranslucent: true,
          statusBarTranslucent: true,
        })}
        visible={visible}
        transparent
        animationType="slide"
        hardwareAccelerated
        onRequestClose={handleClose}
        presentationStyle="overFullScreen"
      >
        <View
          style={[
            styles.sheetOverlay,
            { paddingTop: overlayTopPadding, paddingBottom: modalBottomInset },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.sheetKeyboard}
          >
            <View
              style={[
                styles.commentSheet,
                {
                  height: commentSheetHeight,
                  maxHeight: commentSheetMaxHeight,
                  minHeight: commentSheetMinHeight,
                },
              ]}
            >
              <View style={styles.handle} />

              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetTitle}>{tr.cards.commentsTitle}</Text>
                  <Text style={styles.sheetSubtitle}>{tr.cards.commentCount(totalComments)}</Text>
                </View>
                <Pressable onPress={handleClose} style={styles.sheetCloseButton} accessibilityLabel={tr.common.close} accessibilityRole="button">
                  <X color={colors.textSoft} size={18} />
                </Pressable>
              </View>

              <View style={styles.sheetBody}>
                <FlatList
                  data={comments}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <CommentThread
                      comments={[item]}
                      editingCommentId={editingCommentId}
                      expandedReplies={expandedReplies}
                      onOpenCommentMenu={setActiveMenuComment}
                      onShowCommentLikers={setActiveLikedComment}
                      onStartReply={onStartReply}
                      onToggleCommentLike={onToggleCommentLike}
                      onToggleReplies={toggleReplies}
                      onUserPress={onUserPress}
                    />
                  )}
                  style={styles.commentScroll}
                  contentContainerStyle={[
                    styles.commentScrollContent,
                    comments.length === 0 ? styles.commentScrollContentEmpty : null,
                    { paddingBottom: 18 },
                  ]}
                  initialNumToRender={8}
                  keyboardShouldPersistTaps="handled"
                  maxToRenderPerBatch={8}
                  onRefresh={onRefreshComments}
                  refreshing={Boolean(onRefreshComments && refreshing)}
                  showsVerticalScrollIndicator={false}
                  removeClippedSubviews={Platform.OS === 'android'}
                  updateCellsBatchingPeriod={32}
                  windowSize={7}
                  ListEmptyComponent={
                    <View style={styles.emptyComments}>
                      <Text style={styles.emptyCommentsTitle}>{tr.cards.emptyComments}</Text>
                      <Text style={styles.emptyCommentsDescription}>{tr.cards.firstComment}</Text>
                    </View>
                  }
                  ListFooterComponent={
                    hasNextPage ? (
                        <Pressable
                          disabled={isFetchingNextPage}
                          style={[styles.loadMoreButton, isFetchingNextPage ? styles.disabledAction : null]}
                          onPress={onLoadMoreComments}
                        >
                          <Text style={styles.loadMoreLabel}>
                            {isFetchingNextPage ? tr.common.loadingMore : tr.cards.loadMoreComments}
                          </Text>
                        </Pressable>
                      ) : null
                  }
                />

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
                  onSubmit={onSubmit}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <ReportActionSheet
        visible={Boolean(activeReportCommentId)}
        title={tr.cards.reportCommentTitle}
        description={tr.cards.reportCommentDescription}
        reportDetails={reportDetails}
        reportReason={reportReason}
        onReportDetailsChange={onReportDetailsChange}
        onReportReasonChange={onReportReasonChange}
        onClose={onCloseReport}
        onSubmit={() => {
          if (activeReportCommentId) {
            onReportSubmit(activeReportCommentId);
          }
        }}
      />

      <CommentActionSheet
        comment={activeMenuComment}
        editingCommentId={editingCommentId}
        onClose={() => setActiveMenuComment(null)}
        onCopy={(comment) => {
          setActiveMenuComment(null);
          void handleCopyComment(comment);
        }}
        onDelete={(comment) => {
          setActiveMenuComment(null);
          onDeleteComment(comment.id);
        }}
        onEdit={(comment) => {
          setActiveMenuComment(null);
          onStartEdit(comment);
        }}
        onReport={(comment) => {
          setActiveMenuComment(null);
          onStartReport(comment.id);
        }}
      />

      <Modal
        {...getAndroidModalWindowProps({
          navigationBarTranslucent: true,
          statusBarTranslucent: true,
        })}
        visible={Boolean(activeLikedComment)}
        transparent
        animationType="fade"
        hardwareAccelerated
        onRequestClose={() => setActiveLikedComment(null)}
        presentationStyle="overFullScreen"
      >
        <View
          style={[
            styles.sheetOverlay,
            { paddingTop: overlayTopPadding, paddingBottom: modalBottomInset },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setActiveLikedComment(null)}
          />
          <View
            style={[
              styles.innerSheetCard,
              {
                paddingBottom: Platform.OS === 'android' ? 20 : 16,
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
