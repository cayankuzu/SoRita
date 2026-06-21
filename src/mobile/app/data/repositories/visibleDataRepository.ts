import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { mapList, buildUsers } from '@/mobile/app/data/mappers/visibleDataMappers';
import {
  getBlockStateForUsers,
  getVisibleListsFor,
  getVisibleUsersFor,
} from '@/mobile/app/data/selectors/visibility';
import { supabase } from '@/mobile/app/platform/supabase/client';
import type {
  FollowRequestRow,
  FollowRow,
  ListLikeRow,
  ListPlaceCommentLikeRow,
  ListPlaceCommentRow,
  ListPlaceLikeRow,
  ListPlacePhotoRow,
  ListPlaceRow,
  ListRow,
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

export type VisibleDataSnapshot = {
  allUsers: User[];
  blockRows: UserBlockRow[];
  currentUser: User | null;
  lists: PlaceList[];
  users: User[];
};

export type VisibleDataContext = {
  allUsers: User[];
  blockRows: UserBlockRow[];
  currentUser: User | null;
  users: User[];
};

type VisibleDataPageLimits = {
  commentsPerPlace: number;
  lists: number;
  mediaPerPlace: number;
  placesPerList: number;
  users: number;
};

const DEFAULT_VISIBLE_DATA_LIMITS: VisibleDataPageLimits = {
  commentsPerPlace: 24,
  lists: 120,
  mediaPerPlace: 9,
  placesPerList: 120,
  users: 400,
};
const PUBLIC_PROFILES_TABLE = 'public_profile_summaries';

function buildListsSelect(includePlaceComments: boolean) {
  const placeCommentsSelect = includePlaceComments
    ? `,
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
          )`
    : '';

  return `
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
        list_places:list_places!list_places_list_id_fkey (
          id,
          list_id,
          created_by,
          source_list_id,
          source_place_id,
          source_place_name,
          source_user_avatar_url,
          source_user_id,
          source_user_name,
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
          updated_at,
          list_place_likes (
            list_place_id,
            user_id,
            created_at
          ),
          list_place_photos (
            id,
            list_place_id,
            url,
            media_type,
            mime_type,
            duration_ms,
            thumbnail_url,
            width,
            height,
            sort_order,
            created_at
          )${placeCommentsSelect}
        )
      `;
}

async function getActiveSessionUser() {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      return null;
    }

    return session?.user ?? null;
  } catch {
    return null;
  }
}

async function attachCurrentSessionEmail(users: User[], userId?: string | null) {
  if (!userId) {
    return users;
  }

  try {
    const authUser = await getActiveSessionUser();

    if (authUser?.id !== userId || !authUser.email) {
      return users;
    }

    return users.map((user) =>
      user.id === userId
        ? {
            ...user,
            email: authUser.email ?? user.email,
          }
        : user
    );
  } catch {
    return users;
  }
}

async function getCurrentViewerId() {
  try {
    const authUser = await getActiveSessionUser();
    return authUser?.id ?? null;
  } catch {
    return null;
  }
}

async function fetchUsersAndBlocks(pageLimits: VisibleDataPageLimits) {
  const [
    { data: profiles, error: profilesError },
    { data: follows, error: followsError },
    { data: followRequests, error: followRequestsError },
    { data: blocks, error: blocksError },
  ] = await Promise.all([
    supabase
      .from(PUBLIC_PROFILES_TABLE)
      .select(
        'id, name, username, is_public_account, bio, profile_photo_url, cover_photo_url, interests, created_at, updated_at',
      )
      .order('created_at', { ascending: false })
      .range(0, pageLimits.users - 1),
    supabase.from('user_follows').select('follower_id, following_id, created_at'),
    supabase
      .from('follow_requests')
      .select('id, requester_id, target_user_id, status, created_at, responded_at'),
    supabase.from('user_blocks').select('blocker_user_id, blocked_user_id, created_at'),
  ]);

  if (profilesError) {
    throw profilesError;
  }

  if (followsError) {
    throw followsError;
  }

  if (followRequestsError) {
    throw followRequestsError;
  }

  if (blocksError) {
    throw blocksError;
  }

  const blockRows = (blocks || []) as UserBlockRow[];

  return {
    blockRows,
    users: buildUsers(
      (profiles || []) as PublicProfileRow[],
      (follows || []) as FollowRow[],
      (followRequests || []) as FollowRequestRow[],
      blockRows,
    ),
  };
}

