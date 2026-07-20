import { useCallback, useMemo } from 'react';

import type { Place, PlaceComment, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { useCreatePlaceQuoteNotificationMutation } from '@/mobile/app/data/hooks/useNotificationMutations';
import {
  useCreateListMutation,
  useUpdateListsMutation,
} from '@/mobile/app/data/hooks/useListMutations';
import {
  useCreatePlaceCommentMutation,
  useDeletePlaceCommentMutation,
  useReportPlaceCommentMutation,
  useReportPlaceMutation,
  useToggleLikePlaceCommentMutation,
  useToggleLikePlaceMutation,
  useUpdatePlaceCommentMutation,
} from '@/mobile/app/data/hooks/usePlaceMutations';
import { usePlaceCommentsQuery } from '@/mobile/app/data/hooks/usePlaceCommentsQuery';
import { mapPlaceComments } from '@/mobile/app/data/mappers/visibleDataMappers';
import {
  canViewPrivateUserContent,
  usePlaceCardContext,
} from '@/mobile/app/features/places/application/usePlaceCardContext';
import type {
  FeedActionComment,
  FeedActionLiker,
} from '@/mobile/app/features/social/public/types';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  MAX_SELECTED_LISTS_PER_PLACE_SAVE,
  normalizeOptionalMultilineText,
} from '@/mobile/app/shared/validation/contentLimits';
import { isCommentEditWindowExpired } from '@/mobile/app/shared/utils/dateTime';
import { createUuid } from '@/shared/utils/id';

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

function createErrorWithCause(message: string, cause: unknown) {
  const nextError = new Error(message);
  (nextError as Error & { cause?: unknown }).cause = cause;
  return nextError;
}

function getCommentPermissions(
  comment: PlaceComment,
  currentUserId?: string | null,
  ownerId?: string | null,
) {
  const isOwnComment = Boolean(currentUserId && comment.userId === currentUserId);
  const isPending = Boolean(comment.isPending);

  return {
    canDelete: Boolean(currentUserId && !isPending && (isOwnComment || ownerId === currentUserId)),
    canEdit: isOwnComment && !isPending,
    canReport: Boolean(currentUserId && !isOwnComment),
    editWindowExpired: Boolean(
      isOwnComment && !isPending && isCommentEditWindowExpired(comment.createdAt),
    ),
  };
}

type TargetListResolution =
  | { ok: true; lists: PlaceList[] }
  | { ok: false; reason: 'duplicate' | 'not-found' | 'selection-limit' };

function resolveTargetLists(
  targetListIds: string[],
  listsById: Map<string, PlaceList>,
  place: Pick<Place, 'id' | 'lat' | 'lng' | 'name'>,
): TargetListResolution {
  const selectedListIds = Array.from(new Set(targetListIds));

  if (selectedListIds.length > MAX_SELECTED_LISTS_PER_PLACE_SAVE) {
    return { ok: false, reason: 'selection-limit' };
  }

  const lists = selectedListIds
    .map((listId) => listsById.get(listId))
    .filter((list): list is PlaceList => Boolean(list));

  if (lists.length !== selectedListIds.length) {
    return { ok: false, reason: 'not-found' };
  }

  const hasDuplicate = lists.some((list) =>
    list.places.some(
      (item) =>
        item.id === place.id ||
        (item.name === place.name && item.lat === place.lat && item.lng === place.lng),
    ),
  );

  return hasDuplicate
    ? { ok: false, reason: 'duplicate' }
    : { ok: true, lists };
}

function showTargetListResolutionError(reason: Exclude<TargetListResolution, { ok: true }>['reason']) {
  const message = reason === 'selection-limit'
    ? tr.placeEditor.notices.selectionLimit(MAX_SELECTED_LISTS_PER_PLACE_SAVE)
    : reason === 'not-found'
      ? tr.cards.listNotFound
      : tr.cards.alreadyInList;
  showToast(message, 'error');
}

function getPlaceQuoteNotificationTarget(
  recipientUserId: string | null,
  actorUserId: string,
  hiddenUserIds: Set<string>,
  list: PlaceList | undefined,
  createdPlace: Place | undefined,
) {
  if (
    !recipientUserId ||
    recipientUserId === actorUserId ||
    hiddenUserIds.has(recipientUserId) ||
    !list ||
    !createdPlace
  ) {
    return null;
  }

  return { createdPlace, list, recipientUserId };
}

