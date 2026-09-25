import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { PlaceComment, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import { updatePlaceReadModelCaches } from '@/mobile/app/data/query/optimisticPlaceReadModels';
import type { FollowStateResult } from '@/mobile/app/data/query/optimisticFollowState';
import {
  type CommentLikeTarget,
  type PlaceCommentRecord,
  addCommentToTree,
  applyBlockStateToUser,
  applyFollowStateToUser,
  filterBlockedTargetFromNotifications,
  filterBlockedTargetFromVisibleData,
  isInfiniteCommentsData,
  isInfiniteExploreData,
  isInfiniteListsData,
  isVisibleUserData,
  updateCommentInVisibleLists,
  updateCommentTree,
  updateLikeFields,
  updatePlaceComments,
  updatePlaceInVisibleLists,
  updateRawCommentRows,
  updateVisibleBlockRows,
  updateVisibleListsData,
  updateVisibleUsers,
} from '@/mobile/app/data/query/optimisticCacheTransforms';

export {
  inferOptimisticFollowResult,
  readOptimisticFollowState,
} from '@/mobile/app/data/query/optimisticFollowState';
export { inferOptimisticPlaceLikeState } from '@/mobile/app/data/query/optimisticPlaceReadModels';

export type QuerySnapshot = Array<[QueryKey, unknown]>;

export function snapshotQueries(queryClient: QueryClient, queryKey: QueryKey): QuerySnapshot {
  return queryClient.getQueriesData({ queryKey });
}

export function restoreQueries(queryClient: QueryClient, snapshot?: QuerySnapshot) {
  snapshot?.forEach(([queryKey, data]) => {
    queryClient.setQueryData(queryKey, data);
  });
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
  updatePlaceReadModelCaches(queryClient, input.placeId, (place) =>
    updateLikeFields(place, input.userId, createdAt),
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
