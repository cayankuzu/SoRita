import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import {
  Crosshair,
  Ellipsis,
  Flag,
  Heart,
  ListPlus,
  MapPin,
  MessageCircle,
  Share2,
} from 'lucide-react-native';

import { useFeedActionBarState } from '@/mobile/app/features/social/application/useFeedActionBarState';
import {
  AddressPanel,
  CommentPanel,
  LikersPanel,
} from '@/mobile/app/features/social/ui/components/FeedActionPanels';
import { MINI_MAP_RESET_LONG_PRESS_MS } from '@/mobile/app/shared/components/maps/useMiniMapInteraction';
import { ConfirmActionModal } from '@/mobile/app/shared/components/feedback/ConfirmActionModal';
import { ReportActionSheet } from '@/mobile/app/shared/components/feedback/ReportActionSheet';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import type {
  FeedActionComment,
  FeedActionLiker,
  FeedActionLocation,
} from '@/mobile/app/features/social/ui/components/FeedActionTypes';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import { triggerHaptic } from '@/mobile/app/shared/hooks/useHaptic';

type FeedActionBarProps = {
  currentUserName?: string;
  currentUserPhoto?: string;
  liked?: boolean;
  likeCount?: number;
  likers?: FeedActionLiker[];
  comments?: FeedActionComment[];
  commentCount?: number;
  location?: FeedActionLocation;
  showCommentAction?: boolean;
  showShareAction?: boolean;
  showAddToList?: boolean;
  onLikePress?: () => Promise<void> | void;
  onSharePress?: () => void;
  onFocusPress?: () => void;
  onFocusLongPress?: () => void;
  focusActionActive?: boolean;
  onAddToListPress?: () => void;
  onAddressCopied?: () => void;
  onCommentSubmit?: (content: string, parentCommentId?: string | null) => Promise<void> | void;
  onCommentUpdate?: (commentId: string, content: string) => Promise<void> | void;
  onCommentDelete?: (commentId: string) => Promise<void> | void;
  onCommentsLoadMore?: () => Promise<void> | void;
  onCommentReport?: (commentId: string, reason: string, details?: string) => Promise<void> | void;
  onCommentLikeToggle?: (commentId: string) => Promise<void> | void;
  showReportAction?: boolean;
  showOverflowAction?: boolean;
  reportTitle?: string;
  reportDescription?: string;
  overflowActionLabel?: string;
  onOverflowPress?: () => void;
  onReportSubmit?: (reason: string, details?: string) => Promise<void> | void;
  onRefresh?: () => Promise<void> | void;
  onUserPress?: (userId: string) => void;
  hasNextCommentsPage?: boolean;
  isFetchingNextCommentsPage?: boolean;
  onCommentsVisibilityChange?: (visible: boolean) => void;
  onLikersVisibilityChange?: (visible: boolean) => void;
};

