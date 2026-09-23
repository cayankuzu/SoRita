import React, { useEffect } from 'react';
import { Crosshair, Flag, ListPlus, MapPin } from 'lucide-react-native';

import { useFeedActionBarState } from '@/mobile/app/features/social/application/useFeedActionBarState';
import { FeedActionButtons } from '@/mobile/app/features/social/ui/components/FeedActionButtons';
import {
  DeferredActionMenuSheet,
  type DeferredActionMenuSheetProps,
} from '@/mobile/app/shared/components/feedback/DeferredActionMenuSheet';
import type {
  FeedActionComment,
  FeedActionLiker,
  FeedActionLocation,
} from '@/mobile/app/features/social/ui/components/FeedActionTypes';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { iconSize } from '@/mobile/app/shared/theme/tokens';

export type FeedActionBarProps = {
  comments?: FeedActionComment[];
  commentsErrorMessage?: string | null;
  commentsInitialLoading?: boolean;
  commentCount?: number;
  currentUserName?: string;
  currentUserPhoto?: string;
  focusActionActive?: boolean;
  hasNextCommentsPage?: boolean;
  isFetchingNextCommentsPage?: boolean;
  liked?: boolean;
  likeCount?: number;
  likers?: FeedActionLiker[];
  location?: FeedActionLocation;
  onAddressCopied?: () => void;
  onAddToListPress?: () => void;
  onCommentsRefresh?: () => Promise<void> | void;
  onCommentsLoadMore?: () => Promise<void> | void;
  onCommentsVisibilityChange?: (visible: boolean) => void;
  onCommentDelete?: (commentId: string) => Promise<void> | void;
  onCommentLikeToggle?: (commentId: string) => Promise<void> | void;
  onCommentReport?: (commentId: string, reason: string, details?: string) => Promise<void> | void;
  onCommentSubmit?: (content: string, parentCommentId?: string | null) => Promise<void> | void;
  onCommentUpdate?: (commentId: string, content: string) => Promise<void> | void;
  onFocusLongPress?: () => void;
  onFocusPress?: () => void;
  onLikePress?: () => Promise<void> | void;
  onLikersVisibilityChange?: (visible: boolean) => void;
  onRefresh?: () => Promise<void> | void;
  onReportSubmit?: (reason: string, details?: string) => Promise<void> | void;
  onSharePress?: () => void;
  onUserPress?: (userId: string) => void;
  reportDescription?: string;
  reportTitle?: string;
  showAddToList?: boolean;
  showCommentAction?: boolean;
  showReportAction?: boolean;
  // The card's own actions (edit, delete, report). They join this menu as rows;
  // they used to sit behind a row that opened a second sheet on top of it.
  contentActions?: Array<DeferredActionMenuSheetProps['items'][number]>;
  showShareAction?: boolean;
};

type FeedActionOverlaysProps = React.ComponentProps<
  typeof import('@/mobile/app/features/social/ui/components/FeedActionOverlays')['FeedActionOverlays']
>;

const EMPTY_COMMENTS: FeedActionComment[] = [];
const EMPTY_LIKERS: FeedActionLiker[] = [];

function DeferredFeedActionOverlays(props: FeedActionOverlaysProps) {
  const { FeedActionOverlays } = require('@/mobile/app/features/social/ui/components/FeedActionOverlays') as
    typeof import('@/mobile/app/features/social/ui/components/FeedActionOverlays');
  return <FeedActionOverlays {...props} />;
}

