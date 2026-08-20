import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
import {
  mapPlaceRow,
  type ListPlaceRow,
} from '@/mobile/app/data/repositories/listDetailRepository';
import {
  fetchProfileContentPage,
  type ProfileContentCursor,
} from '@/mobile/app/data/repositories/profileRepository';
import { supabase } from '@/mobile/app/platform/supabase/client';
import type { MarkerVisibilityState } from '@/mobile/app/shared/utils/markerColors';
import { normalizeSearchText } from '@/mobile/app/shared/utils/textSort';

export type LocationPlaceCardsCursor = {
  id: string;
  updatedAt: string;
};

export type LocationPlaceCardEntry = {
  list: PlaceList;
  owner: User;
  place: ReturnType<typeof mapPlaceRow>;
};

export type LocationPlaceCardsPage = {
  items: LocationPlaceCardEntry[];
  nextCursor?: LocationPlaceCardsCursor;
  markerVisibility: MarkerVisibilityState;
  totalCount: number;
};

type LocationPlaceCardRow = ListPlaceRow & {
  list_id: string;
  list_owner_id: string;
  list_name: string;
  list_description?: string | null;
  list_emoji?: string | null;
  list_cover_image_url?: string | null;
  list_is_public: boolean;
  list_created_at: string;
  list_updated_at: string;
  owner_name: string;
  owner_username: string;
  owner_profile_photo_url?: string | null;
  owner_is_public_account?: boolean | null;
  has_public_list?: boolean | null;
  has_private_list?: boolean | null;
  total_count?: number | string | null;
};

const LOCATION_CARDS_PAGE_SIZE = 16;
const LOCATION_FALLBACK_PAGE_SIZE = 50;
const LOCATION_FALLBACK_MAX_PAGES = 20;

function toCount(value: number | string | null | undefined) {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function isMissingLocationCardsRpc(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const message = typeof candidate.message === 'string' ? candidate.message : '';

  return code === 'PGRST202' || message.includes('location_place_cards_page');
}

function isSameLocation(
  left: { lat: number; lng: number },
  right: { lat: number; lng: number },
) {
  return left.lat.toFixed(5) === right.lat.toFixed(5)
    && left.lng.toFixed(5) === right.lng.toFixed(5);
}

async function fetchLocationPlaceCardsFallback(params: {
  lat: number;
  lng: number;
  ownerId: string;
  placeName?: string | null;
  viewerId?: string | null;
}): Promise<LocationPlaceCardsPage> {
  const matchingPlaces = [] as Awaited<
    ReturnType<typeof fetchProfileContentPage>
  >['places'];
  const normalizedPlaceName = normalizeSearchText(params.placeName || '');
  let cursor: ProfileContentCursor | null = null;

  for (let pageIndex = 0; pageIndex < LOCATION_FALLBACK_MAX_PAGES; pageIndex += 1) {
    const page = await fetchProfileContentPage({
      cursor,
      limit: LOCATION_FALLBACK_PAGE_SIZE,
      tab: 'places',
      userId: params.ownerId,
      viewerId: params.viewerId,
    });

    matchingPlaces.push(
      ...page.places.filter(({ place }) => (
        isSameLocation(place, params)
        && (!normalizedPlaceName || normalizeSearchText(place.name) === normalizedPlaceName)
      )),
    );

    if (!page.nextCursor) {
      break;
    }

    cursor = page.nextCursor;
  }

  const items = matchingPlaces.map((item) => {
    const membership = item.memberships.find(({ listId }) => listId === item.listId);
    const owner = item.owner || {
      email: '',
      id: item.ownerId,
      name: '',
      username: '',
    };
    const list: PlaceList = {
      coverImage: item.listCoverImage,
      createdAt: item.place.addedAt,
      emoji: item.listEmoji,
      id: item.listId,
      isPublic: item.listIsPublic,
      name: item.listName,
      places: [item.place],
      updatedAt: membership?.updatedAt || item.place.updatedAt || item.place.addedAt,
      userId: item.ownerId,
    };

    return { list, owner, place: item.place };
  });
  const hasPublicList = items.some(({ list }) => list.isPublic);
  const hasPrivateList = items.some(({ list }) => !list.isPublic);
  const authoritativeCount = matchingPlaces.reduce(
    (count, item) => Math.max(count, item.locationPlaceCardsCount || 0),
    0,
  );

  return {
    items,
    markerVisibility:
      hasPublicList && hasPrivateList
        ? 'mixed'
        : hasPrivateList
          ? 'private'
          : 'public',
    totalCount: Math.max(items.length, authoritativeCount),
  };
}

export async function fetchLocationPlaceCardsPage(params: {
  cursor?: LocationPlaceCardsCursor | null;
  lat: number;
  limit?: number;
  lng: number;
  ownerId?: string | null;
  placeName?: string | null;
  viewerId?: string | null;
}): Promise<LocationPlaceCardsPage> {
  const limit = params.limit ?? LOCATION_CARDS_PAGE_SIZE;
  const { data, error } = await supabase.rpc('location_place_cards_page', {
    p_cursor_id: params.cursor?.id ?? null,
    p_cursor_updated_at: params.cursor?.updatedAt ?? null,
    p_lat: params.lat,
    p_limit: limit,
    p_lng: params.lng,
    p_owner_id: params.ownerId ?? null,
    p_place_name: params.placeName?.trim() || null,
  });

  if (error) {
    if (params.ownerId && isMissingLocationCardsRpc(error)) {
      return fetchLocationPlaceCardsFallback({
        lat: params.lat,
        lng: params.lng,
        ownerId: params.ownerId,
        placeName: params.placeName,
        viewerId: params.viewerId,
      });
    }

    throw error;
  }

  const rows = ((data || []) as unknown) as LocationPlaceCardRow[];
  const items = rows.map((row) => {
    const place = mapPlaceRow(row, params.viewerId);
    const owner: User = {
      email: '',
      id: row.list_owner_id,
      isPublicAccount: row.owner_is_public_account ?? undefined,
      name: row.owner_name,
      profilePhoto: row.owner_profile_photo_url || undefined,
      username: row.owner_username,
    };
    const list: PlaceList = {
      coverImage: row.list_cover_image_url || undefined,
      createdAt: row.list_created_at,
      description: row.list_description || undefined,
      emoji: row.list_emoji || undefined,
      id: row.list_id,
      isPublic: row.list_is_public,
      name: row.list_name,
      places: [place],
      updatedAt: row.list_updated_at,
      userId: row.list_owner_id,
    };

    return { list, owner, place };
  });
  const lastRow = rows[rows.length - 1];

  return {
    items,
    markerVisibility:
      rows[0]?.has_public_list && rows[0]?.has_private_list
        ? 'mixed'
        : rows[0]?.has_private_list
          ? 'private'
          : 'public',
    nextCursor:
      rows.length >= limit && lastRow
        ? { id: lastRow.place_id, updatedAt: lastRow.updated_at }
        : undefined,
    totalCount: toCount(rows[0]?.total_count),
  };
}
