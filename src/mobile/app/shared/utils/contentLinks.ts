import { env } from '@/mobile/app/platform/config/env';

const DOWNLOAD_PATH = '/download/';
const LISTS_PATH = '/lists/';

function getContentBaseUrl() {
  return env.authWebOrigin.trim().replace(/\/+$/, '');
}

function buildUrl(path: string, query?: Record<string, string | undefined>) {
  const baseOrigin = getContentBaseUrl();

  try {
    const url = new URL(`${baseOrigin}${path}`);

    Object.entries(query || {}).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });

    return url.toString();
  } catch {
    const queryString = Object.entries(query || {})
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    return `${baseOrigin}${path}${queryString ? `?${queryString}` : ''}`;
  }
}

export function buildDownloadUrl() {
  return buildUrl(DOWNLOAD_PATH);
}

export function buildListContentUrl(listId?: string | null, placeId?: string | null) {
  if (!listId) {
    return buildDownloadUrl();
  }

  return buildUrl(LISTS_PATH, {
    listId,
    placeId: placeId || undefined,
  });
}
