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

const COUNTRY_ADDRESS_SEGMENTS = new Set(['tr', 'turkey', 'turkiye', 'türkiye']);

function normalizeAddressSegment(segment: string) {
  return segment.trim().replace(/^\d{5}\s+/, '').replace(/\s+/g, ' ');
}

// A district or city name: letters, no digits, and not a street. Door numbers
// such as "No:2/27" or "285/3H" carry a slash too, and once read as
// "district/city" they printed "27 · Gençlik Mrk. Sk. No:2" on a card.
const STREET_WORD = /(^|\s)(sk|sok|sokak|sokağı|cd|cad|cadde|caddesi|blv|bulvar|bulvarı|yolu)\.?(\s|$)/iu;

function isPlaceName(value: string) {
  return /\p{L}/u.test(value) && !/\d/u.test(value) && !STREET_WORD.test(value);
}

function parseDistrictCitySegment(segment: string) {
  const [locationPart] = segment.split(/\s*·\s*/, 1);
  const parts = locationPart
    .split('/')
    .map(normalizeAddressSegment)
    .filter(Boolean);

  if (parts.length !== 2 || !parts.every(isPlaceName)) {
    return null;
  }

  const [district, city] = parts;
  return { city, district };
}

/**
 * "City · District" from an address, e.g. "İstanbul · Kadıköy". Google writes
 * the pair as "34710 Kadıköy/İstanbul" near the end, so it is looked for from
 * the end; without it, the last place names in the address stand in.
 */
export function formatPlaceCardLocation(address?: string) {
  const segments = (address || '')
    .split(',')
    .map(normalizeAddressSegment)
    .filter(Boolean);

  while (
    segments.length > 0 &&
    COUNTRY_ADDRESS_SEGMENTS.has(segments[segments.length - 1].toLocaleLowerCase('tr-TR'))
  ) {
    segments.pop();
  }

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const districtCity = parseDistrictCitySegment(segments[index]);
    if (districtCity) {
      return `${districtCity.city} · ${districtCity.district}`;
    }
  }

  const names = segments.filter(isPlaceName);
  if (names.length === 0) {
    return null;
  }

  const city = names[names.length - 1];
  const district = names.length > 1 ? names[names.length - 2] : undefined;

  if (!district || district.toLocaleLowerCase('tr-TR') === city.toLocaleLowerCase('tr-TR')) {
    return city;
  }

  return `${city} · ${district}`;
}

export function uniqueStrings(values?: Array<string | undefined>) {
  return [...new Set((values || []).filter(Boolean) as string[])];
}