function mapCommentToFeedAction(
  comment: PlaceComment,
  resolveUserById: (userId: string) => User | undefined,
  currentUserId?: string | null,
  ownerId?: string | null,
): FeedActionComment {
  const permissions = getCommentPermissions(comment, currentUserId, ownerId);
  const likeDetailsByUserId = new Map(
    (comment.likeDetails || []).map((detail) => [detail.userId, detail.createdAt]),
  );
  const likers: FeedActionLiker[] = (comment.likedBy || [])
    .map(resolveUserById)
    .filter((item): item is User => Boolean(item))
    .map((item) => ({
      id: item.id,
      name: item.name,
      username: item.username,
      profilePhoto: item.profilePhoto,
      likedAt: likeDetailsByUserId.get(item.id),
    }));

  return {
    id: comment.id,
    userId: comment.userId,
    userName: comment.author?.name || 'SoRita',
    username: comment.author?.username,
    userProfilePhoto: comment.author?.profilePhoto,
    content: comment.content,
    parentCommentId: comment.parentCommentId,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    pendingSync: Boolean(comment.isPending),
    likes: comment.likes || 0,
    liked: Boolean(currentUserId && (comment.likedBy || []).includes(currentUserId)),
    likers,
    replies: (comment.replies || []).map((reply) =>
      mapCommentToFeedAction(reply, resolveUserById, currentUserId, ownerId),
    ),
    ...permissions,
  };
}

function sanitizeCommentTree(comment: PlaceComment, hiddenUserIds: Set<string>): PlaceComment | null {
  if (hiddenUserIds.has(comment.userId)) {
    return null;
  }

  const likedBy = (comment.likedBy || []).filter((userId) => !hiddenUserIds.has(userId));
  const likeDetails = (comment.likeDetails || []).filter((detail) => !hiddenUserIds.has(detail.userId));
  const replies = (comment.replies || [])
    .map((reply) => sanitizeCommentTree(reply, hiddenUserIds))
    .filter((reply): reply is PlaceComment => Boolean(reply));

  return {
    ...comment,
    likes: likedBy.length,
    likedBy: likedBy.length ? likedBy : undefined,
    likeDetails: likeDetails.length ? likeDetails : undefined,
    replies: replies.length ? replies : undefined,
  };
}

// Narrow pure-function surface for exhaustive privacy and comment-tree contract tests.
export const placeCardInternals = {
  canViewPrivateUserContent,
  createErrorWithCause,
  getErrorMessage,
  mapCommentToFeedAction,
  sanitizeCommentTree,
};

type UsePlaceCardStateParams = {
  commentsEnabled?: boolean;
  currentListId?: string;
  likersEnabled?: boolean;
  listsEnabled?: boolean;
  owner?: User | null;
  ownerId?: string | null;
  place: Place;
  sourceAttributionEnabled?: boolean;
  user: User | null;
};

