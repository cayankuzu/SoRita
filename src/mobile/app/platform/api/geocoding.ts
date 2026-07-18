import {
  callJsonEdgeFunction,
  isEdgeFunctionError,
  isMissingEdgeFunctionError,
} from '@/mobile/app/platform/api/edgeFunctions';
import { env } from '@/mobile/app/platform/config/env';
import { isLikelyNetworkError } from '@/mobile/app/platform/feedback/errorMessage';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { t } from '@/mobile/app/shared/i18n';
import { normalizeSearchText } from '@/mobile/app/shared/utils/textSort';

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

type GoogleTextSearchResponse = {
  places?: Array<{
    displayName?: { text?: string };
    formattedAddress?: string;
    id?: string;
    location?: { latitude?: number; longitude?: number };
  }>;
};

type GoogleReverseGeocodingResponse = {
  results?: Array<{
    address_components?: Array<{
      long_name?: string;
      short_name?: string;
      types?: string[];
    }>;
    formatted_address?: string;
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
    place_id?: string;
    types?: string[];
  }>;
  status?: string;
};

type GoogleForwardGeocodingResponse = GoogleReverseGeocodingResponse;

const GOOGLE_GEOCODING_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';
const GOOGLE_PLACES_TEXT_SEARCH_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const GEOCODING_TIMEOUT_MS = 8000;
const SEARCH_LIMIT = 20;

async function getAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  if (!session?.access_token) {
    throw new Error(t.settings.sessionMissing);
  }

  return session.access_token;
}

function sanitizeText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEOCODING_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function searchPlacesByGoogleText(
  apiKey: string,
  rawQuery: string,
): Promise<GeocodingSearchResult[]> {
  const response = await fetchWithTimeout(GOOGLE_PLACES_TEXT_SEARCH_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({
      languageCode: 'tr',
      pageSize: SEARCH_LIMIT,
      rankPreference: 'RELEVANCE',
      textQuery: rawQuery,
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
        address: sanitizeText(item.formattedAddress) || '',
        lat,
        lng,
        name: sanitizeText(item.displayName?.text) || rawQuery,
        placeId: item.id || `${lat},${lng}`,
      } satisfies GeocodingSearchResult;
    })
    .filter((item): item is GeocodingSearchResult => Boolean(item));
}

async function searchPlacesByGoogleGeocoding(
  apiKey: string,
  rawQuery: string,
): Promise<GeocodingSearchResult[]> {
  const response = await fetchWithTimeout(
    `${GOOGLE_GEOCODING_ENDPOINT}?address=${encodeURIComponent(rawQuery)}&language=tr&key=${encodeURIComponent(apiKey)}`,
    {},
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
        (component.types ?? []).some(
          (type) => type === 'route' || type === 'street_address' || type === 'premise',
        ),
      )?.long_name;

      return {
        address: sanitizeText(item.formatted_address) || '',
        lat,
        lng,
        name: sanitizeText(routeName) || firstSegment || rawQuery,
        placeId: item.place_id || `${lat},${lng}`,
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

      return left.name.trim().length - right.name.trim().length;
    })
    .slice(0, SEARCH_LIMIT);
}

async function reverseGeocodeWithGoogleServices(
  apiKey: string,
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodingResult> {
  const response = await fetchWithTimeout(
    `${GOOGLE_GEOCODING_ENDPOINT}?latlng=${latitude},${longitude}&language=tr&key=${encodeURIComponent(apiKey)}`,
    {},
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

  const firstResult = data.results?.[0];
  const address = sanitizeText(firstResult?.formatted_address);
  const types = new Set((firstResult?.types ?? []).map((value) => value.toLowerCase()));
  const components = firstResult?.address_components ?? [];
  const establishmentName = components.find((component) =>
    (component.types ?? []).some(
      (type) => type === 'point_of_interest' || type === 'establishment' || type === 'premise',
    ),
  )?.long_name;
  const firstAddressSegment = sanitizeText(address?.split(',')[0]);
  const looksLikePoi =
    types.has('point_of_interest') ||
    types.has('establishment') ||
    types.has('premise') ||
    types.has('subpremise');

  return {
    address,
    isPointOfInterest: looksLikePoi,
    lat: firstResult?.geometry?.location?.lat ?? latitude,
    lng: firstResult?.geometry?.location?.lng ?? longitude,
    name: looksLikePoi ? sanitizeText(establishmentName) || firstAddressSegment : undefined,
  };
}

async function searchPlacesByFallbackServices(query: string) {
  const apiKey = env.googleMapsServicesApiKey.trim();

  if (!apiKey) {
    throw new Error('Requested function was not found');
  }

  const [placesResults, addressResults] = await Promise.allSettled([
    searchPlacesByGoogleText(apiKey, query),
    searchPlacesByGoogleGeocoding(apiKey, query),
  ]);
  const results = mergeSearchResults(
    query,
    placesResults.status === 'fulfilled' ? placesResults.value : [],
    addressResults.status === 'fulfilled' ? addressResults.value : [],
  );

  if (results.length === 0 && placesResults.status === 'rejected') {
    throw placesResults.reason;
  }

  if (results.length === 0 && addressResults.status === 'rejected') {
    throw addressResults.reason;
  }

  return results;
}

function shouldFallbackToGoogleServices(error: unknown) {
  if (isMissingEdgeFunctionError(error)) {
    return true;
  }

  if (isEdgeFunctionError(error)) {
    return error.status >= 500;
  }

  return isLikelyNetworkError(error);
}

export async function searchPlacesByText(query: string): Promise<GeocodingSearchResult[]> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const accessToken = await getAccessToken();

  try {
    const response = await callJsonEdgeFunction<{ results: GeocodingSearchResult[] }>(
      env.supabaseMapsFunctionName,
      {
        action: 'search',
        query: trimmedQuery,
      },
      {
        accessToken,
      },
    );

    return response.results;
  } catch (error) {
    if (!shouldFallbackToGoogleServices(error)) {
      throw error;
    }
  }

  return searchPlacesByFallbackServices(trimmedQuery);
}

export async function reverseGeocodeLocation(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodingResult> {
  const accessToken = await getAccessToken();

  try {
    const response = await callJsonEdgeFunction<{ result: ReverseGeocodingResult }>(
      env.supabaseMapsFunctionName,
      {
        action: 'reverse',
        latitude,
        longitude,
      },
      {
        accessToken,
      },
    );

    return response.result;
  } catch (error) {
    if (!shouldFallbackToGoogleServices(error)) {
      throw error;
    }
  }

  const apiKey = env.googleMapsServicesApiKey.trim();

  if (!apiKey) {
    throw new Error('Requested function was not found');
  }

  return reverseGeocodeWithGoogleServices(apiKey, latitude, longitude);
}
