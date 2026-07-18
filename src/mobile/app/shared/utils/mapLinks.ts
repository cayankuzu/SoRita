import {
  Linking,
  Platform,
} from 'react-native';

import { buildExternalMapUrl } from '@/mobile/app/platform/config/maps';

type OpenMapLocationOptions = {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
  placeId?: string;
  query?: string;
};

function normalizeMapText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildMapQuery({
  lat,
  lng,
  name,
  address,
  query,
}: OpenMapLocationOptions) {
  const explicitQuery = normalizeMapText(query);
  if (explicitQuery) {
    return explicitQuery;
  }

  const normalizedName = normalizeMapText(name);
  const normalizedAddress = normalizeMapText(address);

  if (normalizedName && normalizedAddress) {
    return `${normalizedName}, ${normalizedAddress}`;
  }

  if (normalizedAddress) {
    return normalizedAddress;
  }

  if (normalizedName) {
    return `${normalizedName}, ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }

  return `${lat},${lng}`;
}

function sanitizeGeoLabel(value: string) {
  return value.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildMapAppUrlCandidates(options: OpenMapLocationOptions) {
  const coordinates = `${options.lat},${options.lng}`;
  const query = buildMapQuery(options);
  const label = sanitizeGeoLabel(
    normalizeMapText(options.name) ||
      normalizeMapText(options.address) ||
      query,
  );
  const webFallbackUrl = buildExternalMapUrl(options.lat, options.lng, {
    name: options.name,
    address: options.address,
    placeId: options.placeId,
    query: options.query,
  });

  if (Platform.OS === 'ios') {
    const encodedQuery = encodeURIComponent(query);

    return [
      `maps://?q=${encodedQuery}&ll=${coordinates}`,
      `http://maps.apple.com/?q=${encodedQuery}&ll=${coordinates}`,
      webFallbackUrl,
    ];
  }

  return [
    `geo:0,0?q=${encodeURIComponent(query)}`,
    `geo:${coordinates}?q=${encodeURIComponent(`${coordinates}(${label})`)}`,
    webFallbackUrl,
  ];
}

export async function openMapLocationInApp(options: OpenMapLocationOptions) {
  const candidates = buildMapAppUrlCandidates(options);

  for (const candidate of candidates) {
    try {
      const supported = await Linking.canOpenURL(candidate);
      if (!supported) {
        continue;
      }

      await Linking.openURL(candidate);
      return true;
    } catch {
      continue;
    }
  }

  return false;
}