export function FeedActionBar(props: FeedActionBarProps) {
  const {
    onCommentsVisibilityChange,
    onLikersVisibilityChange,
  } = props;
  const comments = props.comments ?? EMPTY_COMMENTS;
  const likeCount = props.likeCount ?? 0;
  const likers = props.likers ?? EMPTY_LIKERS;
  const [showSecondaryActions, setShowSecondaryActions] = React.useState(false);
  const state = useFeedActionBarState({
    comments,
    commentCountOverride: props.commentCount,
    onCommentDelete: props.onCommentDelete,
    onCommentLikeToggle: props.onCommentLikeToggle,
    onCommentReport: props.onCommentReport,
    onCommentSubmit: props.onCommentSubmit,
    onCommentUpdate: props.onCommentUpdate,
    onLikePress: props.onLikePress,
    onCommentsRefresh: props.onCommentsRefresh,
    onRefresh: props.onRefresh,
    onReportSubmit: props.onReportSubmit,
    onUserPress: props.onUserPress,
  });

  useEffect(() => {
    onCommentsVisibilityChange?.(state.showComments);
  }, [onCommentsVisibilityChange, state.showComments]);

  useEffect(() => {
    onLikersVisibilityChange?.(state.showLikers);
  }, [onLikersVisibilityChange, state.showLikers]);

  const hasVisibleOverlay = Boolean(
    state.showComments ||
    state.showAddress ||
    state.showLikers ||
    state.showReportSheet ||
    state.confirmDeleteCommentId,
  );
  const closeSecondaryActions = () => setShowSecondaryActions(false);
  const secondaryActions: Array<DeferredActionMenuSheetProps['items'][number]> = [];

  if (props.onFocusPress) {
    secondaryActions.push({
      key: 'focus-map',
      label: props.focusActionActive ? tr.cards.hideMiniMap : tr.cards.focusMiniMap,
      renderIcon: (color) => <Crosshair color={color} size={iconSize.sm} />,
      onPress: () => {
        closeSecondaryActions();
        if (props.focusActionActive) {
          props.onFocusLongPress?.();
          return;
        }
        props.onFocusPress?.();
      },
    });
  }

  if (props.showAddToList && props.onAddToListPress) {
    secondaryActions.push({
      key: 'add-to-list',
      label: tr.cards.addToListAction,
      renderIcon: (color) => <ListPlus color={color} size={iconSize.sm} />,
      onPress: () => {
        closeSecondaryActions();
        props.onAddToListPress?.();
      },
    });
  }

  if (props.location) {
    secondaryActions.push({
      key: 'address',
      label: tr.cards.showAddressAction,
      renderIcon: (color) => <MapPin color={color} size={iconSize.sm} />,
      onPress: () => {
        closeSecondaryActions();
        state.setShowAddress((visible) => !visible);
      },
    });
  }

  for (const action of props.contentActions ?? []) {
    secondaryActions.push({
      ...action,
      onPress: () => {
        closeSecondaryActions();
        action.onPress();
      },
    });
  }

  if (props.showReportAction && props.onReportSubmit) {
    secondaryActions.push({
      key: 'report',
      label: tr.cards.reportAction,
      tone: 'danger',
      renderIcon: (color) => <Flag color={color} size={iconSize.sm} />,
      onPress: () => {
        closeSecondaryActions();
        state.setShowReportSheet(true);
      },
    });
  }

  return (
    <>
      <FeedActionButtons
        commentCount={state.commentCount}
        likeCount={likeCount}
        liked={props.liked ?? false}
        onCommentPress={() => state.setShowComments((visible) => !visible)}
        onCommentsIntent={() => {
          if (!state.showComments) {
            onCommentsVisibilityChange?.(true);
          }
        }}
        onLikePress={() => state.handleLikePress()}
        onLikersPress={() => state.setShowLikers(true)}
        onOverflowPress={() => setShowSecondaryActions(true)}
        onSharePress={props.onSharePress}
        overflowActionLabel={tr.common.contentActionsTitle}
        showCommentAction={props.showCommentAction ?? true}
        showComments={state.showComments}
        showOverflowAction={secondaryActions.length > 0}
        showShareAction={Boolean(props.showShareAction && props.onSharePress)}
      />

      {showSecondaryActions && secondaryActions.length > 0 ? (
        <DeferredActionMenuSheet
          visible
          title={tr.common.contentActionsTitle}
          items={secondaryActions}
          onClose={closeSecondaryActions}
        />
      ) : null}

      {hasVisibleOverlay ? (
        <DeferredFeedActionOverlays
          comments={comments}
          commentsErrorMessage={props.commentsErrorMessage}
          commentsInitialLoading={props.commentsInitialLoading}
          currentUserName={props.currentUserName}
          currentUserPhoto={props.currentUserPhoto}
          hasNextCommentsPage={props.hasNextCommentsPage}
          isFetchingNextCommentsPage={props.isFetchingNextCommentsPage}
          likeCount={likeCount}
          likers={likers}
          location={props.location}
          onAddressCopied={props.onAddressCopied}
          onCommentsLoadMore={props.onCommentsLoadMore}
          reportDescription={props.reportDescription}
          reportTitle={props.reportTitle}
          state={state}
        />
      ) : null}
    </>
  );
}
