import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type KeyboardEvent,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { showToast } from '@/mobile/app/platform/feedback/toast';
import { CommentComposer } from '@/mobile/app/features/social/ui/components/comment-panel/CommentComposer';
import { CommentActionSheet } from '@/mobile/app/features/social/ui/components/comment-panel/CommentActionSheet';
import {
  resolveAndroidKeyboardLift,
  type KeyboardFrame,
} from '@/mobile/app/features/social/ui/components/comment-panel/commentPanelKeyboardLayout';
import { commentPanelStyles as styles } from '@/mobile/app/features/social/ui/components/comment-panel/commentPanelStyles';
import type { ReplyTarget } from '@/mobile/app/features/social/ui/components/comment-panel/commentPanelTypes';
import { CommentThread } from '@/mobile/app/features/social/ui/components/comment-panel/CommentThread';
import {
  DEFAULT_VISIBLE_REPLY_COUNT,
  countCommentTree,
  flattenVisibleComments,
} from '@/mobile/app/features/social/ui/components/comment-panel/commentTree';
import { LikersPanel } from '@/mobile/app/features/social/ui/components/LikersPanel';
import type { FeedActionComment } from '@/mobile/app/features/social/ui/components/FeedActionTypes';
import { ReportActionSheet } from '@/mobile/app/shared/components/feedback/ReportActionSheet';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { useModalAnimationType } from '@/mobile/app/shared/hooks/useModalAnimationType';
import {
  getAndroidModalWindowProps,
  getModalContentMaxHeight,
  getModalSafeAreaPadding,
} from '@/mobile/app/shared/utils/modalLayout';

const ANDROID_MODAL_BASE_INSET = 22;
const COMPOSER_DOCK_BOTTOM_PADDING = 10;

function buildUserIdByMention(comments: FeedActionComment[]) {
  const result = new Map<string, string>();
  const pending = [...comments];

  while (pending.length > 0) {
    const comment = pending.pop();
    if (!comment) {
      continue;
    }
    if (comment.username && comment.userId) {
      result.set(comment.username.toLowerCase(), comment.userId);
    }
    if (comment.replies?.length) {
      pending.push(...comment.replies);
    }
  }

  return result;
}

