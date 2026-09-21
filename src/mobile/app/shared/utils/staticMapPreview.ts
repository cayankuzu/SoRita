import { env } from '@/mobile/app/platform/config/env';
import type { MapMarkerItem } from '@/mobile/app/shared/utils/markerColors';

export const DEFAULT_MINI_MAP_PREVIEW_HEIGHT = 148;

const STATIC_MAP_URL_CACHE = new Map<string, string>();
const MAX_STATIC_MAP_URL_CACHE_ENTRIES = 128;

function getCachedStaticMapUrl(cacheKey: string) {
  if (!STATIC_MAP_URL_CACHE.has(cacheKey)) {
    return undefined;
  }

  const cachedUrl = STATIC_MAP_URL_CACHE.get(cacheKey);
  if (!cachedUrl) {
    return undefined;
  }
  STATIC_MAP_URL_CACHE.delete(cacheKey);
  STATIC_MAP_URL_CACHE.set(cacheKey, cachedUrl);
  return cachedUrl;
}

function rememberStaticMapUrl(cacheKey: string, url: string) {
  STATIC_MAP_URL_CACHE.set(cacheKey, url);
  if (STATIC_MAP_URL_CACHE.size <= MAX_STATIC_MAP_URL_CACHE_ENTRIES) {
    return;
  }

  const oldestKey = STATIC_MAP_URL_CACHE.keys().next().value;
  if (oldestKey) {
    STATIC_MAP_URL_CACHE.delete(oldestKey);
  }
}

export function toStaticMapColor(color?: string) {
  if (!color) {
    return '0x3b82f6';
  }

  if (color.startsWith('#')) {
    return `0x${color.slice(1)}`;
  }

  return color;
}

/**
 * The feed card's map box: the card is inset by 12 and `mapWrap` pads another
 * 12, so 24 a side. This is the estimate used to warm the cache before the box
 * has been laid out - MiniMapPreview asks for its measured width once it has
 * one, because the same component also renders inside discovery tiles less
 * than half this wide.
 */
export function getStaticMapPreviewWidth(viewportWidth: number) {
  return Math.min(480, Math.max(240, viewportWidth - 48));
}

export function buildStaticMapUrl(places: MapMarkerItem[], height: number, width: number) {
  // Keep the native Maps SDK keys isolated from the quota-limited Static Maps key.
  if (!env.googleMapsStaticApiKey || places.length === 0) {
    return null;
  }

  const normalizedPlaces = places
    .slice()
    .sort((left, right) =>
      `${left.lat.toFixed(6)}:${left.lng.toFixed(6)}:${left.markerColor ?? ''}`.localeCompare(
        `${right.lat.toFixed(6)}:${right.lng.toFixed(6)}:${right.markerColor ?? ''}`,
      ),
    );
  const cacheKey = [
    Math.round(height),
    Math.round(width),
    ...normalizedPlaces.map(
      (place) =>
        `${place.lat.toFixed(6)}:${place.lng.toFixed(6)}:${toStaticMapColor(place.markerColor)}`,
    ),
  ].join('|');

  const cachedUrl = getCachedStaticMapUrl(cacheKey);
  if (cachedUrl !== undefined) {
    return cachedUrl;
  }

  const params = new URLSearchParams();
  params.set('size', `${Math.round(width)}x${Math.round(height)}`);
  params.set('scale', '2');
  params.set('maptype', 'roadmap');
  params.set('key', env.googleMapsStaticApiKey);

  if (normalizedPlaces.length === 1) {
    params.set('center', `${normalizedPlaces[0].lat},${normalizedPlaces[0].lng}`);
    params.set('zoom', '15');
  } else {
    params.set('visible', normalizedPlaces.map((place) => `${place.lat},${place.lng}`).join('|'));
  }

  normalizedPlaces.slice(0, 8).forEach((place) => {
    params.append(
      'markers',
      `color:${toStaticMapColor(place.markerColor)}|${place.lat},${place.lng}`,
    );
  });

  const url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
  rememberStaticMapUrl(cacheKey, url);
  return url;
}

export const staticMapPreviewInternals = {
  MAX_STATIC_MAP_URL_CACHE_ENTRIES,
  STATIC_MAP_URL_CACHE,
};
