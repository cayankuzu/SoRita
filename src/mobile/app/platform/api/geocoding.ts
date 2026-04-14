import { env } from '@/mobile/app/platform/config/env';

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
const SEARCH_LIMIT = 12;
const REQUEST_INTERVAL_MS = 1100;

const searchCache = new Map<string, GeocodingSearchResult[]>();
const reverseCache = new Map<string, ReverseGeocodingResult>();
let lastRequestTimestamp = 0;

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

function ensureGoogleMapsApiKey() {
  if (!env.googleMapsApiKey) {
    throw new Error('Google Maps API key is missing');
  }

  return env.googleMapsApiKey;
}

async function waitForRateLimitWindow() {
  const elapsed = Date.now() - lastRequestTimestamp;

  if (elapsed < REQUEST_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, REQUEST_INTERVAL_MS - elapsed));
  }

  lastRequestTimestamp = Date.now();
}

async function searchPlacesByGoogleText(rawQuery: string): Promise<GeocodingSearchResult[]> {
  const apiKey = ensureGoogleMapsApiKey();
  const response = await fetch(GOOGLE_PLACES_TEXT_SEARCH_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({
      textQuery: rawQuery,
      languageCode: 'tr',
      pageSize: SEARCH_LIMIT,
    }),
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
  const response = await fetch(
    `${GOOGLE_GEOCODING_FORWARD_ENDPOINT}?address=${encodeURIComponent(rawQuery)}&language=tr&key=${encodeURIComponent(apiKey)}`,
  );

  if (!response.ok) {
    throw new Error('Google geocoding search failed');
  }

  const data = (await response.json()) as GoogleForwardGeocodingResponse;
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

function mergeSearchResults(...groups: GeocodingSearchResult[][]) {
  const merged = new Map<string, GeocodingSearchResult>();

  groups.flat().forEach((item) => {
    const key = item.placeId || `${item.lat.toFixed(6)},${item.lng.toFixed(6)}`;

    if (!merged.has(key)) {
      merged.set(key, item);
    }
  });

  return Array.from(merged.values()).slice(0, SEARCH_LIMIT);
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

  const cacheKey = trimmedQuery.toLocaleLowerCase('en-US');
  const cachedResult = searchCache.get(cacheKey);

  if (cachedResult) {
    return cachedResult;
  }

  await waitForRateLimitWindow();

  const [placeResults, addressResults] = await Promise.all([
    searchPlacesByGoogleText(trimmedQuery),
    searchPlacesByGoogleGeocoding(trimmedQuery).catch(() => []),
  ]);
  const results = mergeSearchResults(placeResults, addressResults);
  searchCache.set(cacheKey, results);
  return results;
}

export async function reverseGeocodeLocation(latitude: number, longitude: number): Promise<ReverseGeocodingResult> {
  const cacheKey = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  const cachedResult = reverseCache.get(cacheKey);

  if (cachedResult) {
    return cachedResult;
  }

  await waitForRateLimitWindow();

  const apiKey = ensureGoogleMapsApiKey();
  const response = await fetch(
    `${GOOGLE_GEOCODING_REVERSE_ENDPOINT}?latlng=${latitude},${longitude}&language=tr&key=${encodeURIComponent(apiKey)}`,
  );

  if (!response.ok) {
    throw new Error('Reverse geocoding failed');
  }

  const data = (await response.json()) as GoogleReverseGeocodingResponse;
  const result = deriveGoogleReverseGeocodingResult(data, latitude, longitude);
  reverseCache.set(cacheKey, result);
  return result;
}
