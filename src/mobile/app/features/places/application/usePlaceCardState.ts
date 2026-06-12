import { useCallback, useMemo } from 'react';

import type { Place, PlaceComment, PlaceList, User } from '@/mobile/app/data/contracts/entities';
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
import { getHiddenUserIdsFor } from '@/mobile/app/data/selectors/visibility';
import { useVisibleDataQuery } from '@/mobile/app/data/hooks/useVisibleDataQuery';
import type {
  FeedActionComment,
  FeedActionLiker,
} from '@/mobile/app/features/social/public/types';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { MAX_SELECTED_LISTS_PER_PLACE_SAVE } from '@/mobile/app/shared/validation/contentLimits';
import { createUuid } from '@/shared/utils/id';

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

function mapCommentToFeedAction(
  comment: PlaceComment,
  resolveUserById: (userId: string) => User | undefined,
  currentUserId?: string | null,
  ownerId?: string | null,
): FeedActionComment {
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
    likes: comment.likes || 0,
    liked: Boolean(currentUserId && (comment.likedBy || []).includes(currentUserId)),
    likers,
    replies: (comment.replies || []).map((reply) =>
      mapCommentToFeedAction(reply, resolveUserById, currentUserId, ownerId),
    ),
    canEdit: Boolean(currentUserId && comment.userId === currentUserId),
    canDelete: Boolean(currentUserId && (comment.userId === currentUserId || ownerId === currentUserId)),
    canReport: Boolean(currentUserId && comment.userId !== currentUserId),
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

type UsePlaceCardStateParams = {
  commentsEnabled?: boolean;
  owner?: User | null;
  ownerId?: string | null;
  place: Place;
  user: User | null;
};

export function usePlaceCardState({
  commentsEnabled = false,
  owner,
  ownerId,
  place,
  user,
}: UsePlaceCardStateParams) {
  const visibleDataQuery = useVisibleDataQuery(user?.id, {
    listPageSize: 100,
    ownerId: user?.id || undefined,
  });
  const { mutateAsync: createListAsync } = useCreateListMutation();
  const { mutateAsync: updateListsAsync } = useUpdateListsMutation();
  const { mutateAsync: toggleLikePlaceAsync } = useToggleLikePlaceMutation();
  const { mutateAsync: createPlaceCommentAsync } = useCreatePlaceCommentMutation();
  const { mutateAsync: updatePlaceCommentAsync } = useUpdatePlaceCommentMutation();
  const { mutateAsync: deletePlaceCommentAsync } = useDeletePlaceCommentMutation();
  const { mutateAsync: toggleLikePlaceCommentAsync } = useToggleLikePlaceCommentMutation();
  const { mutateAsync: reportPlaceAsync } = useReportPlaceMutation();
  const { mutateAsync: reportPlaceCommentAsync } = useReportPlaceCommentMutation();
  const visibleUsers = visibleDataQuery.data?.users || [];
  const allUsers = visibleDataQuery.data?.allUsers || [];
  const blockRows = visibleDataQuery.data?.blockRows || [];
  const visibleLists = visibleDataQuery.data?.lists || [];
  const resolvedOwnerId = ownerId || owner?.id || null;
  const usersById = useMemo(
    () => new Map(visibleUsers.map((item) => [item.id, item])),
    [visibleUsers],
  );
  const allUsersById = useMemo(
    () => new Map(allUsers.map((item) => [item.id, item])),
    [allUsers],
  );
  const hiddenUserIds = useMemo(
    () => getHiddenUserIdsFor(blockRows, user?.id),
    [blockRows, user?.id],
  );
  const myLists = useMemo<PlaceList[]>(
    () => (user ? visibleLists.filter((list) => list.userId === user.id) : []),
    [user, visibleLists],
  );
  const myListsById = useMemo(
    () => new Map(myLists.map((list) => [list.id, list])),
    [myLists],
  );

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
      throw new Error('Begeni icin giris yapmalisin');
    }

    try {
      await toggleLikePlaceAsync({ placeId: place.id, userId: user.id });
    } catch {
      throw new Error('Mekan begenisi guncellenemedi');
    }
  }, [place.id, toggleLikePlaceAsync, user]);

  const handleCreateComment = useCallback(
    async (content: string, parentCommentId?: string | null) => {
      if (!user) {
        throw new Error('Yorum icin giris yapmalisin');
      }

      try {
        await createPlaceCommentAsync({
          placeId: place.id,
          userId: user.id,
          content,
          parentCommentId,
        });
        showToast(tr.cards.commentSent, 'success');
      } catch {
        throw new Error(tr.cards.commentSendFailed);
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
      } catch {
        throw new Error(tr.cards.commentUpdateFailed);
      }
    },
    [updatePlaceCommentAsync, user],
  );

  const handleDeleteComment = useCallback(async (commentId: string) => {
    try {
      await deletePlaceCommentAsync(commentId);
      showToast(tr.cards.commentDeleted, 'success');
    } catch {
      throw new Error(tr.cards.commentDeleteFailed);
    }
  }, [deletePlaceCommentAsync]);

  const handleReportComment = useCallback(
    async (commentId: string, reason: string) => {
      if (!user) {
        throw new Error(tr.cards.commentReportFailed);
      }

      try {
        await reportPlaceCommentAsync({ commentId, reporterUserId: user.id, reason });
        showToast(tr.cards.commentReported, 'success');
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === '23505'
        ) {
          throw new Error(tr.cards.duplicateCommentReport);
        }

        throw new Error(tr.cards.commentReportFailed);
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
        throw new Error(getErrorMessage(error, tr.cards.commentLikeFailed));
      }
    },
    [toggleLikePlaceCommentAsync, user],
  );

  const handleReportPlace = useCallback(
    async (reason: string) => {
      if (!user) {
        throw new Error('Mekani bildirmek icin giris yapmalisin');
      }

      try {
        await reportPlaceAsync({ reporterUserId: user.id, placeId: place.id, reason });
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === '23505'
        ) {
          throw new Error('Bu mekan kartini zaten bildirdin');
        }

        throw new Error(getErrorMessage(error, 'Mekan karti bildirilemedi'));
      }
    },
    [place.id, reportPlaceAsync, user],
  );

  const savePlaceToLists = useCallback(
    async (placeData: Omit<Place, 'id' | 'addedAt'>, targetListIds: string[]) => {
      if (!user) {
        return;
      }

      const selectedListIds = Array.from(new Set(targetListIds));

      if (selectedListIds.length > MAX_SELECTED_LISTS_PER_PLACE_SAVE) {
        showToast(
          `Bir mekani ayni anda en fazla ${MAX_SELECTED_LISTS_PER_PLACE_SAVE} listeye ekleyebilirsin`,
          'error',
        );
        return;
      }
      const targetLists = selectedListIds
        .map((listId) => myListsById.get(listId))
        .filter((list): list is PlaceList => Boolean(list));

      if (targetLists.length !== selectedListIds.length) {
        showToast('Liste bulunamadi', 'error');
        return;
      }

      const duplicateTarget = targetLists.find((targetList) =>
        targetList.places.some(
          (item) =>
            item.id === place.id ||
            (item.name === place.name && item.lat === place.lat && item.lng === place.lng),
        ),
      );

      if (duplicateTarget) {
        showToast(tr.cards.alreadyInList, 'error');
        return;
      }

      const nextUpdatedAt = new Date().toISOString();
      const updatedLists = targetLists.map((targetList) => {
        const newPlace: Place = {
          ...placeData,
          id: createUuid(),
          addedAt: new Date().toISOString(),
          updatedAt: nextUpdatedAt,
          addedBy: { userId: user.id, userName: user.name },
        };

        return {
          ...targetList,
          places: [...targetList.places, newPlace],
          updatedAt: nextUpdatedAt,
        };
      });

      await updateListsAsync(updatedLists);
      showToast(tr.cards.placeAddedToList, 'success');
    },
    [myListsById, place.id, place.lat, place.lng, place.name, updateListsAsync, user],
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
  };
}