function CommentLikersModal({
  animationType,
  bottomPadding,
  comment,
  onClose,
  onRefresh,
  onUserPress,
  refreshing,
  topPadding,
}: {
  animationType: React.ComponentProps<typeof Modal>['animationType'];
  bottomPadding: number;
  comment: FeedActionComment | null;
  onClose: () => void;
  onRefresh?: () => void;
  onUserPress?: (userId: string) => void;
  refreshing: boolean;
  topPadding: number;
}) {
  return (
    <Modal
      {...getAndroidModalWindowProps({
        navigationBarTranslucent: true,
        statusBarTranslucent: true,
      })}
      visible={Boolean(comment)}
      transparent
      animationType={animationType}
      hardwareAccelerated
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <View
        accessibilityViewIsModal
        importantForAccessibility="yes"
        style={[styles.sheetOverlay, { paddingTop: topPadding, paddingBottom: bottomPadding }]}
      >
        <Pressable accessible={false} style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View
          style={[
            styles.innerSheetCard,
            { paddingBottom: Platform.OS === 'android' ? 20 : 16 },
          ]}
        >
          <LikersPanel
            likeCount={comment?.likes || 0}
            likers={comment?.likers || []}
            onClose={onClose}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onUserPress={(userId) => {
              onClose();
              onUserPress?.(userId);
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

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
  onReportSubmit: (commentId: string) => void | Promise<void>;
  refreshing?: boolean;
  onRefreshComments?: () => void;
  onRefreshLikers?: () => void;
  onUserPress?: (userId: string) => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
};

function useAndroidCommentKeyboardLift(params: {
  overlayBottomPadding: number;
  visible: boolean;
}) {
  const composerDockRef = React.useRef<View | null>(null);
  const keyboardLiftRef = React.useRef(0);
  const keyboardMeasureFrameRef = React.useRef<number | null>(null);
  const [keyboardLift, setKeyboardLift] = useState(0);

  useEffect(() => {
    if (!params.visible) {
      keyboardLiftRef.current = 0;
      setKeyboardLift(0);
    }
  }, [params.visible]);

  useEffect(() => {
    if (!params.visible || Platform.OS !== 'android') {
      return;
    }

    const commitKeyboardLift = (frame: KeyboardFrame, composerBottom: number) => {
      const nextLift = resolveAndroidKeyboardLift({
        composerBottom,
        keyboardTop: frame.screenY,
      });
      keyboardLiftRef.current = nextLift;
      setKeyboardLift(nextLift);
    };
    const handleKeyboardShow = (event: KeyboardEvent) => {
      const keyboardFrame = {
        height: event.endCoordinates.height,
        screenY: event.endCoordinates.screenY,
      };
      const fallbackComposerBottom =
        Dimensions.get('screen').height - params.overlayBottomPadding;

      if (keyboardMeasureFrameRef.current != null) {
        cancelAnimationFrame(keyboardMeasureFrameRef.current);
      }
      keyboardMeasureFrameRef.current = requestAnimationFrame(() => {
        keyboardMeasureFrameRef.current = null;
        const composerDock = composerDockRef.current;
        if (!composerDock) {
          commitKeyboardLift(keyboardFrame, fallbackComposerBottom);
          return;
        }

        composerDock.measureInWindow((_x, y, _width, height) => {
          const unshiftedComposerBottom = y + height + keyboardLiftRef.current;
          commitKeyboardLift(keyboardFrame, unshiftedComposerBottom);
        });
      });
    };
    const handleKeyboardHide = () => {
      keyboardLiftRef.current = 0;
      setKeyboardLift(0);
    };

    const currentFrame = Keyboard.metrics?.();
    if (currentFrame) {
      handleKeyboardShow({ endCoordinates: currentFrame } as KeyboardEvent);
    }

    const showSubscription = Keyboard.addListener('keyboardDidShow', handleKeyboardShow);
    const frameSubscription = Keyboard.addListener('keyboardDidChangeFrame', handleKeyboardShow);
    const hideSubscription = Keyboard.addListener('keyboardDidHide', handleKeyboardHide);

    return () => {
      if (keyboardMeasureFrameRef.current != null) {
        cancelAnimationFrame(keyboardMeasureFrameRef.current);
        keyboardMeasureFrameRef.current = null;
      }
      showSubscription.remove();
      frameSubscription.remove();
      hideSubscription.remove();
    };
  }, [params.overlayBottomPadding, params.visible]);

  return { composerDockRef, keyboardLift };
}

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
  const sheetAnimationType = useModalAnimationType('slide');
  const fadeAnimationType = useModalAnimationType('fade');
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
  const [visibleReplyCounts, setVisibleReplyCounts] = useState<Record<string, number>>({});
  const [activeLikedComment, setActiveLikedComment] = useState<FeedActionComment | null>(null);
  const [activeMenuComment, setActiveMenuComment] = useState<FeedActionComment | null>(null);
  const { composerDockRef, keyboardLift } = useAndroidCommentKeyboardLift({
    overlayBottomPadding,
    visible,
  });

  const totalComments = useMemo(() => countCommentTree(comments), [comments]);
  const visibleComments = useMemo(
    () => flattenVisibleComments(comments, expandedReplies, visibleReplyCounts),
    [comments, expandedReplies, visibleReplyCounts],
  );
  const userIdByMention = useMemo(() => buildUserIdByMention(comments), [comments]);

  useEffect(() => {
    if (!visible) {
      setActiveLikedComment(null);
      setActiveMenuComment(null);
      setExpandedReplies({});
      setVisibleReplyCounts({});
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

  const toggleReplies = (commentId: string) => {
    setExpandedReplies((current) => ({
      ...current,
      [commentId]: !(current[commentId] ?? true),
    }));
  };
  const loadMoreReplies = (commentId: string) => {
    setVisibleReplyCounts((current) => ({
      ...current,
      [commentId]:
        (current[commentId] ?? DEFAULT_VISIBLE_REPLY_COUNT) +
        DEFAULT_VISIBLE_REPLY_COUNT,
    }));
  };
  const handleMentionPress = React.useCallback(
    (mention: string) => {
      const userId = userIdByMention.get(mention.replace(/^@/, '').toLowerCase());
      if (userId) {
        onUserPress?.(userId);
      }
    },
    [onUserPress, userIdByMention],
  );

  // The modal overlay already reserves the device safe area. Keeping a second
  // system inset inside the composer created a large empty block below the input.
  const composerInset = COMPOSER_DOCK_BOTTOM_PADDING;
  const modalBottomInset = overlayBottomPadding;
  const commentSheetMaxHeight = getModalContentMaxHeight({
    viewportHeight: windowHeight,
    paddingTop: overlayTopPadding,
    paddingBottom: modalBottomInset + keyboardLift,
    maxHeightRatio: 0.92,
    minHeight: 310,
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
        animationType={sheetAnimationType}
        hardwareAccelerated
        onRequestClose={handleClose}
        presentationStyle="overFullScreen"
      >
        <View
          accessibilityViewIsModal
          importantForAccessibility="yes"
          style={[
            styles.sheetOverlay,
            { paddingTop: overlayTopPadding, paddingBottom: modalBottomInset },
          ]}
        >
          <Pressable accessible={false} style={StyleSheet.absoluteFillObject} onPress={handleClose} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[
              styles.sheetKeyboard,
              Platform.OS === 'android' && keyboardLift > 0
                ? { marginBottom: keyboardLift }
                : null,
            ]}
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
                  <Text accessibilityRole="header" style={styles.sheetTitle}>
                    {tr.cards.commentsTitle}
                  </Text>
                  <Text style={styles.sheetSubtitle}>{tr.cards.commentCount(totalComments)}</Text>
                </View>
                <IconButton
                  accessibilityLabel={tr.common.close}
                  onPress={handleClose}
                  variant="surface"
                >
                  <X color={colors.textSoft} size={16} />
                </IconButton>
              </View>

              <View style={styles.sheetBody}>
                <FlatList
                  data={visibleComments}
                  keyExtractor={(item) => item.comment.id}
                  renderItem={({ item }) => (
                    <CommentThread
                      comment={item.comment}
                      depth={item.depth}
                      editingCommentId={editingCommentId}
                      hiddenReplyCount={item.hiddenReplyCount}
                      repliesExpanded={item.repliesExpanded}
                      replyCount={item.replyCount}
                      onLoadMoreReplies={loadMoreReplies}
                      onMentionPress={onUserPress ? handleMentionPress : undefined}
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
                    visibleComments.length === 0 ? styles.commentScrollContentEmpty : null,
                    { paddingBottom: 14 },
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
                          accessibilityRole="button"
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

                <View ref={composerDockRef} collapsable={false}>
                  <CommentComposer
                    commentText={commentText}
                    currentUserName={currentUserName}
                    currentUserPhoto={currentUserPhoto}
                    editingCommentId={editingCommentId}
                    replyingTo={replyingTo}
                    submitting={submitting}
                    composerInset={composerInset}
                    onCancelEdit={onCancelEdit}
                    onCancelReply={onCancelReply}
                    onCommentTextChange={onCommentTextChange}
                    onSubmit={onSubmit}
                  />
                </View>
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
            return onReportSubmit(activeReportCommentId);
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

      <CommentLikersModal
        animationType={fadeAnimationType}
        bottomPadding={modalBottomInset}
        comment={activeLikedComment}
        onClose={() => setActiveLikedComment(null)}
        onRefresh={onRefreshLikers}
        onUserPress={onUserPress}
        refreshing={refreshing}
        topPadding={overlayTopPadding}
      />
    </>
  );
}
