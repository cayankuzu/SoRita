import { PLACE_CATEGORY_META } from '@/mobile/app/catalog/placeOptions';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

type UserNameLike = {
  name?: string;
};

type PlaceLike = {
  lat: number;
  lng: number;
  name: string;
  rating?: number;
  category?: string;
  categories?: string[];
  studentDiscount?: boolean;
  priceMin?: number;
  priceMax?: number;
  bestTime?: string;
  bestTimes?: string[];
  atmosphere?: string[];
  specialFeatures?: string[];
};

type PlaceListLike = {
  places: PlaceLike[];
  coverImage?: string;
  likes?: number;
  isPublic: boolean;
};

type MarkerMembershipLike = {
  listIsPublic: boolean;
};

export type MapMarkerItem = {
  lat: number;
  lng: number;
  name: string;
  markerColor?: string;
  markerVisibility?: MarkerVisibilityState;
  markerKind?: 'saved' | 'search' | 'editor';
};

export type MarkerVisibilityState = 'public' | 'private' | 'mixed';

export const categoryMeta: Record<string, { label: string; emoji: string }> = {
  ...PLACE_CATEGORY_META,
  other: { label: tr.categories.other, emoji: '' },
};

export function getUserAvatarText(user?: UserNameLike | null) {
  if (!user?.name) {
    return '?';
  }

  return user.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function getCoverPhoto(list: PlaceListLike) {
  return list.coverImage || null;
}

function normalizeMarkerIdentityValue(value: string) {
  return value.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
}

export function getMarkerAggregationKey(place: Pick<PlaceLike, 'name' | 'lat' | 'lng'>) {
  return [
    normalizeMarkerIdentityValue(place.name),
    place.lat.toFixed(5),
    place.lng.toFixed(5),
  ].join(':');
}

export function getMarkerVisibilityForPublicFlags(
  publicFlags: Iterable<boolean>,
  fallbackIsPublic = true,
): MarkerVisibilityState {
  let hasPublic = false;
  let hasPrivate = false;

  for (const isPublic of publicFlags) {
    if (isPublic) {
      hasPublic = true;
    } else {
      hasPrivate = true;
    }

    if (hasPublic && hasPrivate) {
      return 'mixed';
    }
  }

  if (hasPublic) {
    return 'public';
  }

  if (hasPrivate) {
    return 'private';
  }

  return fallbackIsPublic ? 'public' : 'private';
}

export function getMarkerColorByVisibility(visibility: MarkerVisibilityState) {
  if (visibility === 'private') {
    return colors.danger;
  }

  if (visibility === 'mixed') {
    return colors.primary;
  }

  return colors.secondary;
}

export function getListMarkerColor(isPublic?: boolean) {
  return getMarkerColorByVisibility(isPublic === false ? 'private' : 'public');
}

export function getMarkerColorForMemberships(
  memberships?: MarkerMembershipLike[],
  fallbackIsPublic = true,
) {
  if (!memberships?.length) {
    return getListMarkerColor(fallbackIsPublic);
  }

  return getMarkerColorByVisibility(
    getMarkerVisibilityForPublicFlags(
      memberships.map((membership) => membership.listIsPublic),
      fallbackIsPublic,
    ),
  );
}

export function getMarkerColorForPlaceAcrossLists(
  place: Pick<PlaceLike, 'name' | 'lat' | 'lng'>,
  lists: PlaceListLike[],
  fallbackIsPublic = true,
) {
  return getMarkerColorByVisibility(
    getMarkerVisibilityForPlaceAcrossLists(place, lists, fallbackIsPublic),
  );
}

export function getMarkerVisibilityForPlaceAcrossLists(
  place: Pick<PlaceLike, 'name' | 'lat' | 'lng'>,
  lists: PlaceListLike[],
  fallbackIsPublic = true,
) {
  const targetKey = getMarkerAggregationKey(place);
  const matchingPublicFlags: boolean[] = [];

  for (const list of lists) {
    for (const candidatePlace of list.places) {
      if (getMarkerAggregationKey(candidatePlace) === targetKey) {
        matchingPublicFlags.push(list.isPublic);
      }
    }
  }

  return getMarkerVisibilityForPublicFlags(matchingPublicFlags, fallbackIsPublic);
}

export function getMapMarkers<TPlace extends PlaceLike>(
  places: TPlace[],
  isPublic?: boolean,
  resolveMarkerColor?: (place: TPlace, index: number) => string | undefined,
) {
  const markerColor = getListMarkerColor(isPublic);

  return places.map((place, index) => ({
    lat: place.lat,
    lng: place.lng,
    name: place.name,
    markerColor: resolveMarkerColor?.(place, index) ?? markerColor,
  }));
}

export function formatPrice(place: PlaceLike) {
  if (place.priceMin == null && place.priceMax == null) {
    return null;
  }

  if (place.priceMin === place.priceMax) {
    return tr.cards.priceSingle(place.priceMin ?? 0);
  }

  return tr.cards.priceRange(place.priceMin ?? 0, place.priceMax ?? 0);
}

export function formatListStats(list: PlaceListLike) {
  const likes = list.likes || 0;
  return tr.cards.listStats(list.places.length, likes);
}

export function uniqueStrings(values: Array<string | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])];
}

export function getListAverageRating(list: PlaceListLike) {
  const ratedPlaces = list.places.filter((place) => place.rating);
  if (ratedPlaces.length === 0) {
    return null;
  }

  return ratedPlaces.reduce((sum, place) => sum + (place.rating || 0), 0) / ratedPlaces.length;
}

export function hasStudentDiscount(list: PlaceListLike) {
  return list.places.some((place) => place.studentDiscount);
}

export function getListCategories(list: PlaceListLike) {
  return uniqueStrings(
    list.places.flatMap((place) => (place.categories?.length ? place.categories : place.category ? [place.category] : [])),
  ).slice(0, 5);
}

export function getListAtmosphere(list: PlaceListLike) {
  return uniqueStrings(list.places.flatMap((place) => place.atmosphere || [])).slice(0, 5);
}

export function getListFeatures(list: PlaceListLike) {
  return uniqueStrings(list.places.flatMap((place) => place.specialFeatures || [])).slice(0, 5);
}

export function getListBestTimes(list: PlaceListLike) {
  return uniqueStrings(
    list.places.flatMap((place) =>
      place.bestTimes?.length ? place.bestTimes : place.bestTime ? [place.bestTime] : [],
    ),
  ).slice(0, 4);
}
