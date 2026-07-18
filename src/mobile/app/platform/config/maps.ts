import { env } from '@/mobile/app/platform/config/env';

export const mapConfig = {
  googleMapsApiKey: env.googleMapsApiKey,
};

type ExternalMapUrlOptions = {
  name?: string;
  address?: string;
  placeId?: string;
  query?: string;
};

function normalizeMapQueryValue(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildExternalMapQuery(
  latitude: number,
  longitude: number,
  options: ExternalMapUrlOptions,
) {
  const explicitQuery = normalizeMapQueryValue(options.query);
  if (explicitQuery) {
    return explicitQuery;
  }

  const normalizedName = normalizeMapQueryValue(options.name);
  const normalizedAddress = normalizeMapQueryValue(options.address);

  if (normalizedName && normalizedAddress) {
    return `${normalizedName}, ${normalizedAddress}`;
  }

  if (normalizedAddress) {
    return normalizedAddress;
  }

  if (normalizedName) {
    return `${normalizedName}, ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  }

  return `${latitude},${longitude}`;
}

export function buildExternalMapUrl(
  latitude: number,
  longitude: number,
  options: ExternalMapUrlOptions = {},
) {
  const params = new URLSearchParams();
  params.set('api', '1');
  params.set('query', buildExternalMapQuery(latitude, longitude, options));

  const normalizedPlaceId = normalizeMapQueryValue(options.placeId);
  if (normalizedPlaceId) {
    params.set('query_place_id', normalizedPlaceId);
  }

  return `https://www.google.com/maps/search/?${params.toString()}`;
}
