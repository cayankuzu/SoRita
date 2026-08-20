import { callJsonEdgeFunction } from '@/mobile/app/platform/api/edgeFunctions';
import { env } from '@/mobile/app/platform/config/env';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { t } from '@/mobile/app/shared/i18n';

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

export async function searchPlacesByText(query: string): Promise<GeocodingSearchResult[]> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const accessToken = await getAccessToken();
  const response = await callJsonEdgeFunction<{ results: GeocodingSearchResult[] }>(
    env.supabaseMapsFunctionName,
    {
      action: 'search',
      query: trimmedQuery,
    },
    { accessToken },
  );

  return response.results;
}

export async function reverseGeocodeLocation(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodingResult> {
  const accessToken = await getAccessToken();
  const response = await callJsonEdgeFunction<{ result: ReverseGeocodingResult }>(
    env.supabaseMapsFunctionName,
    {
      action: 'reverse',
      latitude,
      longitude,
    },
    { accessToken },
  );

  return response.result;
}
