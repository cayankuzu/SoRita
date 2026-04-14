import type { Place, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { PLACE_CATEGORY_META } from '@/mobile/app/catalog/placeOptions';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

export type MapMarkerItem = {
  lat: number;
  lng: number;
  name: string;
  markerColor?: string;
};

export const categoryMeta: Record<string, { label: string; emoji: string }> = {
  ...PLACE_CATEGORY_META,
  other: { label: tr.categories.other, emoji: '' },
};

export function getUserAvatarText(user?: Pick<User, 'name'> | null) {
  if (!user?.name) {
    return '?';
  }

  return user.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function getCoverPhoto(list: PlaceList) {
  return list.coverImage || null;
}

export function getListMarkerColor(isPublic?: boolean) {
  return isPublic === false ? colors.danger : colors.secondary;
}

export function getMapMarkers(places: Place[], isPublic?: boolean) {
  const markerColor = getListMarkerColor(isPublic);

  return places.map((place) => ({
    lat: place.lat,
    lng: place.lng,
    name: place.name,
    markerColor,
  }));
}

export function formatPrice(place: Place) {
  if (place.priceMin == null && place.priceMax == null) {
    return null;
  }

  if (place.priceMin === place.priceMax) {
    return tr.cards.priceSingle(place.priceMin ?? 0);
  }

  return tr.cards.priceRange(place.priceMin ?? 0, place.priceMax ?? 0);
}

export function formatListStats(list: PlaceList) {
  const likes = list.likes || 0;
  return tr.cards.listStats(list.places.length, likes);
}

export function uniqueStrings(values: Array<string | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])];
}

export function getListAverageRating(list: PlaceList) {
  const ratedPlaces = list.places.filter((place) => place.rating);
  if (ratedPlaces.length === 0) {
    return null;
  }

  return ratedPlaces.reduce((sum, place) => sum + (place.rating || 0), 0) / ratedPlaces.length;
}

export function hasStudentDiscount(list: PlaceList) {
  return list.places.some((place) => place.studentDiscount);
}

export function getListCategories(list: PlaceList) {
  return uniqueStrings(
    list.places.flatMap((place) => (place.categories?.length ? place.categories : place.category ? [place.category] : [])),
  ).slice(0, 5);
}

export function getListAtmosphere(list: PlaceList) {
  return uniqueStrings(list.places.flatMap((place) => place.atmosphere || [])).slice(0, 5);
}

export function getListFeatures(list: PlaceList) {
  return uniqueStrings(list.places.flatMap((place) => place.specialFeatures || [])).slice(0, 5);
}

export function getListBestTimes(list: PlaceList) {
  return uniqueStrings(
    list.places.flatMap((place) =>
      place.bestTimes?.length ? place.bestTimes : place.bestTime ? [place.bestTime] : [],
    ),
  ).slice(0, 4);
}
