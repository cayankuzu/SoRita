import { env } from '@/mobile/app/platform/config/env';
import { fetchWithTimeout } from '@/mobile/app/platform/api/fetchWithTimeout';

export type GeocodingSearchResult = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export type ReverseGeocodingResult = {
  name?: string;
  address?: string;
  lat: number;
  lng: number;
  isPointOfInterest: boolean;
};

const GOOGLE_PLACES_TEXT_SEARCH_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const GOOGLE_GEOCODING_REVERSE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';
const GOOGLE_GEOCODING_FORWARD_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';
const GEOCODING_TIMEOUT_MS = 8000;
const SEARCH_LIMIT = 20;

type GoogleTextSearchResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
  }>;
};

type GoogleReverseGeocodingResponse = {
  status?: string;
  results?: Array<{
    place_id?: string;
    formatted_address?: string;
    types?: string[];
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
    address_components?: Array<{
      long_name?: string;
      short_name?: string;
      types?: string[];
    }>;
  }>;
};

type GoogleForwardGeocodingResponse = {
  status?: string;
  results?: Array<{
    place_id?: string;
    formatted_address?: string;
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
    address_components?: Array<{
      long_name?: string;
      short_name?: string;
      types?: string[];
    }>;
    types?: string[];
  }>;
};

function sanitizeText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeSearchText(value?: string | null) {
  return sanitizeText(value)?.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
}

function ensureGoogleMapsApiKey() {
  if (!env.googleMapsApiKey) {
    throw new Error('Google Maps API key is missing');
  }

  return env.googleMapsApiKey;
}

async function searchPlacesByGoogleText(rawQuery: string): Promise<GeocodingSearchResult[]> {
  const apiKey = ensureGoogleMapsApiKey();
  const response = await fetchWithTimeout(GOOGLE_PLACES_TEXT_SEARCH_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({
      textQuery: rawQuery,
      languageCode: 'tr',
      rankPreference: 'RELEVANCE',
      pageSize: SEARCH_LIMIT,
    }),
    timeoutMs: GEOCODING_TIMEOUT_MS,
  });

  if (!response.ok) {
    throw new Error('Google Places text search failed');
  }

  const data = (await response.json()) as GoogleTextSearchResponse;
  return (data.places ?? [])
    .map((item) => {
      const lat = item.location?.latitude;
      const lng = item.location?.longitude;

      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return null;
      }

      return {
        placeId: item.id || `${lat},${lng}`,
        name: sanitizeText(item.displayName?.text) || rawQuery,
        address: sanitizeText(item.formattedAddress) || '',
        lat,
        lng,
      } satisfies GeocodingSearchResult;
    })
    .filter((item): item is GeocodingSearchResult => Boolean(item));
}

async function searchPlacesByGoogleGeocoding(rawQuery: string): Promise<GeocodingSearchResult[]> {
  const apiKey = ensureGoogleMapsApiKey();
  const response = await fetchWithTimeout(
    `${GOOGLE_GEOCODING_FORWARD_ENDPOINT}?address=${encodeURIComponent(rawQuery)}&language=tr&key=${encodeURIComponent(apiKey)}`,
    {
      timeoutMs: GEOCODING_TIMEOUT_MS,
    },
  );

  if (!response.ok) {
    throw new Error('Google geocoding search failed');
  }

  const data = (await response.json()) as GoogleForwardGeocodingResponse;
  if (data.status === 'ZERO_RESULTS') {
    return [];
  }

  if (data.status && data.status !== 'OK') {
    throw new Error(`Google geocoding search failed: ${data.status}`);
  }

  return (data.results ?? [])
    .slice(0, SEARCH_LIMIT)
    .map((item) => {
      const lat = item.geometry?.location?.lat;
      const lng = item.geometry?.location?.lng;

      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return null;
      }

      const firstSegment = sanitizeText(item.formatted_address?.split(',')[0]);
      const routeName = item.address_components?.find((component) =>
        (component.types ?? []).some((type) => type === 'route' || type === 'street_address' || type === 'premise'),
      )?.long_name;

      return {
        placeId: item.place_id || `${lat},${lng}`,
        name: sanitizeText(routeName) || firstSegment || rawQuery,
        address: sanitizeText(item.formatted_address) || '',
        lat,
        lng,
      } satisfies GeocodingSearchResult;
    })
    .filter((item): item is GeocodingSearchResult => Boolean(item));
}

