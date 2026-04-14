import type { Place, PlaceComment, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import {
  isLocalMediaUri,
  normalizeListCoverUrl,
  normalizeStoredMediaUrl,
  uniqueStrings,
} from '@/mobile/app/data/repositories/storage/storageUtils';
import type {
  FollowRow,
  FollowRequestRow,
  ListLikeRow,
  ListPlaceCommentLikeRow,
  ListPlaceCommentRow,
  ListPlaceLikeRow,
  ListPlacePhotoRow,
  ListPlaceRow,
  ListRow,
  ProfileRow,
  UserBlockRow,
} from '@/mobile/app/platform/supabase/databaseTypes';

type ListRecord = ListRow & {
  list_likes?: ListLikeRow[] | null;
  list_places?: Array<
    ListPlaceRow & {
      list_place_comments?: Array<
        ListPlaceCommentRow & {
          list_place_comment_likes?: ListPlaceCommentLikeRow[] | null;
        }
      > | null;
      list_place_likes?: ListPlaceLikeRow[] | null;
      list_place_photos?: ListPlacePhotoRow[] | null;
    }
  > | null;
};

type ListPlaceCommentRecord = ListPlaceCommentRow & {
  list_place_comment_likes?: ListPlaceCommentLikeRow[] | null;
};

type StorageReadsDependencies = {
  supabase: typeof import('@/mobile/app/platform/supabase/client').supabase;
  getUsersCache: () => User[];
  setUsersCache: (users: User[]) => void;
  setListsCache: (lists: PlaceList[]) => void;
  getCurrentUserCache: () => User | null;
  setCurrentUserCache: (user: User | null) => void;
  setBlockRowsCache: (rows: UserBlockRow[]) => void;
  repairListCoverImage: <T extends {
    id: string;
    owner_id: string;
    cover_image_url?: string | null;
    updated_at: string;
  }>(list: T) => Promise<T>;
  isMissingFollowRequestsSchemaError: (
    error: { code?: string | null; message?: string | null } | null | undefined,
  ) => boolean;
  isMissingUserBlocksSchemaError: (
    error: { code?: string | null; message?: string | null } | null | undefined,
  ) => boolean;
  isMissingPlaceCommentLikeSchemaError: (
    error: { code?: string | null; message?: string | null; details?: string | null } | null | undefined,
  ) => boolean;
  isMissingListPlaceUpdatedAtSchemaError: (
    error: { code?: string | null; message?: string | null; details?: string | null } | null | undefined,
  ) => boolean;
};

function buildUsers(
  profiles: ProfileRow[],
  follows: FollowRow[],
  followRequests: FollowRequestRow[],
  blockRows: UserBlockRow[],
): User[] {
  return profiles.map((profile) => {
    const following = follows
      .filter((item) => item.follower_id === profile.id)
      .map((item) => item.following_id);
    const followers = follows
      .filter((item) => item.following_id === profile.id)
      .map((item) => item.follower_id);
    const pendingFollowRequestsSent = followRequests
      .filter((item) => item.requester_id === profile.id && item.status === 'pending')
      .map((item) => item.target_user_id);
    const pendingFollowRequestsReceived = followRequests
      .filter((item) => item.target_user_id === profile.id && item.status === 'pending')
      .map((item) => item.requester_id);
    const blockedUsers = blockRows
      .filter((item) => item.blocker_user_id === profile.id)
      .map((item) => item.blocked_user_id);
    const blockedByUsers = blockRows
      .filter((item) => item.blocked_user_id === profile.id)
      .map((item) => item.blocker_user_id);

    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      username: profile.username,
      isPublicAccount: profile.is_public_account,
      bio: profile.bio || undefined,
      profilePhoto: normalizeStoredMediaUrl(profile.profile_photo_url),
      coverPhoto: normalizeStoredMediaUrl(profile.cover_photo_url),
      interests: profile.interests?.length ? profile.interests : undefined,
      following: following.length ? following : undefined,
      followers: followers.length ? followers : undefined,
      pendingFollowRequestsSent: pendingFollowRequestsSent.length
        ? pendingFollowRequestsSent
        : undefined,
      pendingFollowRequestsReceived: pendingFollowRequestsReceived.length
        ? pendingFollowRequestsReceived
        : undefined,
      blockedUsers: blockedUsers.length ? uniqueStrings(blockedUsers) : undefined,
      blockedByUsers: blockedByUsers.length ? uniqueStrings(blockedByUsers) : undefined,
    };
  });
}

