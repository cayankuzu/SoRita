// Pure transforms over cached query data (users, lists, comments, notifications, Explore pages): each returns new data and touches no cache.

import type { InfiniteData } from '@tanstack/react-query';
import type { Place, PlaceComment, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import type { ExplorePage } from '@/mobile/app/data/repositories/exploreRepository';
import type { FollowStateResult } from '@/mobile/app/data/query/optimisticFollowState';
import { getVisibleListsFor } from '@/mobile/app/data/selectors/visibility';
import type {
  ListPlaceCommentLikeRow,
  ListPlaceCommentRow,
  UserBlockRow,
} from '@/mobile/app/platform/supabase/databaseTypes';
import { uniqueStrings } from '@/mobile/app/shared/utils/format';

export type PlaceCommentRecord = ListPlaceCommentRow & {
  is_pending?: boolean;
  list_place_comment_likes?: ListPlaceCommentLikeRow[] | null;
};

export type VisibleUserData = {
  allUsers: User[];
  blockRows: UserBlockRow[];
  currentUser: User | null;
  users: User[];
  lists?: PlaceList[];
};

export type CommentLikeTarget = {
  commentId: string;
  userId: string;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

export function isVisibleUserData(value: unknown): value is VisibleUserData {
  return (
    isRecord(value) &&
    Array.isArray(value.allUsers) &&
    Array.isArray(value.blockRows) &&
    Array.isArray(value.users) &&
    'currentUser' in value
  );
}

export function isInfiniteListsData(value: unknown): value is InfiniteData<PlaceList[], number> {
  return (
    isRecord(value) &&
    Array.isArray(value.pages) &&
    value.pages.every(
      (page) =>
        Array.isArray(page) &&
        page.every((list) => isRecord(list) && Array.isArray(list.places)),
    ) &&
    Array.isArray(value.pageParams)
  );
}

export function isInfiniteCommentsData(
  value: unknown,
): value is InfiniteData<PlaceCommentRecord[], number> {
  return isRecord(value) && Array.isArray(value.pages) && Array.isArray(value.pageParams);
}

export function isInfiniteNotificationsData(
  value: unknown,
): value is InfiniteData<Array<{ userId?: string }>, number> {
  return isRecord(value) && Array.isArray(value.pages) && Array.isArray(value.pageParams);
}

export function isInfiniteExploreData(value: unknown): value is InfiniteData<ExplorePage> {
  return (
    isRecord(value) &&
    Array.isArray(value.pages) &&
    Array.isArray(value.pageParams) &&
    value.pages.every(
      (page) =>
        isRecord(page) &&
        Array.isArray(page.listItems) &&
        Array.isArray(page.placeItems) &&
        Array.isArray(page.userItems),
    )
  );
}

export function optionalStrings(values?: string[]) {
  const nextValues = uniqueStrings(values);
  return nextValues.length ? nextValues : undefined;
}

export function addValue(values: string[] | undefined, value: string) {
  return optionalStrings([...(values || []), value]);
}

export function removeValue(values: string[] | undefined, value: string) {
  return optionalStrings((values || []).filter((item) => item !== value));
}

export function applyUserUpdate(user: User, updater: (item: User) => User) {
  return updater(user);
}

export function updateVisibleUsers(data: unknown, updater: (user: User) => User) {
  if (!isVisibleUserData(data)) {
    return data;
  }

  const allUsers = data.allUsers.map((item) => applyUserUpdate(item, updater));
  const users = data.users.map((item) => applyUserUpdate(item, updater));
  const currentUser = data.currentUser ? applyUserUpdate(data.currentUser, updater) : null;

  return {
    ...data,
    allUsers,
    currentUser,
    users,
  };
}

export function applyFollowStateToUser(
  user: User,
  currentUserId: string,
  targetUserId: string,
  result: FollowStateResult,
): User {
  if (user.id === currentUserId) {
    if (result === 'following') {
      return {
        ...user,
        following: addValue(user.following, targetUserId),
        pendingFollowRequestsSent: removeValue(user.pendingFollowRequestsSent, targetUserId),
      };
    }

    if (result === 'requested') {
      return {
        ...user,
        pendingFollowRequestsSent: addValue(user.pendingFollowRequestsSent, targetUserId),
      };
    }

    return {
      ...user,
      following: removeValue(user.following, targetUserId),
      pendingFollowRequestsSent: removeValue(user.pendingFollowRequestsSent, targetUserId),
    };
  }

  if (user.id === targetUserId) {
    if (result === 'following') {
      return {
        ...user,
        followers: addValue(user.followers, currentUserId),
        pendingFollowRequestsReceived: removeValue(
          user.pendingFollowRequestsReceived,
          currentUserId,
        ),
      };
    }

    if (result === 'requested') {
      return {
        ...user,
        pendingFollowRequestsReceived: addValue(
          user.pendingFollowRequestsReceived,
          currentUserId,
        ),
      };
    }

    return {
      ...user,
      followers: removeValue(user.followers, currentUserId),
      pendingFollowRequestsReceived: removeValue(
        user.pendingFollowRequestsReceived,
        currentUserId,
      ),
    };
  }

  return user;
}

export function removeRelationshipBetween(user: User, otherUserId: string): User {
  return {
    ...user,
    followers: removeValue(user.followers, otherUserId),
    following: removeValue(user.following, otherUserId),
    pendingFollowRequestsReceived: removeValue(user.pendingFollowRequestsReceived, otherUserId),
    pendingFollowRequestsSent: removeValue(user.pendingFollowRequestsSent, otherUserId),
  };
}

export function applyBlockStateToUser(
  user: User,
  currentUserId: string,
  targetUserId: string,
  blocked: boolean,
): User {
  if (user.id === currentUserId) {
    const nextUser = removeRelationshipBetween(user, targetUserId);

    return {
      ...nextUser,
      blockedUsers: blocked
        ? addValue(nextUser.blockedUsers, targetUserId)
        : removeValue(nextUser.blockedUsers, targetUserId),
    };
  }

  if (user.id === targetUserId) {
    const nextUser = removeRelationshipBetween(user, currentUserId);

    return {
      ...nextUser,
      blockedByUsers: blocked
        ? addValue(nextUser.blockedByUsers, currentUserId)
        : removeValue(nextUser.blockedByUsers, currentUserId),
    };
  }

  return user;
}

export function updateVisibleBlockRows(
  data: unknown,
  currentUserId: string,
  targetUserId: string,
  blocked: boolean,
  createdAt: string,
) {
  if (!isVisibleUserData(data)) {
    return data;
  }

  const withoutTarget = data.blockRows.filter(
    (item) =>
      item.blocker_user_id !== currentUserId ||
      item.blocked_user_id !== targetUserId,
  );
  const blockRows = blocked
    ? [
        ...withoutTarget,
        {
          blocker_user_id: currentUserId,
          blocked_user_id: targetUserId,
          created_at: createdAt,
        },
      ]
    : withoutTarget;

  const shouldFilterTarget = blocked && data.currentUser?.id === currentUserId;
  const shouldRestoreTarget = !blocked && data.currentUser?.id === currentUserId;
  const targetUser = data.allUsers.find((item) => item.id === targetUserId);
  const users = shouldFilterTarget
    ? data.users.filter((item) => item.id !== targetUserId)
    : shouldRestoreTarget && targetUser && !data.users.some((item) => item.id === targetUserId)
      ? [...data.users, targetUser]
      : data.users;

  return {
    ...data,
    blockRows,
    users,
  };
}

export function updateLikeFields<T extends { likedBy?: string[]; likeDetails?: Array<{ userId: string; createdAt: string }>; likes?: number }>(
  item: T,
  userId: string,
  createdAt: string,
): T {
  const likedBy = item.likedBy || item.likeDetails?.map((detail) => detail.userId) || [];
  const isLiked = likedBy.includes(userId);
  const nextLikedBy = isLiked
    ? likedBy.filter((itemUserId) => itemUserId !== userId)
    : uniqueStrings([userId, ...likedBy]);
  const nextLikeDetails = isLiked
    ? (item.likeDetails || []).filter((detail) => detail.userId !== userId)
    : [
        { userId, createdAt },
        ...(item.likeDetails || []).filter((detail) => detail.userId !== userId),
      ];

  return {
    ...item,
    likedBy: nextLikedBy.length ? nextLikedBy : undefined,
    likeDetails: nextLikeDetails.length ? nextLikeDetails : undefined,
    likes: nextLikedBy.length,
  };
}

export function updateCommentTree(
  comments: PlaceComment[] | undefined,
  updater: (comment: PlaceComment) => PlaceComment | null,
): PlaceComment[] | undefined {
  const nextComments = (comments || [])
    .map<PlaceComment | null>((comment) => {
      const updatedComment = updater(comment);

      if (!updatedComment) {
        return null;
      }

      return {
        ...updatedComment,
        replies: updateCommentTree(updatedComment.replies, updater),
      };
    })
    .filter((comment): comment is PlaceComment => Boolean(comment));

  return nextComments.length ? nextComments : undefined;
}

export function addCommentToTree(
  comments: PlaceComment[] | undefined,
  optimisticComment: PlaceComment,
): PlaceComment[] | undefined {
  if (!optimisticComment.parentCommentId) {
    return [optimisticComment, ...(comments || [])];
  }

  let inserted = false;
  const nextComments = (comments || []).map((comment) => {
    if (comment.id === optimisticComment.parentCommentId) {
      inserted = true;
      return {
        ...comment,
        replies: [...(comment.replies || []), optimisticComment],
      };
    }

    return {
      ...comment,
      replies: addCommentToTree(comment.replies, optimisticComment),
    };
  });

  return inserted ? nextComments : comments;
}

export function updatePlaceComments(
  place: Place,
  updater: (comments: PlaceComment[] | undefined) => PlaceComment[] | undefined,
): Place {
  return {
    ...place,
    comments: updater(place.comments),
  };
}

export function updatePlaceInList(
  list: PlaceList,
  placeId: string,
  updater: (place: Place) => Place,
): PlaceList {
  return {
    ...list,
    places: list.places.map((place) => (place.id === placeId ? updater(place) : place)),
  };
}

export function updatePlaceInVisibleLists(
  data: unknown,
  placeId: string,
  updater: (place: Place) => Place,
) {
  if (isInfiniteListsData(data)) {
    return {
      ...data,
      pages: data.pages.map((page) =>
        page.map((list) => updatePlaceInList(list, placeId, updater)),
      ),
    };
  }

  if (isVisibleUserData(data) && Array.isArray(data.lists)) {
    return {
      ...data,
      lists: data.lists.map((list) => updatePlaceInList(list, placeId, updater)),
    };
  }

  return data;
}

export function updateListsCollection(
  lists: PlaceList[],
  updater: (lists: PlaceList[]) => PlaceList[],
) {
  return updater(lists);
}

export function updateVisibleListsData(
  data: unknown,
  updater: (lists: PlaceList[]) => PlaceList[],
) {
  if (isInfiniteListsData(data)) {
    return {
      ...data,
      pages: data.pages.map((page) => updateListsCollection(page, updater)),
    };
  }

  if (isVisibleUserData(data) && Array.isArray(data.lists)) {
    return {
      ...data,
      lists: updateListsCollection(data.lists, updater),
    };
  }

  return data;
}

export function updateCommentInVisibleLists(
  data: unknown,
  updater: (place: Place) => Place,
) {
  if (isInfiniteListsData(data)) {
    return {
      ...data,
      pages: data.pages.map((page) =>
        page.map((list) => ({
          ...list,
          places: list.places.map(updater),
        })),
      ),
    };
  }

  if (isVisibleUserData(data) && Array.isArray(data.lists)) {
    return {
      ...data,
      lists: data.lists.map((list) => ({
        ...list,
        places: list.places.map(updater),
      })),
    };
  }

  return data;
}

export function updateRawCommentRows(
  data: unknown,
  updater: (row: PlaceCommentRecord) => PlaceCommentRecord | null,
) {
  if (!isInfiniteCommentsData(data)) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page) =>
      page
        .map((row) => updater(row))
        .filter((row): row is PlaceCommentRecord => Boolean(row)),
    ),
  };
}

export function filterListsForBlockedTarget(
  lists: PlaceList[],
  currentUserId: string,
  targetUserId: string,
  createdAt: string,
) {
  return getVisibleListsFor(
    lists,
    [
      {
        blocker_user_id: currentUserId,
        blocked_user_id: targetUserId,
        created_at: createdAt,
      },
    ],
    currentUserId,
  );
}

export function filterBlockedTargetFromVisibleData(
  data: unknown,
  currentUserId: string,
  targetUserId: string,
  createdAt: string,
) {
  if (isInfiniteListsData(data)) {
    return {
      ...data,
      pages: data.pages.map((page) =>
        filterListsForBlockedTarget(page, currentUserId, targetUserId, createdAt),
      ),
    };
  }

  if (isVisibleUserData(data) && Array.isArray(data.lists)) {
    return {
      ...data,
      lists: filterListsForBlockedTarget(data.lists, currentUserId, targetUserId, createdAt),
    };
  }

  return data;
}

export function filterBlockedTargetFromNotifications(data: unknown, targetUserId: string) {
  if (!isInfiniteNotificationsData(data)) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page) =>
      page.filter((item) => item.userId !== targetUserId),
    ),
  };
}
