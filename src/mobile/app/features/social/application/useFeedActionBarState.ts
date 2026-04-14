import { useMemo, useState } from 'react';

import { showToast } from '@/mobile/app/platform/feedback/toast';
import type {
  FeedActionComment,
} from '@/mobile/app/features/social/ui/components/FeedActionTypes';
import { tr } from '@/mobile/app/shared/i18n/tr';

type ReplyTarget = {
  commentId: string;
  userName: string;
  username?: string;
};

type UseFeedActionBarStateParams = {
  comments: FeedActionComment[];
  onCommentDelete?: (commentId: string) => Promise<void> | void;
  onCommentLikeToggle?: (commentId: string) => Promise<void> | void;
  onCommentReport?: (commentId: string, reason: string) => Promise<void> | void;
  onCommentSubmit?: (content: string, parentCommentId?: string | null) => Promise<void> | void;
  onCommentUpdate?: (commentId: string, content: string) => Promise<void> | void;
  onLikePress?: () => Promise<void> | void;
  onRefresh?: () => Promise<void> | void;
  onReportSubmit?: (reason: string) => Promise<void> | void;
  onUserPress?: (userId: string) => void;
};

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

export function useFeedActionBarState({
  comments,
  onCommentDelete,
  onCommentLikeToggle,
  onCommentReport,
  onCommentSubmit,
  onCommentUpdate,
  onLikePress,
  onRefresh,
  onReportSubmit,
  onUserPress,
}: UseFeedActionBarStateParams) {
  const [commentText, setCommentText] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [activeReportCommentId, setActiveReportCommentId] = useState<string | null>(null);
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState<string | null>(null);
  const [itemReportReason, setItemReportReason] = useState('');
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [commentsRefreshing, setCommentsRefreshing] = useState(false);
  const [likersRefreshing, setLikersRefreshing] = useState(false);

  const commentCount = useMemo(() => {
    const countCommentTree = (items: FeedActionComment[]) =>
      items.reduce((total, comment) => total + 1 + countCommentTree(comment.replies || []), 0);

    return countCommentTree(comments);
  }, [comments]);

  const resetCommentComposer = () => {
    setCommentText('');
    setEditingCommentId(null);
    setReplyingTo(null);
  };

  const handleLikePress = async () => {
    if (!onLikePress) {
      return;
    }

    try {
      await onLikePress();
    } catch (error) {
      showToast(getErrorMessage(error, 'Begeni guncellenemedi'), 'error');
    }
  };

  const handleCommentSubmit = async () => {
    if (!commentText.trim()) {
      return;
    }

    if ((!editingCommentId && !onCommentSubmit) || (editingCommentId && !onCommentUpdate)) {
      return;
    }

    setSubmitting(true);

    try {
      const nextContent =
        !editingCommentId && replyingTo?.username && !commentText.trim().startsWith('@')
          ? `@${replyingTo.username} ${commentText.trim()}`
          : commentText.trim();

      if (editingCommentId) {
        await onCommentUpdate?.(editingCommentId, commentText.trim());
      } else {
        await onCommentSubmit?.(nextContent, replyingTo?.commentId ?? null);
      }

      resetCommentComposer();
    } catch (error) {
      showToast(
        getErrorMessage(
          error,
          editingCommentId ? tr.cards.commentUpdateFailed : tr.cards.commentSendFailed,
        ),
        'error',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!onCommentDelete) {
      return;
    }

    try {
      await onCommentDelete(commentId);

      if (editingCommentId === commentId) {
        resetCommentComposer();
      }

      if (replyingTo?.commentId === commentId) {
        setReplyingTo(null);
      }

      if (activeReportCommentId === commentId) {
        setActiveReportCommentId(null);
        setReportReason('');
      }
    } catch (error) {
      showToast(getErrorMessage(error, tr.cards.commentDeleteFailed), 'error');
    }
  };

  const handleRefreshComments = async () => {
    if (!onRefresh) {
      return;
    }

    setCommentsRefreshing(true);

    try {
      await onRefresh();
    } finally {
      setCommentsRefreshing(false);
    }
  };

  const handleRefreshLikers = async () => {
    if (!onRefresh) {
      return;
    }

    setLikersRefreshing(true);

    try {
      await onRefresh();
    } finally {
      setLikersRefreshing(false);
    }
  };

  const handleStartEdit = (comment: FeedActionComment) => {
    setShowComments(true);
    setActiveReportCommentId(null);
    setReportReason('');
    setReplyingTo(null);
    setEditingCommentId(comment.id);
    setCommentText(comment.content);
  };

  const handleStartReply = (comment: FeedActionComment) => {
    setShowComments(true);
    setEditingCommentId(null);
    setActiveReportCommentId(null);
    setReportReason('');
    setReplyingTo({
      commentId: comment.parentCommentId || comment.id,
      userName: comment.userName,
      username: comment.username,
    });
  };

  const handleStartReport = (commentId: string) => {
    setEditingCommentId(null);
    setReplyingTo(null);
    setReportReason('');
    setActiveReportCommentId((current) => (current === commentId ? null : commentId));
  };

  const handleCommentReport = async (commentId: string) => {
    if (!reportReason || !onCommentReport) {
      return;
    }

    try {
      await onCommentReport(commentId, reportReason);
      showToast(tr.cards.reportSent, 'success');
      setActiveReportCommentId(null);
      setReportReason('');
    } catch (error) {
      showToast(getErrorMessage(error, tr.cards.commentReportFailed), 'error');
    }
  };

  const handleCommentLikeToggle = async (commentId: string) => {
    if (!onCommentLikeToggle) {
      return;
    }

    try {
      await onCommentLikeToggle(commentId);
    } catch (error) {
      showToast(getErrorMessage(error, tr.cards.commentLikeFailed), 'error');
    }
  };

  const handleItemReport = async () => {
    if (!itemReportReason || !onReportSubmit) {
      return;
    }

    try {
      await onReportSubmit(itemReportReason);
      setItemReportReason('');
      setShowReportSheet(false);
      showToast(tr.cards.reportSent, 'success');
    } catch (error) {
      showToast(getErrorMessage(error, tr.cards.commentReportFailed), 'error');
    }
  };

  const handleUserPress = (userId: string) => {
    setShowComments(false);
    setShowLikers(false);
    setShowAddress(false);
    requestAnimationFrame(() => {
      onUserPress?.(userId);
    });
  };

  return {
    activeReportCommentId,
    commentCount,
    commentText,
    commentsRefreshing,
    confirmDeleteCommentId,
    editingCommentId,
    handleCommentLikeToggle,
    handleCommentReport,
    handleCommentSubmit,
    handleDeleteComment,
    handleItemReport,
    handleLikePress,
    handleRefreshComments,
    handleRefreshLikers,
    handleStartEdit,
    handleStartReply,
    handleStartReport,
    handleUserPress,
    itemReportReason,
    likersRefreshing,
    replyingTo,
    reportReason,
    resetCommentComposer,
    setActiveReportCommentId,
    setCommentText,
    setConfirmDeleteCommentId,
    setItemReportReason,
    setReplyingTo,
    setReportReason,
    setShowAddress,
    setShowComments,
    setShowLikers,
    setShowReportSheet,
    showAddress,
    showComments,
    showLikers,
    showReportSheet,
    submitting,
  };
}
