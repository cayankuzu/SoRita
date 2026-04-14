import { useCallback, useMemo } from 'react';

import type { Place, PlaceComment, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { storage } from '@/mobile/app/data/repositories/supabaseStorage';
import type {
  FeedActionComment,
  FeedActionLiker,
} from '@/mobile/app/features/social/public/types';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { useStorageVersion } from '@/mobile/app/shared/hooks/useStorageVersion';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { createUuid } from '@/shared/utils/id';

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

function mapCommentToFeedAction(
  comment: PlaceComment,
  currentUserId?: string | null,
  ownerId?: string | null,
): FeedActionComment {
  const likeDetailsByUserId = new Map(
    (comment.likeDetails || []).map((detail) => [detail.userId, detail.createdAt]),
  );
  const likers: FeedActionLiker[] = (comment.likedBy || [])
    .map((userId) => storage.findUserById(userId))
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
      mapCommentToFeedAction(reply, currentUserId, ownerId),
    ),
    canEdit: Boolean(currentUserId && comment.userId === currentUserId),
    canDelete: Boolean(currentUserId && (comment.userId === currentUserId || ownerId === currentUserId)),
    canReport: Boolean(currentUserId && comment.userId !== currentUserId),
  };
}

type UsePlaceCardStateParams = {
  owner?: User | null;
  ownerId?: string | null;
  place: Place;
  user: User | null;
};

export function usePlaceCardState({
  owner,
  ownerId,
  place,
  user,
}: UsePlaceCardStateParams) {
  const storageVersion = useStorageVersion();
  const resolvedOwnerId = ownerId || owner?.id || null;

  const isLiked = Boolean(user && (place.likedBy || []).includes(user.id));
  const canReportPlace = Boolean(user && resolvedOwnerId && user.id !== resolvedOwnerId);

  const likers = useMemo<FeedActionLiker[]>(() => {
    const likeDetailsByUserId = new Map(
      (place.likeDetails || []).map((detail) => [detail.userId, detail.createdAt]),
    );

    return (place.likedBy || [])
      .map((userId) => storage.findUserById(userId))
      .filter((item): item is User => Boolean(item))
      .map((item) => ({
        id: item.id,
        name: item.name,
        username: item.username,
        profilePhoto: item.profilePhoto,
        likedAt: likeDetailsByUserId.get(item.id),
      }));
  }, [place.likeDetails, place.likedBy, storageVersion]);

  const comments = useMemo(
    () =>
      (place.comments || []).map((comment) =>
        mapCommentToFeedAction(comment, user?.id, resolvedOwnerId),
      ),
    [place.comments, resolvedOwnerId, storageVersion, user?.id],
  );

  const myLists = useMemo<PlaceList[]>(
    () => (user ? storage.getListsByUserId(user.id) : []),
    [storageVersion, user],
  );

  const handleLikePress = useCallback(async () => {
    if (!user) {
      throw new Error('Begeni icin giris yapmalisin');
    }

    try {
      await storage.toggleLikePlace(place.id, user.id);
    } catch {
      throw new Error('Mekan begenisi guncellenemedi');
    }
  }, [place.id, user]);

  const handleCreateComment = useCallback(
    async (content: string, parentCommentId?: string | null) => {
      if (!user) {
        throw new Error('Yorum icin giris yapmalisin');
      }

      try {
        await storage.createPlaceComment(place.id, user.id, content, parentCommentId);
        showToast(tr.cards.commentSent, 'success');
      } catch {
        throw new Error(tr.cards.commentSendFailed);
      }
    },
    [place.id, user],
  );

  const handleUpdateComment = useCallback(
    async (commentId: string, content: string) => {
      if (!user) {
        throw new Error(tr.cards.commentUpdateFailed);
      }

      try {
        await storage.updatePlaceComment(commentId, user.id, content);
        showToast(tr.cards.commentUpdated, 'success');
      } catch {
        throw new Error(tr.cards.commentUpdateFailed);
      }
    },
    [user],
  );

  const handleDeleteComment = useCallback(async (commentId: string) => {
    try {
      await storage.deletePlaceComment(commentId);
      showToast(tr.cards.commentDeleted, 'success');
    } catch {
      throw new Error(tr.cards.commentDeleteFailed);
    }
  }, []);

  const handleReportComment = useCallback(
    async (commentId: string, reason: string) => {
      if (!user) {
        throw new Error(tr.cards.commentReportFailed);
      }

      try {
        await storage.reportPlaceComment(commentId, user.id, reason);
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
    [user],
  );

  const handleToggleCommentLike = useCallback(
    async (commentId: string) => {
      if (!user) {
        throw new Error(tr.cards.commentLikeFailed);
      }

      try {
        await storage.toggleLikePlaceComment(commentId, user.id);
      } catch (error) {
        throw new Error(getErrorMessage(error, tr.cards.commentLikeFailed));
      }
    },
    [user],
  );

  const handleReportPlace = useCallback(
    async (reason: string) => {
      if (!user) {
        throw new Error('Mekani bildirmek icin giris yapmalisin');
      }

      try {
        await storage.reportPlace(user.id, place.id, reason);
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
    [place.id, user],
  );

  const savePlaceToLists = useCallback(
    async (placeData: Omit<Place, 'id' | 'addedAt'>, targetListIds: string[]) => {
      if (!user) {
        return;
      }

      const selectedListIds = Array.from(new Set(targetListIds));
      const targetLists = selectedListIds
        .map((listId) => storage.getListById(listId))
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

      await storage.updateLists(updatedLists);
      showToast(tr.cards.placeAddedToList, 'success');
    },
    [place.id, place.lat, place.lng, place.name, user],
  );

  const createList = useCallback(
    async (list: PlaceList) => {
      if (!user) {
        return;
      }

      await storage.createList({ ...list, userId: user.id });
    },
    [user],
  );

  return {
    canReportPlace,
    comments,
    createList,
    handleCreateComment,
    handleDeleteComment,
    handleLikePress,
    handleReportComment,
    handleReportPlace,
    handleToggleCommentLike,
    handleUpdateComment,
    isLiked,
    likers,
    myLists,
    resolvedOwnerId,
    savePlaceToLists,
  };
}
