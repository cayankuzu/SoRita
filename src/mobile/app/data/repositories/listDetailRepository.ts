import type { Place, PlaceList, PlaceMedia, User } from '@/mobile/app/data/contracts/entities';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { normalizePlaceMedia } from '@/mobile/app/shared/utils/placeMedia';

export type ListPlacesCursor = {
  addedAt: string;
  id: string;
};

export type ListDetailHeader = {
  list: Omit<PlaceList, 'places'>;
  owner: User;
  placeCount: number;
};

export type ListPlacesPage = {
  items: Place[];
  nextCursor?: ListPlacesCursor;
};

type ListHeaderRow = {
  list_id: string;
  owner_id: string;
  owner_name: string;
  owner_username: string;
  owner_profile_photo_url?: string | null;
  list_name: string;
  list_description?: string | null;
  list_emoji?: string | null;
  list_cover_image_url?: string | null;
  list_is_public: boolean;
  created_at: string;
  updated_at: string;
  like_count?: number | string | null;
  viewer_has_liked?: boolean | null;
  place_count?: number | string | null;
};

export type ListPlaceRow = {
  place_id: string;
  added_at: string;
  updated_at: string;
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
  media?: PlaceMedia[] | string | null;
  like_count?: number | string | null;
  comment_count?: number | string | null;
  viewer_has_liked?: boolean | null;
};

const LIST_PLACES_PAGE_SIZE = 24;

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

function parseMedia(value: ListPlaceRow['media']) {
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

export function mapPlaceRow(row: ListPlaceRow, viewerId?: string | null): Place {
  const media = parseMedia(row.media);

  return {
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
    likes: toNumber(row.like_count) || 0,
    likedBy: row.viewer_has_liked && viewerId ? [viewerId] : undefined,
    commentCount: toNumber(row.comment_count) || 0,
    addedAt: row.added_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchListDetailHeader(listId: string): Promise<ListDetailHeader | null> {
  const { data, error } = await supabase.rpc('list_detail_header', {
    p_list_id: listId,
  });

  if (error) {
    throw error;
  }

  const row = (((data || []) as unknown) as ListHeaderRow[])[0];

  if (!row) {
    return null;
  }

  const owner: User = {
    id: row.owner_id,
    email: '',
    name: row.owner_name,
    username: row.owner_username,
    profilePhoto: row.owner_profile_photo_url || undefined,
  };

  return {
    owner,
    placeCount: toNumber(row.place_count) || 0,
    list: {
      id: row.list_id,
      userId: row.owner_id,
      name: row.list_name,
      description: row.list_description || undefined,
      emoji: row.list_emoji || undefined,
      coverImage: row.list_cover_image_url || undefined,
      isPublic: row.list_is_public,
      likes: toNumber(row.like_count) || 0,
      likedBy: row.viewer_has_liked ? [row.owner_id] : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  };
}

export async function fetchListPlacesPage(params: {
  cursor?: ListPlacesCursor | null;
  listId: string;
  limit?: number;
  viewerId?: string | null;
}): Promise<ListPlacesPage> {
  const { data, error } = await supabase.rpc('list_places_page', {
    p_cursor_added_at: params.cursor?.addedAt ?? null,
    p_cursor_id: params.cursor?.id ?? null,
    p_limit: params.limit ?? LIST_PLACES_PAGE_SIZE,
    p_list_id: params.listId,
  });

  if (error) {
    throw error;
  }

  const rows = ((data || []) as unknown) as ListPlaceRow[];
  const items = rows.map((row) => mapPlaceRow(row, params.viewerId));
  const lastRow = rows[rows.length - 1];

  return {
    items,
    nextCursor:
      rows.length >= (params.limit ?? LIST_PLACES_PAGE_SIZE) && lastRow
        ? {
            addedAt: lastRow.added_at,
            id: lastRow.place_id,
          }
        : undefined,
  };
}
