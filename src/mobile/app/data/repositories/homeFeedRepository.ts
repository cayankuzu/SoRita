import type { PlaceMedia } from '@/mobile/app/data/contracts/entities';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';
import { supabase } from '@/mobile/app/platform/supabase/client';
import {
  mapPlaceFeedCard,
  type PlaceFeedCardPayload,
} from '@/mobile/app/data/mappers/placeFeedCardMapper';

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

function toFeedCardPayload(row: HomeFeedRow): PlaceFeedCardPayload {
  return {
    address: row.address,
    addedAt: row.added_at,
    atmosphere: row.atmosphere,
    bestTime: row.best_time,
    bestTimes: row.best_times,
    category: row.category,
    categories: row.categories,
    commentCount: row.comment_count,
    lat: row.lat,
    likeCount: row.like_count,
    listCoverImageUrl: row.list_cover_image_url,
    listEmoji: row.list_emoji,
    listId: row.list_id,
    listIsPublic: row.list_is_public,
    listName: row.list_name,
    locationPlaceCardsCount: row.location_place_cards_count,
    lng: row.lng,
    media: row.media,
    menuUrl: row.menu_url,
    notes: row.notes,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    ownerProfilePhotoUrl: row.owner_profile_photo_url,
    ownerUsername: row.owner_username,
    placeId: row.place_id,
    placeName: row.place_name,
    placeTitle: row.place_title,
    priceMax: row.price_max,
    priceMin: row.price_min,
    priceRange: row.price_range,
    publishedAt: row.published_at,
    rating: row.rating,
    specialFeatures: row.special_features,
    studentDiscount: row.student_discount,
    updatedAt: row.updated_at,
    viewerHasLiked: row.viewer_has_liked,
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
  const items = rows.map((row) => mapPlaceFeedCard(toFeedCardPayload(row), params.viewerId));
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
