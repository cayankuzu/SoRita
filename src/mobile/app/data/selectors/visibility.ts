import type { Place, PlaceComment, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import type { UserBlockRow } from '@/mobile/app/platform/supabase/databaseTypes';

export function getHiddenUserIdsFor(blockRows: UserBlockRow[], viewerId?: string | null) {
  const hiddenIds = new Set<string>();

  if (!viewerId) {
    return hiddenIds;
  }

  for (const row of blockRows) {
    if (row.blocker_user_id === viewerId) {
      hiddenIds.add(row.blocked_user_id);
    }

    if (row.blocked_user_id === viewerId) {
      hiddenIds.add(row.blocker_user_id);
    }
  }

  hiddenIds.delete(viewerId);
  return hiddenIds;
}

export function getBlockStateForUsers(
  blockRows: UserBlockRow[],
  currentUserId: string,
  targetUserId: string,
) {
  return {
    blockedByCurrent: blockRows.some(
      (row) => row.blocker_user_id === currentUserId && row.blocked_user_id === targetUserId,
    ),
    blockedByTarget: blockRows.some(
      (row) => row.blocker_user_id === targetUserId && row.blocked_user_id === currentUserId,
    ),
  };
}

function sanitizeCommentForViewer(comment: PlaceComment, hiddenUserIds: Set<string>): PlaceComment | null {
  if (hiddenUserIds.has(comment.userId)) {
    return null;
  }

  const likedBy = (comment.likedBy || []).filter((userId) => !hiddenUserIds.has(userId));
  const likeDetails = (comment.likeDetails || []).filter(
    (detail) => !hiddenUserIds.has(detail.userId),
  );
  const replies = (comment.replies || [])
    .map((reply) => sanitizeCommentForViewer(reply, hiddenUserIds))
    .filter((reply): reply is PlaceComment => Boolean(reply));

  return {
    ...comment,
    likes: likedBy.length,
    likedBy: likedBy.length ? likedBy : undefined,
    likeDetails: likeDetails.length ? likeDetails : undefined,
    replies: replies.length ? replies : undefined,
  };
}

function sanitizePlaceForViewer(place: Place, hiddenUserIds: Set<string>): Place | null {
  if (place.addedBy?.userId && hiddenUserIds.has(place.addedBy.userId)) {
    return null;
  }

  const likedBy = (place.likedBy || []).filter((userId) => !hiddenUserIds.has(userId));
  const likeDetails = (place.likeDetails || []).filter(
    (detail) => !hiddenUserIds.has(detail.userId),
  );
  const comments = (place.comments || [])
    .map((comment) => sanitizeCommentForViewer(comment, hiddenUserIds))
    .filter((comment): comment is PlaceComment => Boolean(comment));

  return {
    ...place,
    likes: likedBy.length,
    likedBy: likedBy.length ? likedBy : undefined,
    likeDetails: likeDetails.length ? likeDetails : undefined,
    comments,
    addedBy:
      place.addedBy && !hiddenUserIds.has(place.addedBy.userId)
        ? place.addedBy
        : undefined,
  };
}

function sanitizeListForViewer(list: PlaceList, hiddenUserIds: Set<string>): PlaceList | null {
  if (hiddenUserIds.has(list.userId)) {
    return null;
  }

  const likedBy = (list.likedBy || []).filter((userId) => !hiddenUserIds.has(userId));
  const likeDetails = (list.likeDetails || []).filter(
    (detail) => !hiddenUserIds.has(detail.userId),
  );
  const places = list.places
    .map((place) => sanitizePlaceForViewer(place, hiddenUserIds))
    .filter((place): place is Place => Boolean(place));

  return {
    ...list,
    likes: likedBy.length,
    likedBy: likedBy.length ? likedBy : undefined,
    likeDetails: likeDetails.length ? likeDetails : undefined,
    places,
  };
}

export function getVisibleUsersFor(
  users: User[],
  blockRows: UserBlockRow[],
  viewerId?: string | null,
) {
  const hiddenUserIds = getHiddenUserIdsFor(blockRows, viewerId);
  return users.filter((user) => user.id === viewerId || !hiddenUserIds.has(user.id));
}

export function getVisibleListsFor(
  lists: PlaceList[],
  blockRows: UserBlockRow[],
  viewerId?: string | null,
) {
  const hiddenUserIds = getHiddenUserIdsFor(blockRows, viewerId);

  return lists
    .map((list) => sanitizeListForViewer(list, hiddenUserIds))
    .filter((list): list is PlaceList => Boolean(list));
}
