import { z } from 'zod';

import { createEdgeRequestContext, logEdgeEvent } from '../_shared/edgeLogger.ts';
import {
  type AuthClientLike,
  corsPreflightResponse,
  getBearerToken,
  isHttpRequestError,
  jsonResponse,
  parseJsonBody,
} from '../_shared/httpHelpers.ts';
import { enforceRateLimit, rateLimitHeaders, type RateLimitAdminClientLike } from '../_shared/rateLimit.ts';
import { verifyRequestEnvelope, verifySignedRequest } from '../_shared/requestSecurity.ts';

type ErrorLike = {
  message: string;
};

type NonceStoreLike = {
  delete: () => {
    lt: (column: string, value: string) => Promise<{ error?: ErrorLike | null }>;
  };
  insert: (payload: Record<string, unknown>) => Promise<{ error?: ErrorLike | null }>;
};

type MapsAdminClientLike = RateLimitAdminClientLike & {
  from: (table: string) => NonceStoreLike;
};

export type MapsGeocodingHandlerConfig = {
  allowedOrigins: string[];
  googleMapsServicesApiKey: string;
  supabasePublishableKey: string;
  supabaseServiceRoleKey: string;
  supabaseUrl: string;
};

export type MapsGeocodingHandlerDeps = {
  config: MapsGeocodingHandlerConfig;
  createAdminClient: () => MapsAdminClientLike;
  createAuthClient: (token: string) => AuthClientLike;
};

type GeocodingSearchResult = {
  address: string;
  lat: number;
  lng: number;
  name: string;
  placeId: string;
};

type ReverseGeocodingResult = {
  address?: string;
  isPointOfInterest: boolean;
  lat: number;
  lng: number;
  name?: string;
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

const geocodingPayloadSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('search'),
    query: z.string().trim().min(1).max(120),
  }),
  z.object({
    action: z.literal('reverse'),
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
  }),
]);

const GOOGLE_GEOCODING_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';
const GOOGLE_PLACES_TEXT_SEARCH_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const GEOCODING_TIMEOUT_MS = 8000;
const SEARCH_LIMIT = 20;