function scoreSearchResult(rawQuery: string, item: GeocodingSearchResult) {
  const normalizedQuery = normalizeSearchText(rawQuery);
  const normalizedName = normalizeSearchText(item.name);
  const normalizedAddress = normalizeSearchText(item.address);

  if (!normalizedQuery) {
    return 5;
  }

  if (normalizedName === normalizedQuery) {
    return 0;
  }

  if (normalizedName?.startsWith(normalizedQuery)) {
    return 1;
  }

  if (normalizedAddress?.startsWith(normalizedQuery)) {
    return 2;
  }

  if (normalizedName?.includes(normalizedQuery)) {
    return 3;
  }

  if (normalizedAddress?.includes(normalizedQuery)) {
    return 4;
  }

  return 5;
}

function mergeSearchResults(rawQuery: string, ...groups: GeocodingSearchResult[][]) {
  const merged = new Map<string, GeocodingSearchResult>();

  groups.flat().forEach((item) => {
    const key =
      item.placeId ||
      `${normalizeSearchText(item.name) || ''}:${item.lat.toFixed(5)}:${item.lng.toFixed(5)}`;

    if (!merged.has(key)) {
      merged.set(key, item);
    }
  });

  return Array.from(merged.values())
    .sort((left, right) => {
      const scoreDifference = scoreSearchResult(rawQuery, left) - scoreSearchResult(rawQuery, right);
      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      const leftNameLength = left.name.trim().length;
      const rightNameLength = right.name.trim().length;
      if (leftNameLength !== rightNameLength) {
        return leftNameLength - rightNameLength;
      }

      return left.address.trim().length - right.address.trim().length;
    })
    .slice(0, SEARCH_LIMIT);
}

function deriveGoogleReverseGeocodingResult(
  response: GoogleReverseGeocodingResponse,
  fallbackLat: number,
  fallbackLng: number,
): ReverseGeocodingResult {
  const firstResult = response.results?.[0];
  const address = sanitizeText(firstResult?.formatted_address);
  const types = new Set((firstResult?.types ?? []).map((value) => value.toLocaleLowerCase('en-US')));
  const components = firstResult?.address_components ?? [];
  const establishmentName = components.find((component) =>
    (component.types ?? []).some((type) => type === 'point_of_interest' || type === 'establishment' || type === 'premise'),
  )?.long_name;
  const firstAddressSegment = sanitizeText(address?.split(',')[0]);
  const looksLikePoi =
    types.has('point_of_interest') || types.has('establishment') || types.has('premise') || types.has('subpremise');

  return {
    name: looksLikePoi ? sanitizeText(establishmentName) || firstAddressSegment : undefined,
    address,
    lat: firstResult?.geometry?.location?.lat ?? fallbackLat,
    lng: firstResult?.geometry?.location?.lng ?? fallbackLng,
    isPointOfInterest: looksLikePoi,
  };
}

export async function searchPlacesByText(query: string): Promise<GeocodingSearchResult[]> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const [placeResults, addressResults] = await Promise.allSettled([
    searchPlacesByGoogleText(trimmedQuery),
    searchPlacesByGoogleGeocoding(trimmedQuery),
  ]);

  const mergedResults = mergeSearchResults(
    trimmedQuery,
    placeResults.status === 'fulfilled' ? placeResults.value : [],
    addressResults.status === 'fulfilled' ? addressResults.value : [],
  );

  if (mergedResults.length > 0) {
    return mergedResults;
  }

  if (placeResults.status === 'rejected') {
    throw placeResults.reason;
  }

  if (addressResults.status === 'rejected') {
    throw addressResults.reason;
  }

  return [];
}

export async function reverseGeocodeLocation(latitude: number, longitude: number): Promise<ReverseGeocodingResult> {
  const apiKey = ensureGoogleMapsApiKey();
  const response = await fetchWithTimeout(
    `${GOOGLE_GEOCODING_REVERSE_ENDPOINT}?latlng=${latitude},${longitude}&language=tr&key=${encodeURIComponent(apiKey)}`,
    {
      timeoutMs: GEOCODING_TIMEOUT_MS,
    },
  );

  if (!response.ok) {
    throw new Error('Reverse geocoding failed');
  }

  const data = (await response.json()) as GoogleReverseGeocodingResponse;
  if (data.status === 'ZERO_RESULTS') {
    return {
      address: undefined,
      isPointOfInterest: false,
      lat: latitude,
      lng: longitude,
      name: undefined,
    };
  }

  if (data.status && data.status !== 'OK') {
    throw new Error(`Reverse geocoding failed: ${data.status}`);
  }

  return deriveGoogleReverseGeocodingResult(data, latitude, longitude);
}
