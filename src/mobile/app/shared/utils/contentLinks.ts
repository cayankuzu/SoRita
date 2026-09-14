import { env } from '@/mobile/app/platform/config/env';

function getAppPrefix() {
  return env.appLinkDomain ? `https://${env.appLinkDomain}` : `${env.appScheme}://`;
}

export function buildDownloadUrl() {
  return getAppPrefix();
}

export function buildListContentUrl(listId?: string | null, placeId?: string | null) {
  if (!listId) {
    return buildDownloadUrl();
  }

  const placeQuery = placeId ? `?placeId=${encodeURIComponent(placeId)}` : '';
  const pathSeparator = env.appLinkDomain ? '/' : '';
  return `${getAppPrefix()}${pathSeparator}lists/${encodeURIComponent(listId)}${placeQuery}`;
}
