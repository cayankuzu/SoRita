import type { PlaceComment, User } from '@/mobile/app/data/contracts/entities';
import {
  updateCommentInLists,
  updateCommentTree,
  updatePlaceInLists,
} from '@/mobile/app/data/repositories/storage/storageCacheMutations';
import { getCommentFromLists, getPlaceFromLists } from '@/mobile/app/data/repositories/storage/storageSelectors';

type RunOptimisticMutation = <T>(
  applyOptimistic: () => void,
  task: () => Promise<T>,
  onError?: (error: unknown) => Promise<void> | void,
) => Promise<T>;

type StorageSocialDependencies = {
  supabase: typeof import('@/mobile/app/platform/supabase/client').supabase;
  getUsersCache: () => User[];
  getListsCache: () => import('@/mobile/app/data/contracts/entities').PlaceList[];
  setListsCache: (lists: import('@/mobile/app/data/contracts/entities').PlaceList[]) => void;
  runOptimisticMutation: RunOptimisticMutation;
  isMissingPlaceCommentLikeSchemaError: (
    error: { code?: string | null; message?: string | null; details?: string | null } | null | undefined,
  ) => boolean;
};

export function createStorageSocialRepository({
  supabase,
  getUsersCache,
  getListsCache,
  setListsCache,
  runOptimisticMutation,
  isMissingPlaceCommentLikeSchemaError,
}: StorageSocialDependencies) {
  return {
    async toggleLikeList(listId: string, userId: string): Promise<void> {
      const targetList = getListsCache().find((item) => item.id === listId);
      const isLiked = Boolean(targetList?.likedBy?.includes(userId));

      await runOptimisticMutation(
        () => {
          setListsCache(
            getListsCache().map((list) => {
              if (list.id !== listId) {
                return list;
              }

              const nextLikedBy = new Set(list.likedBy || []);
              const nextLikeDetails = (list.likeDetails || []).slice();

              if (isLiked) {
                nextLikedBy.delete(userId);
              } else {
                nextLikedBy.add(userId);
                nextLikeDetails.unshift({
                  userId,
                  createdAt: new Date().toISOString(),
                });
              }

              return {
                ...list,
                likes: nextLikedBy.size,
                likedBy: nextLikedBy.size ? Array.from(nextLikedBy) : undefined,
                likeDetails: nextLikeDetails.filter((detail) => nextLikedBy.has(detail.userId)),
              };
            }),
          );
        },
        async () => {
          if (isLiked) {
            const { error } = await supabase
              .from('list_likes')
              .delete()
              .eq('list_id', listId)
              .eq('user_id', userId);

            if (error) {
              throw error;
            }
          } else {
            const { error } = await supabase.from('list_likes').insert({
              list_id: listId,
              user_id: userId,
            });

            if (error) {
              throw error;
            }
          }
        },
      );
    },

    async toggleLikePlace(placeId: string, userId: string): Promise<void> {
      const targetPlace = getPlaceFromLists(getListsCache(), placeId)?.place;
      const isLiked = Boolean(targetPlace?.likedBy?.includes(userId));

      await runOptimisticMutation(
        () => {
          setListsCache(
            updatePlaceInLists(getListsCache(), placeId, (place) => {
              const nextLikedBy = new Set(place.likedBy || []);
              const nextLikeDetails = (place.likeDetails || []).slice();

              if (isLiked) {
                nextLikedBy.delete(userId);
              } else {
                nextLikedBy.add(userId);
                nextLikeDetails.unshift({
                  userId,
                  createdAt: new Date().toISOString(),
                });
              }

              return {
                ...place,
                likes: nextLikedBy.size,
                likedBy: nextLikedBy.size ? Array.from(nextLikedBy) : undefined,
                likeDetails: nextLikeDetails.filter((detail) => nextLikedBy.has(detail.userId)),
              };
            }),
          );
        },
        async () => {
          if (isLiked) {
            const { error } = await supabase
              .from('list_place_likes')
              .delete()
              .eq('list_place_id', placeId)
              .eq('user_id', userId);

            if (error) {
              throw error;
            }
          } else {
            const { error } = await supabase.from('list_place_likes').insert({
              list_place_id: placeId,
              user_id: userId,
            });

            if (error) {
              throw error;
            }
          }
        },
      );
    },

    async createPlaceComment(
      placeId: string,
      userId: string,
      content: string,
      parentCommentId?: string | null,
    ): Promise<void> {
      const trimmedContent = content.trim();
      const tempId = `temp-comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();
      const author = getUsersCache().find((item) => item.id === userId);
      const optimisticComment: PlaceComment = {
        id: tempId,
        userId,
        content: trimmedContent,
        parentCommentId: parentCommentId || undefined,
        createdAt: now,
        updatedAt: now,
        likes: 0,
        likedBy: undefined,
        likeDetails: undefined,
        replies: [],
        author: author
          ? {
              userId: author.id,
              name: author.name,
              username: author.username,
              profilePhoto: author.profilePhoto,
            }
          : undefined,
      };

      await runOptimisticMutation(
        () => {
          setListsCache(
            updatePlaceInLists(getListsCache(), placeId, (place) => {
              if (parentCommentId) {
                return {
                  ...place,
                  comments: updateCommentTree(place.comments || [], parentCommentId, (comment) => ({
                    ...comment,
                    replies: [...(comment.replies || []), optimisticComment],
                  })),
                };
              }

              return {
                ...place,
                comments: [optimisticComment, ...(place.comments || [])],
              };
            }),
          );
        },
        async () => {
          const payload: Record<string, unknown> = {
            list_place_id: placeId,
            user_id: userId,
            content: trimmedContent,
          };

          if (parentCommentId) {
            payload.parent_comment_id = parentCommentId;
          }

          let { data, error } = await supabase
            .from('list_place_comments')
            .insert(payload)
            .select('id, created_at, updated_at, parent_comment_id')
            .single();

          if (error && parentCommentId && isMissingPlaceCommentLikeSchemaError(error)) {
            throw new Error('Yanit sistemi henuz veritabaninda aktif degil. Once yeni migrationi uygula.');
          }

          if (error) {
            throw error;
          }

          setListsCache(
            updateCommentInLists(getListsCache(), tempId, (comment) => ({
              ...comment,
              id: data.id,
              createdAt: data.created_at,
              updatedAt: data.updated_at,
              parentCommentId: data.parent_comment_id || undefined,
            })),
          );
        },
      );
    },

    async toggleLikePlaceComment(commentId: string, userId: string): Promise<void> {
      const targetComment = getCommentFromLists(getListsCache(), commentId)?.comment;
      const isLiked = Boolean(targetComment?.likedBy?.includes(userId));

      await runOptimisticMutation(
        () => {
          setListsCache(
            updateCommentInLists(getListsCache(), commentId, (comment) => {
              const nextLikedBy = new Set(comment.likedBy || []);
              const nextLikeDetails = (comment.likeDetails || []).slice();

              if (isLiked) {
                nextLikedBy.delete(userId);
              } else {
                nextLikedBy.add(userId);
                nextLikeDetails.unshift({
                  userId,
                  createdAt: new Date().toISOString(),
                });
              }

              return {
                ...comment,
                likes: nextLikedBy.size,
                likedBy: nextLikedBy.size ? Array.from(nextLikedBy) : undefined,
                likeDetails: nextLikeDetails.filter((detail) => nextLikedBy.has(detail.userId)),
              };
            }),
          );
        },
        async () => {
          if (isLiked) {
            const { error } = await supabase
              .from('list_place_comment_likes')
              .delete()
              .eq('comment_id', commentId)
              .eq('user_id', userId);

            if (error) {
              if (isMissingPlaceCommentLikeSchemaError(error)) {
                throw new Error('Yorum begenisi henuz veritabaninda aktif degil. Once yeni migrationi uygula.');
              }

              throw error;
            }
          } else {
            const { error } = await supabase.from('list_place_comment_likes').insert({
              comment_id: commentId,
              user_id: userId,
            });

            if (error) {
              if (isMissingPlaceCommentLikeSchemaError(error)) {
                throw new Error('Yorum begenisi henuz veritabaninda aktif degil. Once yeni migrationi uygula.');
              }

              throw error;
            }
          }
        },
      );
    },

    async updatePlaceComment(commentId: string, userId: string, content: string): Promise<void> {
      const trimmedContent = content.trim();
      const nextUpdatedAt = new Date().toISOString();

      await runOptimisticMutation(
        () => {
          setListsCache(
            updateCommentInLists(getListsCache(), commentId, (comment) => ({
              ...comment,
              content: trimmedContent,
              updatedAt: nextUpdatedAt,
            })),
          );
        },
        async () => {
          const { error } = await supabase
            .from('list_place_comments')
            .update({
              content: trimmedContent,
              updated_at: nextUpdatedAt,
            })
            .eq('id', commentId)
            .eq('user_id', userId);

          if (error) {
            throw error;
          }
        },
      );
    },

    async deletePlaceComment(commentId: string): Promise<void> {
      await runOptimisticMutation(
        () => {
          setListsCache(updateCommentInLists(getListsCache(), commentId, () => null));
        },
        async () => {
          const { error } = await supabase
            .from('list_place_comments')
            .delete()
            .eq('id', commentId);

          if (error) {
            throw error;
          }
        },
      );
    },
  };
}