export function FeedActionBar({
  currentUserName,
  currentUserPhoto,
  liked = false,
  likeCount = 0,
  likers = [],
  comments = [],
  commentCount: commentCountOverride,
  location,
  showCommentAction = true,
  showShareAction = false,
  showAddToList = false,
  onLikePress,
  onSharePress,
  onFocusPress,
  onFocusLongPress,
  focusActionActive = false,
  onAddToListPress,
  onAddressCopied,
  onCommentSubmit,
  onCommentUpdate,
  onCommentDelete,
  onCommentsLoadMore,
  onCommentReport,
  onCommentLikeToggle,
  showReportAction = false,
  showOverflowAction = false,
  reportTitle = tr.cards.reportContentTitle,
  reportDescription = tr.cards.reportContentDescription,
  overflowActionLabel = tr.profile.actions.menuTitle,
  onOverflowPress,
  onReportSubmit,
  onRefresh,
  onUserPress,
  hasNextCommentsPage = false,
  isFetchingNextCommentsPage = false,
  onCommentsVisibilityChange,
  onLikersVisibilityChange,
}: FeedActionBarProps) {
  const {
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
    itemReportDetails,
    itemReportReason,
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
  } = useFeedActionBarState({
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
  });
  const handledFocusLongPressRef = React.useRef(false);

  useEffect(() => {
    onCommentsVisibilityChange?.(showComments);
  }, [onCommentsVisibilityChange, showComments]);

  useEffect(() => {
    onLikersVisibilityChange?.(showLikers);
  }, [onLikersVisibilityChange, showLikers]);

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
        <InstantPressable
          accessibilityLabel={liked ? tr.cards.unlikeAction : tr.cards.likeAction}
          accessibilityRole="button"
          accessibilityState={{ selected: liked }}
          style={[styles.actionButton, liked ? styles.likeActionActive : null]}
          onPress={() => {
            triggerHaptic('light');
            void handleLikePress();
          }}
          onLongPress={() => setShowLikers(true)}
          delayLongPress={500}
        >
          <Heart size={18} color={liked ? colors.danger : colors.textMuted} fill={liked ? colors.danger : 'transparent'} />
          {likeCount > 0 ? <Text style={[styles.actionCount, liked ? styles.actionCountLiked : null]}>{likeCount}</Text> : null}
        </InstantPressable>

        {showCommentAction ? (
          <InstantPressable
            accessibilityLabel={tr.cards.commentAction}
            accessibilityRole="button"
            accessibilityState={{ expanded: showComments }}
            style={[styles.actionButton, showComments ? styles.primaryActionActive : null]}
            onPressIn={() => {
              if (!showComments) {
                onCommentsVisibilityChange?.(true);
              }
            }}
            onPress={() => setShowComments((value) => !value)}
          >
            <MessageCircle size={18} color={showComments ? colors.primary : colors.textMuted} />
            {commentCount > 0 ? (
              <Text style={[styles.actionCount, showComments ? styles.actionCountPrimary : null]}>
                {commentCount}
              </Text>
            ) : null}
          </InstantPressable>
        ) : null}

        {showShareAction && onSharePress ? (
          <InstantPressable
            accessibilityLabel={tr.cards.share}
            accessibilityRole="button"
            style={styles.actionButton}
            onPress={onSharePress}
          >
            <Share2 size={18} color={colors.textMuted} />
          </InstantPressable>
        ) : null}

        {onFocusPress ? (
          <InstantPressable
            accessibilityLabel={tr.cards.focusMiniMap}
            accessibilityRole="button"
            style={[styles.actionButton, focusActionActive ? styles.primaryActionActive : null]}
            delayLongPress={MINI_MAP_RESET_LONG_PRESS_MS}
            onPressIn={() => {
              handledFocusLongPressRef.current = false;
            }}
            onPress={() => {
              if (handledFocusLongPressRef.current) {
                handledFocusLongPressRef.current = false;
                return;
              }

              onFocusPress();
            }}
            onLongPress={() => {
              handledFocusLongPressRef.current = true;
              onFocusLongPress?.();
            }}
          >
            <Crosshair size={18} color={focusActionActive ? colors.primary : colors.textMuted} />
          </InstantPressable>
        ) : null}

        {showAddToList ? (
          <InstantPressable
            accessibilityLabel={tr.cards.addToListAction}
            accessibilityRole="button"
            style={styles.actionButton}
            onPress={onAddToListPress}
          >
            <ListPlus size={18} color={colors.textMuted} />
          </InstantPressable>
        ) : null}

        {location ? (
          <InstantPressable
            accessibilityLabel={tr.cards.showAddressAction}
            accessibilityRole="button"
            accessibilityState={{ expanded: showAddress }}
            style={[styles.actionButton, showAddress ? styles.successActionActive : null]}
            onPress={() => setShowAddress((value) => !value)}
          >
            <MapPin size={18} color={showAddress ? colors.secondary : colors.textMuted} />
          </InstantPressable>
        ) : null}

        {showOverflowAction && onOverflowPress ? (
          <InstantPressable
            accessibilityLabel={overflowActionLabel}
            accessibilityRole="button"
            style={styles.actionButton}
            onPress={onOverflowPress}
          >
            <Ellipsis size={18} color={colors.textMuted} />
          </InstantPressable>
        ) : null}

        {showReportAction && onReportSubmit ? (
          <InstantPressable
            accessibilityLabel={tr.cards.reportAction}
            accessibilityRole="button"
            style={[styles.actionButton, showReportSheet ? styles.warningActionActive : null]}
            onPress={() => setShowReportSheet(true)}
          >
            <Flag size={18} color={showReportSheet ? colors.warning : colors.textMuted} />
          </InstantPressable>
        ) : null}
      </ScrollView>

      {showComments ? (
        <CommentPanel
          visible={showComments}
          comments={comments}
          commentText={commentText}
          editingCommentId={editingCommentId}
          activeReportCommentId={activeReportCommentId}
          reportReason={reportReason}
          currentUserName={currentUserName}
          currentUserPhoto={currentUserPhoto}
          replyingTo={replyingTo}
          submitting={submitting}
          onClose={() => setShowComments(false)}
          onCommentTextChange={setCommentText}
          onSubmit={() => {
            void handleCommentSubmit();
          }}
          onStartEdit={handleStartEdit}
          onStartReply={handleStartReply}
          onCancelEdit={resetCommentComposer}
          onCancelReply={() => setReplyingTo(null)}
          onDeleteComment={(commentId) => {
            setConfirmDeleteCommentId(commentId);
          }}
          onLoadMoreComments={() => {
            void onCommentsLoadMore?.();
          }}
          onToggleCommentLike={(commentId) => {
            void handleCommentLikeToggle(commentId);
          }}
          onStartReport={handleStartReport}
          onCloseReport={() => {
            setActiveReportCommentId(null);
            setReportDetails('');
            setReportReason('');
          }}
          reportDetails={reportDetails}
          onReportReasonChange={setReportReason}
          onReportDetailsChange={setReportDetails}
          onReportSubmit={(commentId) => {
            void handleCommentReport(commentId);
          }}
          refreshing={commentsRefreshing}
          onRefreshComments={() => {
            void handleRefreshComments();
          }}
          onRefreshLikers={() => {
            void handleRefreshLikers();
          }}
          onUserPress={handleUserPress}
          hasNextPage={hasNextCommentsPage}
          isFetchingNextPage={isFetchingNextCommentsPage}
        />
      ) : null}

      {showAddress && location ? (
        <AddressPanel location={location} onCopied={onAddressCopied} />
      ) : null}

      {showLikers ? (
        <LikersPanel
          likeCount={likeCount}
          likers={likers}
          onClose={() => setShowLikers(false)}
          refreshing={likersRefreshing}
          onRefresh={() => {
            void handleRefreshLikers();
          }}
          onUserPress={handleUserPress}
        />
      ) : null}

      {showReportSheet ? (
        <ReportActionSheet
          visible
          title={reportTitle}
          description={reportDescription}
          reportDetails={itemReportDetails}
          reportReason={itemReportReason}
          onReportDetailsChange={setItemReportDetails}
          onReportReasonChange={setItemReportReason}
          onClose={() => {
            setShowReportSheet(false);
            setItemReportDetails('');
            setItemReportReason('');
          }}
          onSubmit={() => {
            void handleItemReport();
          }}
        />
      ) : null}

      {confirmDeleteCommentId ? (
        <ConfirmActionModal
          visible
          title={tr.cards.deleteCommentTitle}
          description={tr.cards.deleteCommentDescription}
          confirmLabel={tr.common.delete}
          confirmVariant="danger"
          onClose={() => setConfirmDeleteCommentId(null)}
          onConfirm={async () => {
            const targetCommentId = confirmDeleteCommentId;

            if (targetCommentId) {
              await handleDeleteComment(targetCommentId);
            }

            setConfirmDeleteCommentId(null);
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  actionButton: {
    minWidth: 44,
    height: 38,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionCount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  actionCountLiked: {
    color: colors.danger,
  },
  actionCountPrimary: {
    color: colors.primary,
  },
  likeActionActive: {
    backgroundColor: colors.dangerBg,
  },
  primaryActionActive: {
    backgroundColor: colors.primaryBg,
  },
  successActionActive: {
    backgroundColor: colors.successBg,
  },
  warningActionActive: {
    backgroundColor: colors.warningBg,
  },
});
