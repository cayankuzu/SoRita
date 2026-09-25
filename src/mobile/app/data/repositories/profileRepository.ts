import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { normalizeOptionalMultilineText } from '@/mobile/app/shared/validation/contentLimits';
import {
  mapPlaceFeedCard,
  toNumber,
  type PlaceFeedCardPayload,
} from '@/mobile/app/data/mappers/placeFeedCardMapper';

export type ProfileContentTab = 'gallery' | 'lists' | 'places';

export type ProfileContentCursor = {
  id: string;
  sortAt: string;
};

export type ProfileSummary = {
  canViewContent: boolean;
  followerCount: number;
  followingCount: number;
  // Places the viewer may see that carry at least one photo or video: the Gallery tab.
  galleryCount: number;
  isBlockedByViewer: boolean;
  isBlockingViewer: boolean;
  listCount: number;
  placeCount: number;
  user: User;
  viewerHasFollowed: boolean;
  viewerHasPendingFollowRequest: boolean;
};

export type ProfileContentPage = {
  lists: PlaceList[];
  nextCursor?: ProfileContentCursor;
  places: PlaceFeedCardItem[];
};

type ProfileSummaryRow = {
  bio?: string | null;
  can_view_content?: boolean | null;
  cover_photo_url?: string | null;
  follower_count?: number | string | null;
  following_count?: number | string | null;
  gallery_count?: number | string | null;
  id: string;
  interests?: string[] | null;
  is_blocked_by_viewer?: boolean | null;
  is_blocking_viewer?: boolean | null;
  is_public_account?: boolean | null;
  list_count?: number | string | null;
  name: string;
  place_count?: number | string | null;
  profile_photo_url?: string | null;
  username: string;
  viewer_has_followed?: boolean | null;
  viewer_has_pending_follow_request?: boolean | null;
};

type ProfileContentRow = {
  item_id: string;
  item: unknown;
  sort_at: string;
};

type ProfileListPayload = {
  coverImageUrl?: string | null;
  createdAt?: string | null;
  description?: string | null;
  emoji?: string | null;
  id: string;
  isPublic?: boolean | null;
  likeCount?: number | string | null;
  name: string;
  ownerId: string;
  placeCount?: number | string | null;
  updatedAt?: string | null;
  viewerHasLiked?: boolean | null;
};

type ProfilePlacePayload = PlaceFeedCardPayload & { type?: string };

type ProfileContentPayload = ProfileListPayload & ProfilePlacePayload & {
  type?: 'list' | 'place';
};

const PROFILE_CONTENT_PAGE_SIZE = 24;

function parseItem<TPayload>(value: unknown): TPayload | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as TPayload;
    } catch {
      return null;
    }
  }

  return value as TPayload;
}

function mapList(payload: ProfileListPayload, viewerId?: string | null): PlaceList {
  const updatedAt = payload.updatedAt || new Date(0).toISOString();

  return {
    id: payload.id,
    userId: payload.ownerId,
    name: payload.name,
    description: normalizeOptionalMultilineText(payload.description),
    emoji: payload.emoji || undefined,
    coverImage: payload.coverImageUrl || undefined,
    places: [],
    placeCount: toNumber(payload.placeCount) || 0,
    isPublic: payload.isPublic !== false,
    likes: toNumber(payload.likeCount) || 0,
    likedBy: payload.viewerHasLiked && viewerId ? [viewerId] : undefined,
    createdAt: payload.createdAt || updatedAt,
    updatedAt,
  };
}

export async function fetchProfileSummary(
  userId: string,
  signal?: AbortSignal,
): Promise<ProfileSummary | null> {
  let request = supabase.rpc('profile_summary', {
    p_user_id: userId,
  });

  if (signal) {
    request = request.abortSignal(signal);
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  const row = (((data || []) as unknown) as ProfileSummaryRow[])[0];

  if (!row) {
    return null;
  }

  return {
    canViewContent: Boolean(row.can_view_content),
    followerCount: toNumber(row.follower_count) || 0,
    followingCount: toNumber(row.following_count) || 0,
    galleryCount: toNumber(row.gallery_count) || 0,
    isBlockedByViewer: Boolean(row.is_blocked_by_viewer),
    isBlockingViewer: Boolean(row.is_blocking_viewer),
    listCount: toNumber(row.list_count) || 0,
    placeCount: toNumber(row.place_count) || 0,
    user: {
      id: row.id,
      email: '',
      name: row.name,
      username: row.username,
      isPublicAccount: row.is_public_account !== false,
      profilePhoto: row.profile_photo_url || undefined,
      coverPhoto: row.cover_photo_url || undefined,
      bio: row.bio || undefined,
      interests: row.interests?.length ? row.interests : undefined,
    },
    viewerHasFollowed: Boolean(row.viewer_has_followed),
    viewerHasPendingFollowRequest: Boolean(row.viewer_has_pending_follow_request),
  };
}

export async function fetchProfileContentPage(params: {
  cursor?: ProfileContentCursor | null;
  limit?: number;
  signal?: AbortSignal;
  tab: ProfileContentTab;
  userId: string;
  viewerId?: string | null;
}): Promise<ProfileContentPage> {
  const limit = params.limit ?? PROFILE_CONTENT_PAGE_SIZE;
  let request = supabase.rpc('profile_content_page_complete', {
    p_cursor: params.cursor?.sortAt ?? null,
    p_cursor_id: params.cursor?.id ?? null,
    p_limit: limit,
    p_tab: params.tab,
    p_user_id: params.userId,
  });

  if (params.signal) {
    request = request.abortSignal(params.signal);
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  const rows = ((data || []) as unknown) as ProfileContentRow[];
  const lists: PlaceList[] = [];
  const places: PlaceFeedCardItem[] = [];

  rows.forEach((row) => {
    const item = parseItem<ProfileContentPayload>(row.item);

    if (!item) {
      return;
    }

    if (item.type === 'list') {
      lists.push(mapList(item, params.viewerId));
    } else if (item.type === 'place') {
      places.push(mapPlaceFeedCard(item, params.viewerId));
    }
  });

  const lastRow = rows[rows.length - 1];

  return {
    lists,
    places,
    nextCursor:
      rows.length >= limit && lastRow
        ? {
            id: lastRow.item_id,
            sortAt: lastRow.sort_at,
          }
        : undefined,
  };
}
