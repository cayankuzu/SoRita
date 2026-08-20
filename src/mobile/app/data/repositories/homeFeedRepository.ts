import type { Place, PlaceMedia, User } from '@/mobile/app/data/contracts/entities';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { normalizePlaceMedia } from '@/mobile/app/shared/utils/placeMedia';

export type HomeFeedCursor = {
  id: string;
  publishedAt: string;
};

export type HomeFeedPage = {
  items: PlaceFeedCardItem[];
  nextCursor?: HomeFeedCursor;
};

type HomeFeedRow = {
  feed_item_id: string;
  published_at: string;
  owner_id: string;
  owner_name: string;
  owner_username: string;
  owner_profile_photo_url?: string | null;
  list_id: string;
  list_name: string;
  list_emoji?: string | null;
  list_cover_image_url?: string | null;
  list_is_public: boolean;
  place_id: string;
  place_name: string;
  place_title?: string | null;
  menu_url?: string | null;
  lat: number;
  lng: number;
  address?: string | null;
  notes?: string | null;
  rating?: number | string | null;
  category?: string | null;
  categories?: string[] | null;
  student_discount?: boolean | null;
  price_range?: number | string | null;
  price_min?: number | string | null;
  price_max?: number | string | null;
  best_time?: string | null;
  best_times?: string[] | null;
  atmosphere?: string[] | null;
  special_features?: string[] | null;
  added_at: string;
  updated_at: string;
  media?: PlaceMedia[] | string | null;
  location_place_cards_count?: number | string | null;
  like_count?: number | string | null;
  comment_count?: number | string | null;
  viewer_has_liked?: boolean | null;
};

type CompleteHomeFeedRow = {
  item?: HomeFeedRow | string | null;
};

const HOME_FEED_PAGE_SIZE = 20;

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

function parseMedia(value: HomeFeedRow['media']) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return normalizePlaceMedia(value);
  }

  try {
    const parsed = JSON.parse(value) as PlaceMedia[];
    return normalizePlaceMedia(parsed);
  } catch {
    return [];
  }
}

function parseFeedRow(value: CompleteHomeFeedRow | HomeFeedRow): HomeFeedRow | null {
  const payload = Object.prototype.hasOwnProperty.call(value, 'item')
    ? (value as CompleteHomeFeedRow).item
    : value as HomeFeedRow;

  if (!payload) {
    return null;
  }

  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as HomeFeedRow;
    } catch {
      return null;
    }
  }

  return payload;
}

function mapFeedRow(row: HomeFeedRow, viewerId: string): PlaceFeedCardItem {
  const owner: User = {
    id: row.owner_id,
    email: '',
    name: row.owner_name,
    username: row.owner_username,
    profilePhoto: row.owner_profile_photo_url || undefined,
  };
  const media = parseMedia(row.media);
  const likes = toNumber(row.like_count) || 0;
  const commentCount = toNumber(row.comment_count) || 0;
  const place: Place = {
    id: row.place_id,
    name: row.place_name,
    title: row.place_title || undefined,
    menuUrl: row.menu_url || undefined,
    lat: row.lat,
    lng: row.lng,
    address: row.address || undefined,
    notes: row.notes || undefined,
    rating: toNumber(row.rating),
    category: row.category || undefined,
    categories: row.categories?.length ? row.categories : undefined,
    studentDiscount: Boolean(row.student_discount),
    priceRange: toNumber(row.price_range),
    priceMin: toNumber(row.price_min),
    priceMax: toNumber(row.price_max),
    bestTime: row.best_time || undefined,
    bestTimes: row.best_times?.length ? row.best_times : undefined,
    atmosphere: row.atmosphere?.length ? row.atmosphere : undefined,
    specialFeatures: row.special_features?.length ? row.special_features : undefined,
    media,
    photos: media.filter((item) => item.type === 'photo').map((item) => item.url),
    likes,
    likedBy: row.viewer_has_liked ? [viewerId] : undefined,
    commentCount,
    addedAt: row.added_at,
    updatedAt: row.updated_at,
    addedBy: {
      userId: row.owner_id,
      userName: row.owner_name,
      userAvatar: row.owner_profile_photo_url || undefined,
    },
  };

  return {
    key: `${row.list_id}:${row.place_id}`,
    place,
    owner,
    ownerId: row.owner_id,
    listId: row.list_id,
    listName: row.list_name,
    listEmoji: row.list_emoji || undefined,
    listIsPublic: row.list_is_public,
    listCoverImage: row.list_cover_image_url || undefined,
    memberships: [
      {
        listId: row.list_id,
        listName: row.list_name,
        listEmoji: row.list_emoji || undefined,
        listIsPublic: row.list_is_public,
        listCoverImage: row.list_cover_image_url || undefined,
        updatedAt: row.updated_at,
      },
    ],
    locationPlaceCardsCount: toNumber(row.location_place_cards_count) || 1,
    sortTime: new Date(row.published_at || row.updated_at).getTime(),
  };
}

export async function fetchHomeFeedPage(params: {
  cursor?: HomeFeedCursor | null;
  limit?: number;
  signal?: AbortSignal;
  viewerId: string;
}): Promise<HomeFeedPage> {
  let request = supabase.rpc('feed_page_complete', {
    p_cursor_id: params.cursor?.id ?? null,
    p_cursor_published_at: params.cursor?.publishedAt ?? null,
    p_limit: params.limit ?? HOME_FEED_PAGE_SIZE,
  });

  if (params.signal) {
    request = request.abortSignal(params.signal);
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  const rows = (((data || []) as unknown) as Array<CompleteHomeFeedRow | HomeFeedRow>)
    .map(parseFeedRow)
    .filter((row): row is HomeFeedRow => Boolean(row));
  const items = rows.map((row) => mapFeedRow(row, params.viewerId));
  const lastRow = rows[rows.length - 1];

  return {
    items,
    nextCursor:
      rows.length >= (params.limit ?? HOME_FEED_PAGE_SIZE) && lastRow
        ? {
            id: lastRow.feed_item_id,
            publishedAt: lastRow.published_at,
          }
        : undefined,
  };
}