export function usePlaceCardState({
  commentsEnabled = false,
  currentListId,
  likersEnabled = false,
  listsEnabled = true,
  owner,
  ownerId,
  place,
  sourceAttributionEnabled = false,
  user,
}: UsePlaceCardStateParams) {
  const { mutateAsync: createListAsync } = useCreateListMutation();
  const { mutateAsync: createPlaceQuoteNotificationAsync } = useCreatePlaceQuoteNotificationMutation();
  const { mutateAsync: updateListsAsync } = useUpdateListsMutation();
  const { mutateAsync: toggleLikePlaceAsync } = useToggleLikePlaceMutation();
  const { mutateAsync: createPlaceCommentAsync } = useCreatePlaceCommentMutation();
  const { mutateAsync: updatePlaceCommentAsync } = useUpdatePlaceCommentMutation();
  const { mutateAsync: deletePlaceCommentAsync } = useDeletePlaceCommentMutation();
  const { mutateAsync: toggleLikePlaceCommentAsync } = useToggleLikePlaceCommentMutation();
  const { mutateAsync: reportPlaceAsync } = useReportPlaceMutation();
  const { mutateAsync: reportPlaceCommentAsync } = useReportPlaceCommentMutation();
  const {
    allUsersById,
    canOpenSourcePlaceCard,
    hiddenUserIds,
    myLists,
    myListsById,
    resolvedOwnerId,
    sourceAttributionList,
    sourceAttributionOwner,
    sourceAttributionPlace,
    sourceAttributionUser,
    sourceAttributionUserId,
    usersById,
  } = usePlaceCardContext({
    commentsEnabled,
    likersEnabled,
    listsEnabled,
    owner,
    ownerId,
    place,
    sourceAttributionEnabled,
    user,
  });

  const isLiked = Boolean(user && (place.likedBy || []).includes(user.id));
  const canReportPlace = Boolean(user && resolvedOwnerId && user.id !== resolvedOwnerId);

  const likers = useMemo<FeedActionLiker[]>(() => {
    const likeDetailsByUserId = new Map(
      (place.likeDetails || []).map((detail) => [detail.userId, detail.createdAt]),
    );

    return (place.likedBy || [])
      .map((userId) => usersById.get(userId))
      .filter((item): item is User => Boolean(item))
      .map((item) => ({
        id: item.id,
        name: item.name,
        username: item.username,
        profilePhoto: item.profilePhoto,
        likedAt: likeDetailsByUserId.get(item.id),
      }));
  }, [place.likeDetails, place.likedBy, usersById]);

  const commentsQuery = usePlaceCommentsQuery(place.id, user?.id, commentsEnabled);

  const comments = useMemo(
    () =>
      (() => {
        const rawCommentRecords = commentsQuery.data
          ? commentsQuery.data.pages.flatMap((page) => page)
          : null;
        const mappedComments = rawCommentRecords && rawCommentRecords.length > 0
          ? mapPlaceComments(rawCommentRecords, allUsersById)
              .map((comment) => sanitizeCommentTree(comment, hiddenUserIds))
              .filter((comment): comment is PlaceComment => Boolean(comment))
          : place.comments || [];

        return mappedComments.map((comment) =>
        mapCommentToFeedAction(comment, (userId) => usersById.get(userId), user?.id, resolvedOwnerId),
        );
      })(),
    [allUsersById, commentsQuery.data, hiddenUserIds, place.comments, resolvedOwnerId, user?.id, usersById],
  );

  const handleLikePress = useCallback(async () => {
    if (!user) {
      throw new Error(tr.cards.loginRequiredForLike);
    }

    try {
      await toggleLikePlaceAsync({ placeId: place.id, userId: user.id });
    } catch {
      throw new Error(tr.cards.placeLikeUpdateFailed);
    }
  }, [place.id, toggleLikePlaceAsync, user]);

  const handleCreateComment = useCallback(
    async (content: string, parentCommentId?: string | null) => {
      if (!user) {
        throw new Error(tr.cards.loginRequiredForComment);
      }

      try {
        await createPlaceCommentAsync({
          commentId: createUuid(),
          placeId: place.id,
          userId: user.id,
          content,
          parentCommentId,
        });
        showToast(tr.cards.commentSent, 'success');
    } catch (error) {
      throw createErrorWithCause(getErrorMessage(error, tr.cards.commentSendFailed), error);
      }
    },
    [createPlaceCommentAsync, place.id, user],
  );

  const handleUpdateComment = useCallback(
    async (commentId: string, content: string) => {
      if (!user) {
        throw new Error(tr.cards.commentUpdateFailed);
      }

      try {
        await updatePlaceCommentAsync({ commentId, userId: user.id, content });
        showToast(tr.cards.commentUpdated, 'success');
    } catch (error) {
      throw createErrorWithCause(getErrorMessage(error, tr.cards.commentUpdateFailed), error);
      }
    },
    [updatePlaceCommentAsync, user],
  );

  const handleDeleteComment = useCallback(async (commentId: string) => {
    try {
      await deletePlaceCommentAsync(commentId);
      showToast(tr.cards.commentDeleted, 'success');
    } catch (error) {
      throw createErrorWithCause(getErrorMessage(error, tr.cards.commentDeleteFailed), error);
    }
  }, [deletePlaceCommentAsync]);

  const handleReportComment = useCallback(
    async (commentId: string, reason: string, details?: string) => {
      if (!user) {
        throw new Error(tr.cards.commentReportFailed);
      }

      try {
        await reportPlaceCommentAsync({ commentId, reporterUserId: user.id, reason, details });
        showToast(tr.cards.commentReported, 'success');
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          (error.code === 'duplicate_report' || error.code === '23505')
        ) {
          throw createErrorWithCause(tr.cards.duplicateCommentReport, error);
        }

        throw createErrorWithCause(getErrorMessage(error, tr.cards.commentReportFailed), error);
      }
    },
    [reportPlaceCommentAsync, user],
  );

  const handleToggleCommentLike = useCallback(
    async (commentId: string) => {
      if (!user) {
        throw new Error(tr.cards.commentLikeFailed);
      }

      try {
        await toggleLikePlaceCommentAsync({ commentId, userId: user.id });
    } catch (error) {
        throw createErrorWithCause(getErrorMessage(error, tr.cards.commentLikeFailed), error);
      }
    },
    [toggleLikePlaceCommentAsync, user],
  );

  const handleReportPlace = useCallback(
    async (reason: string, details?: string) => {
      if (!user) {
        throw new Error(tr.cards.loginRequiredForReport);
      }

      try {
        await reportPlaceAsync({ reporterUserId: user.id, placeId: place.id, reason, details });
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          (error.code === 'duplicate_report' || error.code === '23505')
        ) {
          throw createErrorWithCause(tr.cards.placeAlreadyReported, error);
        }

        throw createErrorWithCause(getErrorMessage(error, tr.cards.placeReportFailed), error);
      }
    },
    [place.id, reportPlaceAsync, user],
  );

  const savePlaceToLists = useCallback(
    async (placeData: Omit<Place, 'id' | 'addedAt'>, targetListIds: string[]) => {
      if (!user) {
        return false;
      }

      const targetListResolution = resolveTargetLists(targetListIds, myListsById, {
        id: place.id,
        lat: place.lat,
        lng: place.lng,
        name: place.name,
      });

      if (!targetListResolution.ok) {
        showTargetListResolutionError(targetListResolution.reason);
        return false;
      }

      const normalizedPlaceData: Omit<Place, 'id' | 'addedAt'> = {
        ...placeData,
        address: placeData.address?.trim() || undefined,
        notes: normalizeOptionalMultilineText(placeData.notes),
        title: normalizeOptionalMultilineText(placeData.title),
      };
      const nextUpdatedAt = new Date().toISOString();
      const updatedLists = targetListResolution.lists.map((targetList) => {
        const newPlace: Place = {
          ...normalizedPlaceData,
          id: createUuid(),
          addedAt: new Date().toISOString(),
          updatedAt: nextUpdatedAt,
          addedBy: { userId: user.id, userName: user.name },
          sourceAttribution: {
            listId: currentListId,
            placeId: place.id,
            placeName: place.name,
            userAvatar: owner?.profilePhoto || place.addedBy?.userAvatar,
            userId: resolvedOwnerId || place.addedBy?.userId,
            userName: owner?.name || place.addedBy?.userName || 'SoRita',
          },
        };

        return {
          ...targetList,
          places: [...targetList.places, newPlace],
          updatedAt: nextUpdatedAt,
        };
      });

      await updateListsAsync(updatedLists);

      const firstUpdatedList = updatedLists[0];
      const firstCreatedPlace = firstUpdatedList?.places[firstUpdatedList.places.length - 1];
      const quoteRecipientUserId =
        place.sourceAttribution?.userId || resolvedOwnerId || place.addedBy?.userId || null;
      const quotedPlaceName = place.sourceAttribution?.placeName || place.name;
      const notificationTarget = getPlaceQuoteNotificationTarget(
        quoteRecipientUserId,
        user.id,
        hiddenUserIds,
        firstUpdatedList,
        firstCreatedPlace,
      );

      if (notificationTarget) {
        try {
          await createPlaceQuoteNotificationAsync({
            actorUserId: user.id,
            listId: notificationTarget.list.id,
            message: `"${quotedPlaceName}" mekânını kendi listesine alıntıladı`,
            placeId: notificationTarget.createdPlace.id,
            recipientUserId: notificationTarget.recipientUserId,
          });
        } catch (error) {
          logger.warn('notifications', 'Place quote notification could not be created.', error);
        }
      }

      showToast(tr.cards.placeAddedToList, 'success');
      return true;
    },
    [
      createPlaceQuoteNotificationAsync,
      currentListId,
      hiddenUserIds,
      myListsById,
      owner?.name,
      owner?.profilePhoto,
      place.addedBy?.userAvatar,
      place.addedBy?.userId,
      place.addedBy?.userName,
      place.id,
      place.lat,
      place.lng,
      place.name,
      place.sourceAttribution?.placeName,
      place.sourceAttribution?.userId,
      resolvedOwnerId,
      updateListsAsync,
      user,
    ],
  );

  const createList = useCallback(
    async (list: PlaceList) => {
      if (!user) {
        return;
      }

      await createListAsync({ ...list, userId: user.id });
    },
    [createListAsync, user],
  );

  return {
    canReportPlace,
    comments,
    createList,
    fetchNextCommentsPage: commentsQuery.fetchNextPage,
    handleCreateComment,
    handleDeleteComment,
    handleLikePress,
    handleReportComment,
    handleReportPlace,
    handleToggleCommentLike,
    handleUpdateComment,
    hasNextCommentsPage: commentsQuery.hasNextPage,
    isFetchingNextCommentsPage: commentsQuery.isFetchingNextPage,
    isLiked,
    likers,
    myLists,
    resolvedOwnerId,
    savePlaceToLists,
    canOpenSourcePlaceCard,
    sourceAttributionList,
    sourceAttributionOwner,
    sourceAttributionPlace,
    sourceAttributionUser,
    sourceAttributionUserId,
  };
}