function mapPlace(
  place: ListPlaceRow & {
    list_place_comments?: ListPlaceCommentRecord[] | null;
    list_place_likes?: ListPlaceLikeRow[] | null;
    list_place_photos?: ListPlacePhotoRow[] | null;
  },
  usersById: Map<string, User>,
): Place {
  const addedByUser = place.created_by ? usersById.get(place.created_by) : null;
  const likeDetails = (place.list_place_likes || [])
    .slice()
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .map((item) => ({
      userId: item.user_id,
      createdAt: item.created_at,
    }));
  const likedBy = likeDetails.map((item) => item.userId);
  const commentRecords = (place.list_place_comments || [])
    .slice()
    .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
  const commentsById = new Map<string, PlaceComment>();

  for (const comment of commentRecords) {
    const author = usersById.get(comment.user_id);
    const commentLikeDetails = (comment.list_place_comment_likes || [])
      .slice()
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .map((item) => ({
        userId: item.user_id,
        createdAt: item.created_at,
      }));
    const commentLikedBy = commentLikeDetails.map((item) => item.userId);

    commentsById.set(comment.id, {
      id: comment.id,
      userId: comment.user_id,
      content: comment.content,
      parentCommentId: comment.parent_comment_id || undefined,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      likes: commentLikedBy.length,
      likedBy: commentLikedBy.length ? commentLikedBy : undefined,
      likeDetails: commentLikeDetails.length ? commentLikeDetails : undefined,
      replies: [],
      author: author
        ? {
            userId: author.id,
            name: author.name,
            username: author.username,
            profilePhoto: author.profilePhoto,
          }
        : undefined,
    });
  }

  const topLevelComments: PlaceComment[] = [];

  for (const comment of commentRecords) {
    const mappedComment = commentsById.get(comment.id);

    if (!mappedComment) {
      continue;
    }

    if (comment.parent_comment_id && commentsById.has(comment.parent_comment_id)) {
      const parentComment = commentsById.get(comment.parent_comment_id);

      if (parentComment) {
        parentComment.replies = [...(parentComment.replies || []), mappedComment];
      }

      continue;
    }

    topLevelComments.push(mappedComment);
  }

  const comments = topLevelComments
    .slice()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  return {
    id: place.id,
    name: place.name,
    title: place.title || undefined,
    lat: place.lat,
    lng: place.lng,
    address: place.address || undefined,
    notes: place.notes || undefined,
    rating: place.rating ?? undefined,
    category: place.category || undefined,
    categories: place.categories?.length ? place.categories : undefined,
    studentDiscount: place.student_discount,
    priceRange: place.price_range ?? undefined,
    priceMin: place.price_min ?? undefined,
    priceMax: place.price_max ?? undefined,
    bestTime: place.best_time || undefined,
    bestTimes: place.best_times?.length ? place.best_times : undefined,
    atmosphere: place.atmosphere?.length ? place.atmosphere : undefined,
    specialFeatures: place.special_features?.length ? place.special_features : undefined,
    photos: place.list_place_photos
      ?.slice()
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((item) => item.url),
    likes: likedBy.length,
    likedBy: likedBy.length ? likedBy : undefined,
    likeDetails: likeDetails.length ? likeDetails : undefined,
    comments,
    addedAt: place.added_at,
    updatedAt: place.updated_at,
    addedBy: addedByUser
      ? {
          userId: addedByUser.id,
          userName: addedByUser.name,
          userAvatar: addedByUser.profilePhoto,
        }
      : undefined,
  };
}

function mapList(list: ListRecord, usersById: Map<string, User>): PlaceList {
  const places = (list.list_places || [])
    .slice()
    .sort((left, right) => new Date(right.added_at).getTime() - new Date(left.added_at).getTime())
    .map((place) => mapPlace(place, usersById));
  const likeDetails = (list.list_likes || [])
    .slice()
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .map((item) => ({
      userId: item.user_id,
      createdAt: item.created_at,
    }));
  const likedBy = likeDetails.map((item) => item.userId);

  return {
    id: list.id,
    userId: list.owner_id,
    name: list.name,
    description: list.description || undefined,
    emoji: list.emoji || undefined,
    coverImage: normalizeListCoverUrl(list.cover_image_url),
    places,
    isPublic: list.is_public,
    likes: likedBy.length,
    likedBy: likedBy.length ? likedBy : undefined,
    likeDetails: likeDetails.length ? likeDetails : undefined,
    createdAt: list.created_at,
    updatedAt: list.updated_at,
  };
}