async function fetchLists(
  params: {
    allUsers: User[];
    includePlaceComments?: boolean;
    limit: number;
    listId?: string;
    offset?: number;
    ownerId?: string;
    publicOnly?: boolean;
    viewerId?: string | null;
  },
) {
  const pageLimits = DEFAULT_VISIBLE_DATA_LIMITS;
  const {
    allUsers,
    includePlaceComments = false,
    limit,
    listId,
    offset = 0,
    ownerId,
    publicOnly = false,
    viewerId,
  } = params;
  let query = supabase
    .from('lists')
    .select(buildListsSelect(includePlaceComments))
    .order('updated_at', { ascending: false })
    .limit(pageLimits.placesPerList, {
      foreignTable: 'list_places!list_places_list_id_fkey',
    })
    .limit(pageLimits.mediaPerPlace, {
      foreignTable: 'list_places!list_places_list_id_fkey.list_place_photos',
    })
    .range(offset, offset + limit - 1);

  if (includePlaceComments) {
    query = query.limit(pageLimits.commentsPerPlace, {
      foreignTable: 'list_places!list_places_list_id_fkey.list_place_comments',
    });
  }

  if (listId) {
    query = query.eq('id', listId);
  }

  if (ownerId) {
    query = query.eq('owner_id', ownerId);
  }

  if (publicOnly) {
    query = query.eq('is_public', true);
  } else if (!ownerId && !listId) {
    if (viewerId) {
      query = query.or(`is_public.eq.true,owner_id.eq.${viewerId}`);
    } else {
      query = query.eq('is_public', true);
    }
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const usersById = new Map(allUsers.map((item) => [item.id, item]));
  return (((data || []) as unknown) as ListRecord[]).map((list) => mapList(list, usersById));
}

export async function fetchVisibleDataContext(userId?: string | null): Promise<VisibleDataContext> {
  const pageLimits = DEFAULT_VISIBLE_DATA_LIMITS;
  const { users, blockRows } = await fetchUsersAndBlocks(pageLimits);
  const viewerId = userId || null;
  const usersWithSessionEmail = await attachCurrentSessionEmail(users, viewerId);

  return {
    allUsers: usersWithSessionEmail,
    blockRows,
    currentUser: viewerId ? usersWithSessionEmail.find((item) => item.id === viewerId) || null : null,
    users: getVisibleUsersFor(usersWithSessionEmail, blockRows, viewerId),
  };
}

export async function fetchVisibleListsPage(params: {
  allUsers: User[];
  blockRows: UserBlockRow[];
  includePlaceComments?: boolean;
  limit: number;
  listId?: string;
  offset?: number;
  ownerId?: string;
  publicOnly?: boolean;
  viewerId?: string | null;
}) {
  const mappedLists = await fetchLists(params);

  return getVisibleListsFor(
    mappedLists,
    params.blockRows,
    params.viewerId || null,
  );
}

export async function fetchVisibleUserById(userId: string) {
  const context = await fetchVisibleDataContext(await getCurrentViewerId());
  return context.users.find((item) => item.id === userId) || null;
}

export async function fetchUserByIdIncludingBlocked(userId: string) {
  const { users } = await fetchUsersAndBlocks(DEFAULT_VISIBLE_DATA_LIMITS);
  const usersWithSessionEmail = await attachCurrentSessionEmail(users, userId);
  return usersWithSessionEmail.find((item) => item.id === userId) || null;
}

export async function fetchBlockState(currentUserId: string, targetUserId: string) {
  const { blockRows } = await fetchUsersAndBlocks(DEFAULT_VISIBLE_DATA_LIMITS);
  return getBlockStateForUsers(blockRows, currentUserId, targetUserId);
}
