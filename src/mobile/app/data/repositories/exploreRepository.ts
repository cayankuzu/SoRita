import type { Place, PlaceList, PlaceMedia, User } from '@/mobile/app/data/contracts/entities';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { normalizePlaceMedia } from '@/mobile/app/shared/utils/placeMedia';

export type ExploreKind = 'all' | 'lists' | 'photos' | 'places' | 'users';

export type ExploreCursor = {
  id: string;
  rank: number;
};

export type ExploreListItem = {
  list: PlaceList;
  owner: User | null;
};

export type ExplorePage = {
  listItems: ExploreListItem[];
  nextCursor?: ExploreCursor;
  placeItems: PlaceFeedCardItem[];
  userItems: User[];
};

type ExploreRow = {
  item_id: string;
  kind: 'list' | 'place' | 'user';
  rank: number | string;
  item: unknown;
};

type ExploreListPayload = {
  coverImageUrl?: string | null;
  description?: string | null;
  emoji?: string | null;
  id: string;
  isPublic?: boolean | null;
  name: string;
  ownerId: string;
  ownerName?: string | null;
  ownerProfilePhotoUrl?: string | null;
  ownerUsername?: string | null;
  updatedAt?: string | null;
};

type ExploreUserPayload = {
  bio?: string | null;
  id: string;
  isPublicAccount?: boolean | null;
  name: string;
  profilePhotoUrl?: string | null;
  username: string;
};

type ExplorePlacePayload = {
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
  updatedAt: string;
  viewerHasLiked?: boolean | null;
};

const EXPLORE_PAGE_SIZE = 20;

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

function parseMedia(value: ExplorePlacePayload['media']) {
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

function mapOwner(payload: {
  ownerId: string;
  ownerName?: string | null;
  ownerProfilePhotoUrl?: string | null;
  ownerUsername?: string | null;
}): User | null {
  if (!payload.ownerId) {
    return null;
  }

  return {
    id: payload.ownerId,
    email: '',
    name: payload.ownerName || '',
    username: payload.ownerUsername || '',
    profilePhoto: payload.ownerProfilePhotoUrl || undefined,
  };
}

function mapListItem(payload: ExploreListPayload): ExploreListItem {
  return {
    owner: mapOwner(payload),
    list: {
      id: payload.id,
      userId: payload.ownerId,
      name: payload.name || '',
      description: payload.description || undefined,
      emoji: payload.emoji || undefined,
      coverImage: payload.coverImageUrl || undefined,
      places: [],
      isPublic: payload.isPublic !== false,
      createdAt: payload.updatedAt || new Date(0).toISOString(),
      updatedAt: payload.updatedAt || new Date(0).toISOString(),
    },
  };
}

function mapUserItem(payload: ExploreUserPayload): User {
  return {
    id: payload.id,
    email: '',
    name: payload.name,
    username: payload.username,
    bio: payload.bio || undefined,
    isPublicAccount: payload.isPublicAccount !== false,
    profilePhoto: payload.profilePhotoUrl || undefined,
  };
}

function mapPlaceItem(payload: ExplorePlacePayload, viewerId: string): PlaceFeedCardItem {
  const media = parseMedia(payload.media);
  const listIsPublic = payload.listIsPublic !== false;
  const owner = mapOwner(payload);
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
    likedBy: payload.viewerHasLiked ? [viewerId] : undefined,
    commentCount: toNumber(payload.commentCount) || 0,
    addedAt: payload.addedAt,
    updatedAt: payload.updatedAt,
    addedBy: owner
      ? {
          userId: owner.id,
          userName: owner.name,
          userAvatar: owner.profilePhoto,
        }
      : undefined,
  };

  return {
    key: `${payload.listId}:${payload.placeId}`,
    place,
    owner,
    ownerId: payload.ownerId,
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
    sortTime: new Date(payload.updatedAt).getTime(),
  };
}

export async function fetchExplorePage(params: {
  abortSignal?: AbortSignal;
  cursor?: ExploreCursor | null;
  kind?: ExploreKind;
  limit?: number;
  query?: string;
  viewerId: string;
}): Promise<ExplorePage> {
  const limit = params.limit ?? EXPLORE_PAGE_SIZE;
  let request = supabase.rpc('explore_page', {
    p_cursor_id: params.cursor?.id ?? null,
    p_cursor_rank: params.cursor?.rank ?? null,
    p_kind: params.kind ?? 'all',
    p_limit: limit,
    p_query: params.query ?? '',
  });

  if (params.abortSignal) {
    request = request.abortSignal(params.abortSignal);
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  const rows = ((data || []) as unknown) as ExploreRow[];
  const listItems: ExploreListItem[] = [];
  const placeItems: PlaceFeedCardItem[] = [];
  const userItems: User[] = [];

  rows.forEach((row) => {
    if (row.kind === 'list') {
      const item = parseItem<ExploreListPayload>(row.item);
      if (item) {
        listItems.push(mapListItem(item));
      }
    } else if (row.kind === 'place') {
      const item = parseItem<ExplorePlacePayload>(row.item);
      if (item) {
        placeItems.push(mapPlaceItem(item, params.viewerId));
      }
    } else if (row.kind === 'user') {
      const item = parseItem<ExploreUserPayload>(row.item);
      if (item) {
        userItems.push(mapUserItem(item));
      }
    }
  });

  const lastRow = rows[rows.length - 1];

  return {
    listItems,
    placeItems,
    userItems,
    nextCursor:
      rows.length >= limit && lastRow
        ? {
            id: lastRow.item_id,
            rank: toNumber(lastRow.rank) || 0,
          }
        : undefined,
  };
}
