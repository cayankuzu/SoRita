import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { normalizeOptionalMultilineText } from '@/mobile/app/shared/validation/contentLimits';
import {
  mapPayloadOwner,
  mapPlaceFeedCard,
  toNumber,
  type PlaceFeedCardPayload,
} from '@/mobile/app/data/mappers/placeFeedCardMapper';

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
  createdAt?: string | null;
  description?: string | null;
  emoji?: string | null;
  id: string;
  isPublic?: boolean | null;
  name: string;
  ownerId: string;
  ownerName?: string | null;
  ownerProfilePhotoUrl?: string | null;
  ownerUsername?: string | null;
  placeCount?: number | string | null;
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

const EXPLORE_PAGE_SIZE = 20;

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

function mapListItem(payload: ExploreListPayload): ExploreListItem {
  return {
    owner: mapPayloadOwner(payload),
    list: {
      id: payload.id,
      userId: payload.ownerId,
      name: payload.name || '',
      description: normalizeOptionalMultilineText(payload.description),
      emoji: payload.emoji || undefined,
      coverImage: payload.coverImageUrl || undefined,
      places: [],
      placeCount: toNumber(payload.placeCount) || 0,
      isPublic: payload.isPublic !== false,
      createdAt: payload.createdAt || payload.updatedAt || new Date(0).toISOString(),
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

export async function fetchExplorePage(params: {
  abortSignal?: AbortSignal;
  cursor?: ExploreCursor | null;
  kind?: ExploreKind;
  limit?: number;
  query?: string;
  viewerId: string;
}): Promise<ExplorePage> {
  const limit = params.limit ?? EXPLORE_PAGE_SIZE;
  let request = supabase.rpc('explore_page_complete', {
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
      const item = parseItem<PlaceFeedCardPayload>(row.item);
      if (item) {
        placeItems.push(mapPlaceFeedCard(item, params.viewerId));
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
