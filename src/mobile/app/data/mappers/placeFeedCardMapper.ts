import type { Place, PlaceMedia, User } from '@/mobile/app/data/contracts/entities';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';
import { normalizePlaceMedia } from '@/mobile/app/shared/utils/placeMedia';
import { normalizeOptionalMultilineText } from '@/mobile/app/shared/validation/contentLimits';

// One place card as the feed, Explore and profile read models return it.
// Numbers may arrive as strings and media as a JSON string, depending on how
// Postgres serialises the row.
export type PlaceFeedCardPayload = {
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
  // When the card entered the feed; the home feed sorts by it.
  publishedAt?: string | null;
  rating?: number | string | null;
  specialFeatures?: string[] | null;
  studentDiscount?: boolean | null;
  updatedAt: string;
  viewerHasLiked?: boolean | null;
};

export function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function parseMediaPayload(value: PlaceMedia[] | string | null | undefined) {
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

export function mapPayloadOwner(payload: {
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

export function mapPlaceFeedCard(
  payload: PlaceFeedCardPayload,
  viewerId?: string | null,
): PlaceFeedCardItem {
  const media = parseMediaPayload(payload.media);
  const owner = mapPayloadOwner(payload);
  const listIsPublic = payload.listIsPublic !== false;
  const place: Place = {
    id: payload.placeId,
    name: payload.placeName,
    title: normalizeOptionalMultilineText(payload.placeTitle),
    menuUrl: payload.menuUrl || undefined,
    lat: payload.lat,
    lng: payload.lng,
    address: payload.address || undefined,
    notes: normalizeOptionalMultilineText(payload.notes),
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
    addedBy: owner
      ? { userId: owner.id, userName: owner.name, userAvatar: owner.profilePhoto }
      : undefined,
  };
  const listFields = {
    listId: payload.listId,
    listName: payload.listName,
    listEmoji: payload.listEmoji || undefined,
    listIsPublic,
    listCoverImage: payload.listCoverImageUrl || undefined,
  };

  return {
    key: `${payload.listId}:${payload.placeId}`,
    place,
    owner,
    ownerId: payload.ownerId,
    ...listFields,
    memberships: [{ ...listFields, updatedAt: payload.listUpdatedAt || payload.updatedAt }],
    locationPlaceCardsCount: toNumber(payload.locationPlaceCardsCount) || 1,
    sortTime: new Date(payload.publishedAt || payload.updatedAt).getTime(),
  };
}
