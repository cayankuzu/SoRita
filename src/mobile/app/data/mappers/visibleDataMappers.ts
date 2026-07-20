import type { Place, PlaceComment, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import {
  normalizeListCoverUrl,
  normalizeStoredMediaUrl,
} from '@/mobile/app/data/mappers/mediaUrlMappers';
import { normalizeOptionalMultilineText } from '@/mobile/app/shared/validation/contentLimits';
import {
  getPlacePhotoUrls,
  normalizePlaceMedia,
} from '@/mobile/app/shared/utils/placeMedia';
import { uniqueStrings } from '@/mobile/app/shared/utils/format';
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
  PublicProfileRow,
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
  is_pending?: boolean;
  like_count?: number;
  list_place_comment_likes?: ListPlaceCommentLikeRow[] | null;
  viewer_has_liked?: boolean;
};

function appendGroupedValue(map: Map<string, string[]>, key: string, value: string) {
  const existingValues = map.get(key);

  if (existingValues) {
    existingValues.push(value);
    return;
  }

  map.set(key, [value]);
}

export function buildUsers(
  profiles: Array<ProfileRow | PublicProfileRow>,
  follows: FollowRow[],
  followRequests: FollowRequestRow[],
  blockRows: UserBlockRow[],
): User[] {
  const followingByUserId = new Map<string, string[]>();
  const followersByUserId = new Map<string, string[]>();
  const pendingRequestsSentByUserId = new Map<string, string[]>();
  const pendingRequestsReceivedByUserId = new Map<string, string[]>();
  const blockedUsersByUserId = new Map<string, string[]>();
  const blockedByUsersByUserId = new Map<string, string[]>();

  for (const follow of follows) {
    appendGroupedValue(followingByUserId, follow.follower_id, follow.following_id);
    appendGroupedValue(followersByUserId, follow.following_id, follow.follower_id);
  }

  for (const request of followRequests) {
    if (request.status !== 'pending') {
      continue;
    }

    appendGroupedValue(pendingRequestsSentByUserId, request.requester_id, request.target_user_id);
    appendGroupedValue(
      pendingRequestsReceivedByUserId,
      request.target_user_id,
      request.requester_id,
    );
  }

  for (const blockRow of blockRows) {
    appendGroupedValue(blockedUsersByUserId, blockRow.blocker_user_id, blockRow.blocked_user_id);
    appendGroupedValue(blockedByUsersByUserId, blockRow.blocked_user_id, blockRow.blocker_user_id);
  }

  return profiles.map((profile) => {
    const following = followingByUserId.get(profile.id) || [];
    const followers = followersByUserId.get(profile.id) || [];
    const pendingFollowRequestsSent = pendingRequestsSentByUserId.get(profile.id) || [];
    const pendingFollowRequestsReceived = pendingRequestsReceivedByUserId.get(profile.id) || [];
    const blockedUsers = blockedUsersByUserId.get(profile.id) || [];
    const blockedByUsers = blockedByUsersByUserId.get(profile.id) || [];

    return {
      id: profile.id,
      email: 'email' in profile ? profile.email : '',
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

export function mapPlaceComments(
  commentRecords: ListPlaceCommentRecord[],
  usersById: Map<string, User>,
) {
  const orderedCommentRecords = commentRecords
    .slice()
    .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
  const commentsById = new Map<string, PlaceComment>();

  for (const comment of orderedCommentRecords) {
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
      isPending: Boolean(comment.is_pending),
      likes: comment.like_count ?? commentLikedBy.length,
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

  for (const comment of orderedCommentRecords) {
    const mappedComment = commentsById.get(comment.id)!;

    if (comment.parent_comment_id && commentsById.has(comment.parent_comment_id)) {
      const parentComment = commentsById.get(comment.parent_comment_id)!;
      parentComment.replies!.push(mappedComment);

      continue;
    }

    topLevelComments.push(mappedComment);
  }

  const comments = topLevelComments
    .slice()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  return comments;
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
  const mappedMedia = normalizePlaceMedia(
    place.list_place_photos
      ?.slice()
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((item) => ({
        durationMs: item.duration_ms ?? undefined,
        height: item.height ?? undefined,
        id: item.id,
        mimeType: item.mime_type ?? undefined,
        thumbnailUrl: normalizeStoredMediaUrl(item.thumbnail_url),
        type: item.media_type,
        url: item.url,
        width: item.width ?? undefined,
      })),
  );
  const likeDetails = (place.list_place_likes || [])
    .slice()
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .map((item) => ({
      userId: item.user_id,
      createdAt: item.created_at,
    }));
  const likedBy = likeDetails.map((item) => item.userId);
  const comments = mapPlaceComments((place.list_place_comments || []) as ListPlaceCommentRecord[], usersById);
  const countCommentTree = (items: PlaceComment[]): number =>
    items.reduce((total, comment) => total + 1 + countCommentTree(comment.replies!), 0);

  return {
    id: place.id,
    name: place.name,
    title: normalizeOptionalMultilineText(place.title),
    menuUrl: place.menu_url || undefined,
    lat: place.lat,
    lng: place.lng,
    address: place.address || undefined,
    notes: normalizeOptionalMultilineText(place.notes),
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
    media: mappedMedia,
    photos: getPlacePhotoUrls({ media: mappedMedia }),
    likes: likedBy.length,
    likedBy: likedBy.length ? likedBy : undefined,
    likeDetails: likeDetails.length ? likeDetails : undefined,
    comments,
    commentCount: countCommentTree(comments),
    addedAt: place.added_at,
    updatedAt: place.updated_at,
    addedBy: addedByUser
      ? {
          userId: addedByUser.id,
          userName: addedByUser.name,
          userAvatar: addedByUser.profilePhoto,
        }
      : undefined,
    sourceAttribution: place.source_place_id
      ? {
          listId: place.source_list_id || undefined,
          placeId: place.source_place_id,
          placeName: place.source_place_name || undefined,
          userAvatar: place.source_user_avatar_url || undefined,
          userId: place.source_user_id || undefined,
          userName: place.source_user_name || 'SoRita',
        }
      : undefined,
  };
}

export function mapList(list: ListRecord, usersById: Map<string, User>): PlaceList {
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
    description: normalizeOptionalMultilineText(list.description),
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
