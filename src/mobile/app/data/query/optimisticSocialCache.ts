import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';

import type { Place, PlaceComment, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import type { ExplorePage } from '@/mobile/app/data/repositories/exploreRepository';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import { getVisibleListsFor } from '@/mobile/app/data/selectors/visibility';
import type {
  ListPlaceCommentLikeRow,
  ListPlaceCommentRow,
  UserBlockRow,
} from '@/mobile/app/platform/supabase/databaseTypes';
import { uniqueStrings } from '@/mobile/app/shared/utils/format';

type FollowStateResult = 'following' | 'requested' | 'unfollowed';

export type QuerySnapshot = Array<[QueryKey, unknown]>;

type PlaceCommentRecord = ListPlaceCommentRow & {
  is_pending?: boolean;
  list_place_comment_likes?: ListPlaceCommentLikeRow[] | null;
};

type VisibleUserData = {
  allUsers: User[];
  blockRows: UserBlockRow[];
  currentUser: User | null;
  users: User[];
  lists?: PlaceList[];
};

type CommentLikeTarget = {
  commentId: string;
  userId: string;
};

export function snapshotQueries(queryClient: QueryClient, queryKey: QueryKey): QuerySnapshot {
  return queryClient.getQueriesData({ queryKey });
}

export function restoreQueries(queryClient: QueryClient, snapshot?: QuerySnapshot) {
  snapshot?.forEach(([queryKey, data]) => {
    queryClient.setQueryData(queryKey, data);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isVisibleUserData(value: unknown): value is VisibleUserData {
  return (
    isRecord(value) &&
    Array.isArray(value.allUsers) &&
    Array.isArray(value.blockRows) &&
    Array.isArray(value.users) &&
    'currentUser' in value
  );
}

function isInfiniteListsData(value: unknown): value is InfiniteData<PlaceList[], number> {
  return isRecord(value) && Array.isArray(value.pages) && Array.isArray(value.pageParams);
}

function isInfiniteCommentsData(
  value: unknown,
): value is InfiniteData<PlaceCommentRecord[], number> {
  return isRecord(value) && Array.isArray(value.pages) && Array.isArray(value.pageParams);
}

function isInfiniteNotificationsData(
  value: unknown,
): value is InfiniteData<Array<{ userId?: string }>, number> {
  return isRecord(value) && Array.isArray(value.pages) && Array.isArray(value.pageParams);
}

function isInfiniteExploreData(value: unknown): value is InfiniteData<ExplorePage> {
  return isRecord(value) && Array.isArray(value.pages) && Array.isArray(value.pageParams);
}

function optionalStrings(values?: string[]) {
  const nextValues = uniqueStrings(values);
  return nextValues.length ? nextValues : undefined;
}

function addValue(values: string[] | undefined, value: string) {
  return optionalStrings([...(values || []), value]);
}

function removeValue(values: string[] | undefined, value: string) {
  return optionalStrings((values || []).filter((item) => item !== value));
}

function applyUserUpdate(user: User, updater: (item: User) => User) {
  return updater(user);
}

function updateVisibleUsers(data: unknown, updater: (user: User) => User) {
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

function applyFollowStateToUser(
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

function removeRelationshipBetween(user: User, otherUserId: string): User {
  return {
    ...user,
    followers: removeValue(user.followers, otherUserId),
    following: removeValue(user.following, otherUserId),
    pendingFollowRequestsReceived: removeValue(user.pendingFollowRequestsReceived, otherUserId),
    pendingFollowRequestsSent: removeValue(user.pendingFollowRequestsSent, otherUserId),
  };
}

function applyBlockStateToUser(
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

function updateVisibleBlockRows(
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

function updateLikeFields<T extends { likedBy?: string[]; likeDetails?: Array<{ userId: string; createdAt: string }>; likes?: number }>(
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

function updateCommentTree(
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

function addCommentToTree(
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

function updatePlaceComments(
  place: Place,
  updater: (comments: PlaceComment[] | undefined) => PlaceComment[] | undefined,
): Place {
  return {
    ...place,
    comments: updater(place.comments),
  };
}

function updatePlaceInList(
  list: PlaceList,
  placeId: string,
  updater: (place: Place) => Place,
): PlaceList {
  return {
    ...list,
    places: list.places.map((place) => (place.id === placeId ? updater(place) : place)),
  };
}

function updatePlaceInVisibleLists(
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

function updateListsCollection(
  lists: PlaceList[],
  updater: (lists: PlaceList[]) => PlaceList[],
) {
  return updater(lists);
}

function updateVisibleListsData(
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

function updateCommentInVisibleLists(
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

function updateRawCommentRows(
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

function filterListsForBlockedTarget(
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

function filterBlockedTargetFromVisibleData(
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

function filterBlockedTargetFromNotifications(data: unknown, targetUserId: string) {
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

export function inferOptimisticFollowResult(
  queryClient: QueryClient,
  input: { currentUserId: string; targetUserId: string },
): FollowStateResult {
  const visibleQueries = queryClient.getQueriesData({ queryKey: queryKeys.visibleData.all });

  for (const [, data] of visibleQueries) {
    if (!isVisibleUserData(data)) {
      continue;
    }

    const currentUser =
      data.currentUser?.id === input.currentUserId
        ? data.currentUser
        : data.allUsers.find((item) => item.id === input.currentUserId);
    const targetUser = data.allUsers.find((item) => item.id === input.targetUserId);

    if ((currentUser?.following || []).includes(input.targetUserId)) {
      return 'unfollowed';
    }

    if ((currentUser?.pendingFollowRequestsSent || []).includes(input.targetUserId)) {
      return 'requested';
    }

    if (targetUser?.isPublicAccount === false) {
      return 'requested';
    }
  }

  return 'following';
}

export function applyOptimisticFollow(
  queryClient: QueryClient,
  input: { currentUserId: string; targetUserId: string },
  result: FollowStateResult,
) {
  queryClient.setQueriesData({ queryKey: queryKeys.visibleData.all }, (data: unknown) =>
    updateVisibleUsers(data, (user) =>
      applyFollowStateToUser(user, input.currentUserId, input.targetUserId, result),
    ),
  );
}

export function applyOptimisticExploreFollow(
  queryClient: QueryClient,
  input: { targetUserId: string },
  result: FollowStateResult,
) {
  if (result === 'unfollowed') {
    return;
  }

  queryClient.setQueriesData({ queryKey: queryKeys.explore.all }, (data: unknown) => {
    if (!isInfiniteExploreData(data)) {
      return data;
    }

    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        listItems: page.listItems.filter((item) => item.list.userId !== input.targetUserId),
        placeItems: page.placeItems.filter((item) => item.ownerId !== input.targetUserId),
        userItems: page.userItems.filter((item) => item.id !== input.targetUserId),
      })),
    };
  });
}

export function applyOptimisticBlock(
  queryClient: QueryClient,
  input: { currentUserId: string; targetUserId: string },
  createdAt = new Date().toISOString(),
) {
  queryClient.setQueriesData({ queryKey: queryKeys.visibleData.all }, (data: unknown) => {
    const withUsers = updateVisibleUsers(data, (user) =>
      applyBlockStateToUser(user, input.currentUserId, input.targetUserId, true),
    );

    return updateVisibleBlockRows(
      withUsers,
      input.currentUserId,
      input.targetUserId,
      true,
      createdAt,
    );
  });

  queryClient.setQueriesData({ queryKey: queryKeys.visibleData.all }, (data: unknown) =>
    filterBlockedTargetFromVisibleData(
      data,
      input.currentUserId,
      input.targetUserId,
      createdAt,
    ),
  );

  queryClient.setQueriesData({ queryKey: queryKeys.notifications.all }, (data: unknown) =>
    filterBlockedTargetFromNotifications(data, input.targetUserId),
  );
}

export function applyOptimisticUnblock(
  queryClient: QueryClient,
  input: { currentUserId: string; targetUserId: string },
) {
  queryClient.setQueriesData({ queryKey: queryKeys.visibleData.all }, (data: unknown) => {
    const withUsers = updateVisibleUsers(data, (user) =>
      applyBlockStateToUser(user, input.currentUserId, input.targetUserId, false),
    );

    return updateVisibleBlockRows(
      withUsers,
      input.currentUserId,
      input.targetUserId,
      false,
      new Date().toISOString(),
    );
  });
}

export function applyOptimisticUserProfile(queryClient: QueryClient, nextUser: User) {
  queryClient.setQueriesData({ queryKey: queryKeys.visibleData.all }, (data: unknown) =>
    updateVisibleUsers(data, (user) =>
      user.id === nextUser.id
        ? {
            ...user,
            ...nextUser,
            username: nextUser.username.toLowerCase(),
          }
        : user,
    ),
  );
}

export function applyOptimisticPlaceLike(
  queryClient: QueryClient,
  input: { placeId: string; userId: string },
  createdAt = new Date().toISOString(),
) {
  queryClient.setQueriesData({ queryKey: queryKeys.visibleData.all }, (data: unknown) =>
    updatePlaceInVisibleLists(data, input.placeId, (place) =>
      updateLikeFields(place, input.userId, createdAt),
    ),
  );
}

export function applyOptimisticCommentCreate(
  queryClient: QueryClient,
  input: {
    commentId: string;
    content: string;
    parentCommentId?: string | null;
    placeId: string;
    userId: string;
  },
  createdAt = new Date().toISOString(),
) {
  const optimisticComment: PlaceComment = {
    id: input.commentId,
    userId: input.userId,
    content: input.content,
    parentCommentId: input.parentCommentId || undefined,
    createdAt,
    updatedAt: createdAt,
    isPending: true,
    likes: 0,
    likedBy: undefined,
    likeDetails: undefined,
    replies: [],
  };
  const optimisticRow: PlaceCommentRecord = {
    id: input.commentId,
    list_place_id: input.placeId,
    user_id: input.userId,
    parent_comment_id: input.parentCommentId || null,
    content: input.content,
    created_at: createdAt,
    updated_at: createdAt,
    is_pending: true,
    list_place_comment_likes: [],
  };

  queryClient.setQueriesData(
    { queryKey: queryKeys.visibleData.all },
    (data: unknown) =>
      updatePlaceInVisibleLists(data, input.placeId, (place) =>
        updatePlaceComments(place, (comments) => addCommentToTree(comments, optimisticComment)),
      ),
  );
  queryClient.setQueriesData(
    {
      queryKey: queryKeys.placeComments.all,
      predicate: (query) => query.queryKey[2] === input.placeId,
    },
    (data: unknown) => {
      if (!isInfiniteCommentsData(data)) {
        return data;
      }

      if (!data.pages.length) {
        return {
          ...data,
          pages: [[optimisticRow]],
        };
      }

      return {
        ...data,
        pages: data.pages.map((page, index) =>
          index === 0 ? [optimisticRow, ...page] : page,
        ),
      };
    },
  );
}

export function applyOptimisticCommentUpdate(
  queryClient: QueryClient,
  input: { commentId: string; content: string },
  updatedAt = new Date().toISOString(),
) {
  queryClient.setQueriesData({ queryKey: queryKeys.visibleData.all }, (data: unknown) =>
    updateCommentInVisibleLists(data, (place) =>
      updatePlaceComments(place, (comments) =>
        updateCommentTree(comments, (comment) =>
          comment.id === input.commentId
            ? { ...comment, content: input.content, updatedAt }
            : comment,
        ),
      ),
    ),
  );
  queryClient.setQueriesData({ queryKey: queryKeys.placeComments.all }, (data: unknown) =>
    updateRawCommentRows(data, (row) =>
      row.id === input.commentId
        ? { ...row, content: input.content, updated_at: updatedAt }
        : row,
    ),
  );
}

export function applyOptimisticCommentDelete(queryClient: QueryClient, commentId: string) {
  queryClient.setQueriesData({ queryKey: queryKeys.visibleData.all }, (data: unknown) =>
    updateCommentInVisibleLists(data, (place) =>
      updatePlaceComments(place, (comments) =>
        updateCommentTree(comments, (comment) =>
          comment.id === commentId || comment.parentCommentId === commentId ? null : comment,
        ),
      ),
    ),
  );
  queryClient.setQueriesData({ queryKey: queryKeys.placeComments.all }, (data: unknown) =>
    updateRawCommentRows(data, (row) =>
      row.id === commentId || row.parent_comment_id === commentId ? null : row,
    ),
  );
}

export function applyOptimisticCommentLike(
  queryClient: QueryClient,
  input: CommentLikeTarget,
  createdAt = new Date().toISOString(),
) {
  queryClient.setQueriesData({ queryKey: queryKeys.visibleData.all }, (data: unknown) =>
    updateCommentInVisibleLists(data, (place) =>
      updatePlaceComments(place, (comments) =>
        updateCommentTree(comments, (comment) =>
          comment.id === input.commentId
            ? updateLikeFields(comment, input.userId, createdAt)
            : comment,
        ),
      ),
    ),
  );
  queryClient.setQueriesData({ queryKey: queryKeys.placeComments.all }, (data: unknown) =>
    updateRawCommentRows(data, (row) => {
      if (row.id !== input.commentId) {
        return row;
      }

      const likes = row.list_place_comment_likes || [];
      const isLiked = likes.some((like) => like.user_id === input.userId);
      const nextLikes = isLiked
        ? likes.filter((like) => like.user_id !== input.userId)
        : [
            {
              comment_id: input.commentId,
              user_id: input.userId,
              created_at: createdAt,
            },
            ...likes.filter((like) => like.user_id !== input.userId),
          ];

      return {
        ...row,
        list_place_comment_likes: nextLikes,
      };
    }),
  );
}

export function applyOptimisticListCreate(queryClient: QueryClient, list: PlaceList) {
  queryClient.setQueriesData({ queryKey: queryKeys.visibleData.all }, (data: unknown) =>
    updateVisibleListsData(data, (lists) =>
      lists.some((item) => item.id === list.id) ? lists : [list, ...lists],
    ),
  );
}

export function applyOptimisticListUpdate(queryClient: QueryClient, list: PlaceList) {
  queryClient.setQueriesData({ queryKey: queryKeys.visibleData.all }, (data: unknown) =>
    updateVisibleListsData(data, (lists) =>
      lists.map((item) => (item.id === list.id ? list : item)),
    ),
  );
}

export function applyOptimisticListsUpdate(queryClient: QueryClient, listsToUpdate: PlaceList[]) {
  const updatesById = new Map(listsToUpdate.map((list) => [list.id, list]));

  queryClient.setQueriesData({ queryKey: queryKeys.visibleData.all }, (data: unknown) =>
    updateVisibleListsData(data, (lists) =>
      lists.map((item) => updatesById.get(item.id) || item),
    ),
  );
}

export function applyOptimisticListDelete(queryClient: QueryClient, listId: string) {
  queryClient.setQueriesData({ queryKey: queryKeys.visibleData.all }, (data: unknown) =>
    updateVisibleListsData(data, (lists) => lists.filter((item) => item.id !== listId)),
  );
}

export function applyOptimisticPlaceDelete(queryClient: QueryClient, placeId: string) {
  queryClient.setQueriesData({ queryKey: queryKeys.visibleData.all }, (data: unknown) => {
    if (isInfiniteListsData(data)) {
      return {
        ...data,
        pages: data.pages.map((page) =>
          page.map((list) => ({
            ...list,
            places: list.places.filter((place) => place.id !== placeId),
          })),
        ),
      };
    }

    if (isVisibleUserData(data) && Array.isArray(data.lists)) {
      return {
        ...data,
        lists: data.lists.map((list) => ({
          ...list,
          places: list.places.filter((place) => place.id !== placeId),
        })),
      };
    }

    return data;
  });
}
