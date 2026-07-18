import { PLACE_CATEGORY_META } from '@/mobile/app/catalog/placeOptions';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { getMarkerAggregationKey } from '@/mobile/app/shared/utils/markerColors';

export {
  getListMarkerColor,
  getMapMarkers,
  getMarkerAggregationKey,
  getMarkerColorByVisibility,
  getMarkerColorForMemberships,
  getMarkerColorForPlaceAcrossLists,
  getMarkerVisibilityForPlaceAcrossLists,
  getMarkerVisibilityForPublicFlags,
} from '@/mobile/app/shared/utils/markerColors';
export type {
  MapMarkerItem,
  MarkerVisibilityState,
} from '@/mobile/app/shared/utils/markerColors';

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

type LocationPlaceStatsLike = Pick<PlaceLike, 'lat' | 'lng' | 'name'> & {
  addedAt?: string;
  updatedAt?: string;
};

type PlaceListLike = {
  places: PlaceLike[];
  coverImage?: string;
  likes?: number;
  isPublic: boolean;
};

export type LocationPlaceStat = {
  count: number;
  originalPlaceName: string;
};

export const categoryMeta: Record<string, { label: string; emoji: string }> = {
  ...PLACE_CATEGORY_META,
  other: { label: tr.categories?.other ?? 'Other', emoji: '' },
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

function getLocationPlaceComparableTime(place: LocationPlaceStatsLike) {
  const parsed = Date.parse(place.addedAt || place.updatedAt || '');

  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

export function buildLocationPlaceStats<TPlace extends LocationPlaceStatsLike>(places: TPlace[]) {
  const statsByKey = new Map<
    string,
    {
      count: number;
      originalPlace: TPlace;
    }
  >();

  for (const place of places) {
    const key = getMarkerAggregationKey(place);
    const current = statsByKey.get(key);

    if (!current) {
      statsByKey.set(key, {
        count: 1,
        originalPlace: place,
      });
      continue;
    }

    const nextOriginalPlace =
      getLocationPlaceComparableTime(place) < getLocationPlaceComparableTime(current.originalPlace)
        ? place
        : current.originalPlace;

    statsByKey.set(key, {
      count: current.count + 1,
      originalPlace: nextOriginalPlace,
    });
  }

  return new Map<string, LocationPlaceStat>(
    Array.from(statsByKey.entries()).map(([key, value]) => [
      key,
      {
        count: value.count,
        originalPlaceName: value.originalPlace.name,
      },
    ]),
  );
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

export function formatLocationPlaceCardsCount(count: number) {
  return `${count} kart`;
}

export function formatListStats(list: PlaceListLike) {
  const likes = list.likes || 0;
  return tr.cards.listStats(list.places.length, likes);
}

export function uniqueStrings(values?: Array<string | undefined>) {
  return [...new Set((values || []).filter(Boolean) as string[])];
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
