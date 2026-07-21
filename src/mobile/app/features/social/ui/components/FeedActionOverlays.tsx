import React from 'react';

import type { useFeedActionBarState } from '@/mobile/app/features/social/application/useFeedActionBarState';
import {
  AddressPanel,
  CommentPanel,
  LikersPanel,
} from '@/mobile/app/features/social/ui/components/FeedActionPanels';
import type {
  FeedActionComment,
  FeedActionLiker,
  FeedActionLocation,
} from '@/mobile/app/features/social/ui/components/FeedActionTypes';
import { ConfirmActionModal } from '@/mobile/app/shared/components/feedback/ConfirmActionModal';
import { ReportActionSheet } from '@/mobile/app/shared/components/feedback/ReportActionSheet';
import { tr } from '@/mobile/app/shared/i18n/tr';

type FeedActionState = ReturnType<typeof useFeedActionBarState>;

type FeedActionOverlaysProps = {
  comments?: FeedActionComment[];
  currentUserName?: string;
  currentUserPhoto?: string;
  hasNextCommentsPage?: boolean;
  isFetchingNextCommentsPage?: boolean;
  likeCount?: number;
  likers?: FeedActionLiker[];
  location?: FeedActionLocation;
  onAddressCopied?: () => void;
  onCommentsLoadMore?: () => Promise<void> | void;
  reportDescription?: string;
  reportTitle?: string;
  state: FeedActionState;
};

export function FeedActionOverlays({
  comments = [],
  currentUserName,
  currentUserPhoto,
  hasNextCommentsPage = false,
  isFetchingNextCommentsPage = false,
  likeCount = 0,
  likers = [],
  location,
  onAddressCopied,
  onCommentsLoadMore,
  reportDescription = tr.cards.reportContentDescription,
  reportTitle = tr.cards.reportContentTitle,
  state,
}: FeedActionOverlaysProps) {
  return (
    <>
      {state.showComments ? (
        <CommentPanel
          visible
          comments={comments}
          commentText={state.commentText}
          editingCommentId={state.editingCommentId}
          activeReportCommentId={state.activeReportCommentId}
          reportReason={state.reportReason}
          currentUserName={currentUserName}
          currentUserPhoto={currentUserPhoto}
          replyingTo={state.replyingTo}
          submitting={state.submitting}
          onClose={() => state.setShowComments(false)}
          onCommentTextChange={state.setCommentText}
          onSubmit={() => void state.handleCommentSubmit()}
          onStartEdit={state.handleStartEdit}
          onStartReply={state.handleStartReply}
          onCancelEdit={state.resetCommentComposer}
          onCancelReply={() => state.setReplyingTo(null)}
          onDeleteComment={state.setConfirmDeleteCommentId}
          onLoadMoreComments={() => void onCommentsLoadMore?.()}
          onToggleCommentLike={(commentId) => void state.handleCommentLikeToggle(commentId)}
          onStartReport={state.handleStartReport}
          onCloseReport={() => {
            state.setActiveReportCommentId(null);
            state.setReportDetails('');
            state.setReportReason('');
          }}
          reportDetails={state.reportDetails}
          onReportReasonChange={state.setReportReason}
          onReportDetailsChange={state.setReportDetails}
          onReportSubmit={(commentId) => void state.handleCommentReport(commentId)}
          refreshing={state.commentsRefreshing}
          onRefreshComments={() => void state.handleRefreshComments()}
          onRefreshLikers={() => void state.handleRefreshLikers()}
          onUserPress={state.handleUserPress}
          hasNextPage={hasNextCommentsPage}
          isFetchingNextPage={isFetchingNextCommentsPage}
        />
      ) : null}

      {state.showAddress && location ? (
        <AddressPanel location={location} onCopied={onAddressCopied} />
      ) : null}

      {state.showLikers ? (
        <LikersPanel
          likeCount={likeCount}
          likers={likers}
          onClose={() => state.setShowLikers(false)}
          refreshing={state.likersRefreshing}
          onRefresh={() => void state.handleRefreshLikers()}
          onUserPress={state.handleUserPress}
        />
      ) : null}

      {state.showReportSheet ? (
        <ReportActionSheet
          visible
          title={reportTitle}
          description={reportDescription}
          reportDetails={state.itemReportDetails}
          reportReason={state.itemReportReason}
          onReportDetailsChange={state.setItemReportDetails}
          onReportReasonChange={state.setItemReportReason}
          onClose={() => {
            state.setShowReportSheet(false);
            state.setItemReportDetails('');
            state.setItemReportReason('');
          }}
          onSubmit={() => void state.handleItemReport()}
        />
      ) : null}

      {state.confirmDeleteCommentId ? (
        <ConfirmActionModal
          visible
          title={tr.cards.deleteCommentTitle}
          description={tr.cards.deleteCommentDescription}
          confirmLabel={tr.common.delete}
          confirmVariant="danger"
          onClose={() => state.setConfirmDeleteCommentId(null)}
          onConfirm={async () => {
            await state.handleDeleteComment(state.confirmDeleteCommentId!);
            state.setConfirmDeleteCommentId(null);
          }}
        />
      ) : null}
    </>
  );
}