export function createStorageReadsRepository({
  supabase,
  getUsersCache,
  setUsersCache,
  setListsCache,
  getCurrentUserCache,
  setCurrentUserCache,
  setBlockRowsCache,
  repairListCoverImage,
  isMissingFollowRequestsSchemaError,
  isMissingUserBlocksSchemaError,
  isMissingPlaceCommentLikeSchemaError,
  isMissingListPlaceUpdatedAtSchemaError,
}: StorageReadsDependencies) {
  let refreshUsersPromise: Promise<void> | null = null;
  const refreshListsPromises = new Map<string, Promise<void>>();
  const refreshLegacyListsPromises = new Map<string, Promise<void>>();

  function getViewerCacheKey(userId?: string | null) {
    return userId || '__public__';
  }

  return {
    async refreshUsers() {
      if (refreshUsersPromise) {
        return refreshUsersPromise;
      }

      const task = (async () => {
        const [
          { data: profiles, error: profilesError },
          { data: follows, error: followsError },
          { data: blocks, error: blocksError },
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select(
              'id, email, name, username, is_public_account, bio, profile_photo_url, cover_photo_url, interests, created_at, updated_at',
            )
            .order('created_at', { ascending: false }),
          supabase.from('user_follows').select('follower_id, following_id, created_at'),
          supabase.from('user_blocks').select('blocker_user_id, blocked_user_id, created_at'),
        ]);

        if (profilesError) {
          throw profilesError;
        }

        if (followsError) {
          throw followsError;
        }

        if (blocksError && !isMissingUserBlocksSchemaError(blocksError)) {
          throw blocksError;
        }

        const { data: followRequests, error: followRequestsError } = await supabase
          .from('follow_requests')
          .select('id, requester_id, target_user_id, status, created_at, responded_at');

        if (followRequestsError && !isMissingFollowRequestsSchemaError(followRequestsError)) {
          throw followRequestsError;
        }

        const nextBlockRows = ((blocksError ? [] : (blocks || [])) as UserBlockRow[]);
        setBlockRowsCache(nextBlockRows);
        setUsersCache(
          buildUsers(
            (profiles || []) as ProfileRow[],
            (follows || []) as FollowRow[],
            (followRequestsError ? [] : (followRequests || [])) as FollowRequestRow[],
            nextBlockRows,
          ),
        );

        const currentUser = getCurrentUserCache();

        if (currentUser) {
          setCurrentUserCache(getUsersCache().find((item) => item.id === currentUser.id) || currentUser);
        }
      })();

      refreshUsersPromise = task;

      try {
        await task;
      } finally {
        if (refreshUsersPromise === task) {
          refreshUsersPromise = null;
        }
      }
    },

    async refreshListsLegacy(currentUserId?: string) {
      const cacheKey = getViewerCacheKey(currentUserId);
      const existingPromise = refreshLegacyListsPromises.get(cacheKey);

      if (existingPromise) {
        return existingPromise;
      }

      const task = (async () => {
        const buildLegacyQuery = (includePlaceUpdatedAt: boolean) => {
          const placeUpdatedAtSelection = includePlaceUpdatedAt ? 'updated_at,' : '';

          let query = supabase
            .from('lists')
            .select(
              `
                id,
                owner_id,
                name,
                description,
                emoji,
                cover_image_url,
                is_public,
                created_at,
                updated_at,
                list_likes (
                  list_id,
                  user_id,
                  created_at
                ),
                list_places (
                  id,
                  list_id,
                  created_by,
                  name,
                  title,
                  lat,
                  lng,
                  address,
                  notes,
                  rating,
                  category,
                  categories,
                  student_discount,
                  price_range,
                  price_min,
                  price_max,
                  best_time,
                  best_times,
                  atmosphere,
                  special_features,
                  added_at,
                  ${placeUpdatedAtSelection}
                  list_place_likes (
                    list_place_id,
                    user_id,
                    created_at
                  ),
                  list_place_comments (
                    id,
                    list_place_id,
                    user_id,
                    content,
                    created_at,
                    updated_at
                  ),
                  list_place_photos (
                    id,
                    list_place_id,
                    url,
                    sort_order,
                    created_at
                  )
                )
              `,
            )
            .order('updated_at', { ascending: false });

          if (currentUserId) {
            query = query.or(`is_public.eq.true,owner_id.eq.${currentUserId}`);
          } else {
            query = query.eq('is_public', true);
          }

          return query;
        };

        let { data, error } = await buildLegacyQuery(true);

        if (error && isMissingListPlaceUpdatedAtSchemaError(error)) {
          ({ data, error } = await buildLegacyQuery(false));
        }

        if (error) {
          throw error;
        }

        let listRecords = (data || []) as ListRecord[];

        if (currentUserId) {
          listRecords = await Promise.all(
            listRecords.map((item) =>
              item.owner_id === currentUserId && isLocalMediaUri(item.cover_image_url)
                ? repairListCoverImage(item)
                : item,
            ),
          );
        }

        const usersById = new Map(getUsersCache().map((item) => [item.id, item]));
        setListsCache(listRecords.map((item) => mapList(item, usersById)));
      })();

      refreshLegacyListsPromises.set(cacheKey, task);

      try {
        await task;
      } finally {
        if (refreshLegacyListsPromises.get(cacheKey) === task) {
          refreshLegacyListsPromises.delete(cacheKey);
        }
      }
    },

    async refreshLists(currentUserId?: string) {
      const cacheKey = getViewerCacheKey(currentUserId);
      const existingPromise = refreshListsPromises.get(cacheKey);

      if (existingPromise) {
        return existingPromise;
      }

      const task = (async () => {
        const buildListsQuery = (includeCommentSocial: boolean, includePlaceUpdatedAt: boolean) => {
          const commentSelection = includeCommentSocial
            ? `
                list_place_comments (
                  id,
                  list_place_id,
                  user_id,
                  parent_comment_id,
                  content,
                  created_at,
                  updated_at,
                  list_place_comment_likes (
                    comment_id,
                    user_id,
                    created_at
                  )
                ),
              `
            : `
                list_place_comments (
                  id,
                  list_place_id,
                  user_id,
                  content,
                  created_at,
                  updated_at
                ),
              `;
          const placeUpdatedAtSelection = includePlaceUpdatedAt ? 'updated_at,' : '';

          let query = supabase
            .from('lists')
            .select(
              `
                id,
                owner_id,
                name,
                description,
                emoji,
                cover_image_url,
                is_public,
                created_at,
                updated_at,
                list_likes (
                  list_id,
                  user_id,
                  created_at
                ),
                list_places (
                  id,
                  list_id,
                  created_by,
                  name,
                  title,
                  lat,
                  lng,
                  address,
                  notes,
                  rating,
                  category,
                  categories,
                  student_discount,
                  price_range,
                  price_min,
                  price_max,
                  best_time,
                  best_times,
                  atmosphere,
                  special_features,
                  added_at,
                  ${placeUpdatedAtSelection}
                  list_place_likes (
                    list_place_id,
                    user_id,
                    created_at
                  ),
                  ${commentSelection}
                  list_place_photos (
                    id,
                    list_place_id,
                    url,
                    sort_order,
                    created_at
                  )
                )
              `,
            )
            .order('updated_at', { ascending: false });

          if (currentUserId) {
            query = query.or(`is_public.eq.true,owner_id.eq.${currentUserId}`);
          } else {
            query = query.eq('is_public', true);
          }

          return query;
        };

        let includeCommentSocial = true;
        let includePlaceUpdatedAt = true;
        let { data, error } = await buildListsQuery(includeCommentSocial, includePlaceUpdatedAt);

        if (error && isMissingListPlaceUpdatedAtSchemaError(error)) {
          includePlaceUpdatedAt = false;
          ({ data, error } = await buildListsQuery(includeCommentSocial, includePlaceUpdatedAt));
        }

        if (error && isMissingPlaceCommentLikeSchemaError(error)) {
          includeCommentSocial = false;
          ({ data, error } = await buildListsQuery(includeCommentSocial, includePlaceUpdatedAt));
        }

        if (error && isMissingListPlaceUpdatedAtSchemaError(error) && includePlaceUpdatedAt) {
          includePlaceUpdatedAt = false;
          ({ data, error } = await buildListsQuery(includeCommentSocial, includePlaceUpdatedAt));
        }

        if (error) {
          throw error;
        }

        let listRecords = (data || []) as ListRecord[];

        if (currentUserId) {
          listRecords = await Promise.all(
            listRecords.map((item) =>
              item.owner_id === currentUserId && isLocalMediaUri(item.cover_image_url)
                ? repairListCoverImage(item)
                : item,
            ),
          );
        }

        const usersById = new Map(getUsersCache().map((item) => [item.id, item]));
        setListsCache(listRecords.map((item) => mapList(item, usersById)));
      })();

      refreshListsPromises.set(cacheKey, task);

      try {
        await task;
      } finally {
        if (refreshListsPromises.get(cacheKey) === task) {
          refreshListsPromises.delete(cacheKey);
        }
      }
    },
  };
}
