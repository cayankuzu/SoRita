import { env } from '@/mobile/app/platform/config/env';

function getAppPrefix() {
  return `${env.appScheme}://`;
}

export function buildDownloadUrl() {
  return getAppPrefix();
}

export function buildListContentUrl(listId?: string | null, placeId?: string | null) {
  if (!listId) {
    return buildDownloadUrl();
  }

  const placeQuery = placeId ? `?placeId=${encodeURIComponent(placeId)}` : '';
  return `${getAppPrefix()}lists/${encodeURIComponent(listId)}${placeQuery}`;
}
