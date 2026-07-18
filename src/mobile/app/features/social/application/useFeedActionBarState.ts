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
  commentCountOverride?: number;
  onCommentDelete?: (commentId: string) => Promise<void> | void;
  onCommentLikeToggle?: (commentId: string) => Promise<void> | void;
  onCommentReport?: (commentId: string, reason: string, details?: string) => Promise<void> | void;
  onCommentSubmit?: (content: string, parentCommentId?: string | null) => Promise<void> | void;
  onCommentUpdate?: (commentId: string, content: string) => Promise<void> | void;
  onLikePress?: () => Promise<void> | void;
  onRefresh?: () => Promise<void> | void;
  onReportSubmit?: (reason: string, details?: string) => Promise<void> | void;
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
  commentCountOverride,
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
  const [reportDetails, setReportDetails] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [activeReportCommentId, setActiveReportCommentId] = useState<string | null>(null);
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState<string | null>(null);
  const [itemReportReason, setItemReportReason] = useState('');
  const [itemReportDetails, setItemReportDetails] = useState('');
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [commentsRefreshing, setCommentsRefreshing] = useState(false);
  const [likersRefreshing, setLikersRefreshing] = useState(false);

  const commentCount = useMemo(() => {
    if (typeof commentCountOverride === 'number') {
      return Math.max(0, commentCountOverride);
    }

    const countCommentTree = (items: FeedActionComment[]): number =>
      items.reduce((total, comment) => total + 1 + countCommentTree(comment.replies || []), 0);

    return countCommentTree(comments);
  }, [commentCountOverride, comments]);

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
      showToast(getErrorMessage(error, tr.cards.likeUpdateFailed), 'error');
    }
  };

  const handleCommentSubmit = async () => {
    if (!commentText.trim() || submitting) {
      return;
    }

    if ((!editingCommentId && !onCommentSubmit) || (editingCommentId && !onCommentUpdate)) {
      return;
    }

    const previousCommentText = commentText;
    const previousEditingCommentId = editingCommentId;
    const previousReplyingTo = replyingTo;
    const nextContent =
      !editingCommentId && replyingTo?.username && !commentText.trim().startsWith('@')
        ? `@${replyingTo.username} ${commentText.trim()}`
        : commentText.trim();

    resetCommentComposer();
    setSubmitting(true);

    try {
      if (editingCommentId) {
        await onCommentUpdate?.(editingCommentId, previousCommentText.trim());
      } else {
        await onCommentSubmit?.(nextContent, previousReplyingTo?.commentId ?? null);
      }
    } catch (error) {
      setCommentText(previousCommentText);
      setEditingCommentId(previousEditingCommentId);
      setReplyingTo(previousReplyingTo);
      showToast(
        getErrorMessage(
          error,
          previousEditingCommentId ? tr.cards.commentUpdateFailed : tr.cards.commentSendFailed,
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
        setReportDetails('');
        setReportReason('');
      }
    } catch (error) {
      showToast(getErrorMessage(error, tr.cards.commentDeleteFailed), 'error');
    }
  };

  const handleRefreshComments = async () => {
    if (!onRefresh || commentsRefreshing) {
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
    if (!onRefresh || likersRefreshing) {
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
    if (comment.pendingSync) {
      showToast(tr.cards.commentSyncing, 'error');
      return;
    }

    if (comment.editWindowExpired) {
      showToast(tr.cards.commentEditExpired, 'error');
      return;
    }

    setShowComments(true);
    setActiveReportCommentId(null);
    setReportDetails('');
    setReportReason('');
    setReplyingTo(null);
    setEditingCommentId(comment.id);
    setCommentText(comment.content);
  };

  const handleStartReply = (comment: FeedActionComment) => {
    setShowComments(true);
    setEditingCommentId(null);
    setActiveReportCommentId(null);
    setReportDetails('');
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
    setReportDetails('');
    setReportReason('');
    setActiveReportCommentId((current) => (current === commentId ? null : commentId));
  };

  const handleCommentReport = async (commentId: string) => {
    if (!reportReason || !onCommentReport) {
      return;
    }

    try {
      await onCommentReport(commentId, reportReason, reportDetails.trim() || undefined);
      showToast(tr.cards.reportSent, 'success');
      setActiveReportCommentId(null);
      setReportDetails('');
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
      await onReportSubmit(itemReportReason, itemReportDetails.trim() || undefined);
      setItemReportDetails('');
      setItemReportReason('');
      setShowReportSheet(false);
      showToast(tr.cards.reportSent, 'success');
    } catch (error) {
      showToast(getErrorMessage(error, tr.cards.reportFailed), 'error');
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
    itemReportDetails,
    likersRefreshing,
    replyingTo,
    reportDetails,
    reportReason,
    resetCommentComposer,
    setActiveReportCommentId,
    setCommentText,
    setConfirmDeleteCommentId,
    setItemReportDetails,
    setItemReportReason,
    setReportDetails,
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