function sanitizeText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeSearchText(value?: string | null) {
  return sanitizeText(value)?.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
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

async function searchPlacesByGoogleText(apiKey: string, rawQuery: string): Promise<GeocodingSearchResult[]> {
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

async function searchPlacesByGoogleGeocoding(apiKey: string, rawQuery: string): Promise<GeocodingSearchResult[]> {
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

async function reverseGeocodeLocation(
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
  const types = new Set((firstResult?.types ?? []).map((value) => value.toLocaleLowerCase('en-US')));
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

export function createMapsGeocodingHandler({
  config,
  createAdminClient,
  createAuthClient,
}: MapsGeocodingHandlerDeps) {
  return async function handleMapsGeocodingRequest(request: Request) {
    const requestContext = createEdgeRequestContext(request, 'maps-geocoding');
    const { allowedOrigins, googleMapsServicesApiKey, supabasePublishableKey, supabaseServiceRoleKey, supabaseUrl } =
      config;

    try {
      if (request.method === 'OPTIONS') {
        return corsPreflightResponse(request, allowedOrigins, requestContext.requestId);
      }

      if (request.method !== 'POST') {
        return jsonResponse(
          request,
          allowedOrigins,
          405,
          { code: 'method_not_allowed', error: 'Method not allowed' },
          { requestId: requestContext.requestId },
        );
      }

      if (!supabaseUrl || !supabasePublishableKey || !supabaseServiceRoleKey || !googleMapsServicesApiKey) {
        logEdgeEvent('error', 'Maps geocoding function is missing configuration', requestContext);
        return jsonResponse(
          request,
          allowedOrigins,
          500,
          { code: 'misconfigured', error: 'Harita servisi su anda kullanilamiyor.' },
          { requestId: requestContext.requestId },
        );
      }

      const token = getBearerToken(request.headers.get('Authorization'));

      if (!token) {
        return jsonResponse(
          request,
          allowedOrigins,
          401,
          { code: 'missing_authorization', error: 'Eksik yetkilendirme basligi.' },
          { requestId: requestContext.requestId },
        );
      }

      const adminClient = createAdminClient();
      const envelope = await verifyRequestEnvelope({
        adminClient,
        functionName: 'maps-geocoding',
        maxBodyBytes: 16 * 1024,
        request,
      });
      if (!envelope.ok) {
        return jsonResponse(
          request,
          allowedOrigins,
          envelope.status,
          { code: 'invalid_signature', error: envelope.error },
          { requestId: requestContext.requestId },
        );
      }

      const authClient = createAuthClient(token);
      const {
        data,
        error: userError,
      } = await authClient.auth.getUser(token);
      const userId = typeof data?.user?.id === 'string' ? data.user.id : null;

      if (userError || !userId) {
        return jsonResponse(
          request,
          allowedOrigins,
          401,
          { code: 'invalid_jwt', error: userError?.message ?? 'Invalid JWT' },
          { requestId: requestContext.requestId },
        );
      }

      const securityResult = await verifySignedRequest({
        adminClient,
        bodyText: envelope.bodyText,
        functionName: 'maps-geocoding',
        request,
        token,
        userId,
      });

      if (!securityResult.ok) {
        return jsonResponse(
          request,
          allowedOrigins,
          securityResult.status,
          { code: 'invalid_signature', error: securityResult.error },
          { requestId: requestContext.requestId },
        );
      }

      const parsedPayload = geocodingPayloadSchema.safeParse(parseJsonBody(securityResult.bodyText ?? ''));

      if (!parsedPayload.success) {
        return jsonResponse(
          request,
          allowedOrigins,
          400,
          { code: 'invalid_input', error: parsedPayload.error.issues[0]?.message ?? 'Gecersiz istek.' },
          { requestId: requestContext.requestId },
        );
      }

      const rateLimitResult = await enforceRateLimit({
        adminClient,
        identifier: userId,
        maxRequests: 20,
        scope: `maps:${parsedPayload.data.action}`,
        windowMs: 60_000,
      });

      if (!rateLimitResult.allowed) {
        return jsonResponse(
          request,
          allowedOrigins,
          429,
          {
            code: 'rate_limited',
            error: 'Harita aramalari icin istek sinirina ulasildi. Lutfen biraz sonra tekrar deneyin.',
          },
          {
            extraHeaders: rateLimitHeaders(rateLimitResult, 20),
            requestId: requestContext.requestId,
          },
        );
      }

      if (parsedPayload.data.action === 'search') {
        const [placesResults, addressResults] = await Promise.allSettled([
          searchPlacesByGoogleText(googleMapsServicesApiKey, parsedPayload.data.query),
          searchPlacesByGoogleGeocoding(googleMapsServicesApiKey, parsedPayload.data.query),
        ]);
        const results = mergeSearchResults(
          parsedPayload.data.query,
          placesResults.status === 'fulfilled' ? placesResults.value : [],
          addressResults.status === 'fulfilled' ? addressResults.value : [],
        );

        if (results.length === 0 && placesResults.status === 'rejected') {
          throw placesResults.reason;
        }

        if (results.length === 0 && addressResults.status === 'rejected') {
          throw addressResults.reason;
        }

        return jsonResponse(
          request,
          allowedOrigins,
          200,
          { results },
          {
            extraHeaders: rateLimitHeaders(rateLimitResult, 20),
            requestId: requestContext.requestId,
          },
        );
      }

      const result = await reverseGeocodeLocation(
        googleMapsServicesApiKey,
        parsedPayload.data.latitude,
        parsedPayload.data.longitude,
      );

      return jsonResponse(
        request,
        allowedOrigins,
        200,
        { result },
        {
          extraHeaders: rateLimitHeaders(rateLimitResult, 20),
          requestId: requestContext.requestId,
        },
      );
    } catch (error) {
      if (isHttpRequestError(error)) {
        return jsonResponse(
          request,
          allowedOrigins,
          error.status,
          { code: error.code, error: error.message },
          { requestId: requestContext.requestId },
        );
      }

      logEdgeEvent('error', 'Unhandled maps geocoding error', requestContext, {
        error: error instanceof Error ? error.message : 'Unknown maps error',
      });
      return jsonResponse(
        request,
        allowedOrigins,
        500,
        { code: 'unexpected', error: 'Harita istegi tamamlanamadi.' },
        { requestId: requestContext.requestId },
      );
    }
  };
}
