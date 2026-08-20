import type { Place, PlaceList, PlaceMedia, User } from '@/mobile/app/data/contracts/entities';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { normalizePlaceMedia } from '@/mobile/app/shared/utils/placeMedia';

export type ProfileContentTab = 'gallery' | 'lists' | 'places';

export type ProfileContentCursor = {
  id: string;
  sortAt: string;
};

export type ProfileSummary = {
  canViewContent: boolean;
  followerCount: number;
  followingCount: number;
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

type ProfilePlacePayload = {
  address?: string | null;
  addedAt: string;
  atmosphere?: string[] | null;
  bestTime?: string | null;
  bestTimes?: string[] | null;
  category?: string | null;
  categories?: string[] | null;
  commentCount?: number | string | null;
  lat: number;
  likeCount?: number | string | null;
  listCoverImageUrl?: string | null;
  listEmoji?: string | null;
  listId: string;
  listIsPublic?: boolean | null;
  listName: string;
  listUpdatedAt?: string | null;
  locationPlaceCardsCount?: number | string | null;
  lng: number;
  media?: PlaceMedia[] | string | null;
  menuUrl?: string | null;
  notes?: string | null;
  ownerId: string;
  ownerName?: string | null;
  ownerProfilePhotoUrl?: string | null;
  ownerUsername?: string | null;
  placeId: string;
  placeName: string;
  placeTitle?: string | null;
  priceMax?: number | string | null;
  priceMin?: number | string | null;
  priceRange?: number | string | null;
  rating?: number | string | null;
  specialFeatures?: string[] | null;
  studentDiscount?: boolean | null;
  type?: string;
  updatedAt: string;
  viewerHasLiked?: boolean | null;
};

type ProfileContentPayload = ProfileListPayload & ProfilePlacePayload & {
  type?: 'list' | 'place';
};

const PROFILE_CONTENT_PAGE_SIZE = 24;

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

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

function parseMedia(value: ProfilePlacePayload['media']) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return normalizePlaceMedia(value);
  }

  try {
    return normalizePlaceMedia(JSON.parse(value) as PlaceMedia[]);
  } catch {
    return [];
  }
}

function mapOwner(payload: ProfilePlacePayload): User {
  return {
    id: payload.ownerId,
    email: '',
    name: payload.ownerName || '',
    username: payload.ownerUsername || '',
    profilePhoto: payload.ownerProfilePhotoUrl || undefined,
  };
}

function mapList(payload: ProfileListPayload, viewerId?: string | null): PlaceList {
  const updatedAt = payload.updatedAt || new Date(0).toISOString();

  return {
    id: payload.id,
    userId: payload.ownerId,
    name: payload.name,
    description: payload.description || undefined,
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

function mapPlace(payload: ProfilePlacePayload, viewerId?: string | null): PlaceFeedCardItem {
  const media = parseMedia(payload.media);
  const owner = mapOwner(payload);
  const listIsPublic = payload.listIsPublic !== false;
  const place: Place = {
    id: payload.placeId,
    name: payload.placeName,
    title: payload.placeTitle || undefined,
    menuUrl: payload.menuUrl || undefined,
    lat: payload.lat,
    lng: payload.lng,
    address: payload.address || undefined,
    notes: payload.notes || undefined,
    rating: toNumber(payload.rating),
    category: payload.category || undefined,
    categories: payload.categories?.length ? payload.categories : undefined,
    studentDiscount: Boolean(payload.studentDiscount),
    priceRange: toNumber(payload.priceRange),
    priceMin: toNumber(payload.priceMin),
    priceMax: toNumber(payload.priceMax),
    bestTime: payload.bestTime || undefined,
    bestTimes: payload.bestTimes?.length ? payload.bestTimes : undefined,
    atmosphere: payload.atmosphere?.length ? payload.atmosphere : undefined,
    specialFeatures: payload.specialFeatures?.length ? payload.specialFeatures : undefined,
    media,
    photos: media.filter((item) => item.type === 'photo').map((item) => item.url),
    likes: toNumber(payload.likeCount) || 0,
    likedBy: payload.viewerHasLiked && viewerId ? [viewerId] : undefined,
    commentCount: toNumber(payload.commentCount) || 0,
    addedAt: payload.addedAt,
    updatedAt: payload.updatedAt,
    addedBy: {
      userId: owner.id,
      userName: owner.name,
      userAvatar: owner.profilePhoto,
    },
  };

  return {
    key: `${payload.listId}:${payload.placeId}`,
    place,
    owner,
    ownerId: owner.id,
    listId: payload.listId,
    listName: payload.listName,
    listEmoji: payload.listEmoji || undefined,
    listIsPublic,
    listCoverImage: payload.listCoverImageUrl || undefined,
    memberships: [
      {
        listId: payload.listId,
        listName: payload.listName,
        listEmoji: payload.listEmoji || undefined,
        listIsPublic,
        listCoverImage: payload.listCoverImageUrl || undefined,
        updatedAt: payload.listUpdatedAt || payload.updatedAt,
      },
    ],
    locationPlaceCardsCount: toNumber(payload.locationPlaceCardsCount) || 1,
    sortTime: new Date(payload.updatedAt).getTime(),
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
      places.push(mapPlace(item, params.viewerId));
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
