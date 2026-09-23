import { env } from '@/mobile/app/platform/config/env';
import { PUBLIC_WEBSITE_URL } from '@/mobile/app/platform/config/publicWebsite';

function buildQuery(params: Record<string, string | null | undefined>) {
  const pairs = Object.entries(params).flatMap(([key, value]) =>
    value ? [`${key}=${encodeURIComponent(value)}`] : [],
  );
  return pairs.length > 0 ? `?${pairs.join('&')}` : '';
}

/**
 * Where a shared link sends someone without the content: the app itself on a
 * verified app-link host, otherwise the website's download page.
 */
export function buildDownloadUrl() {
  return env.appLinkDomain ? `https://${env.appLinkDomain}` : `${PUBLIC_WEBSITE_URL}/download/`;
}

/**
 * The link a list or place is shared with. A custom-scheme link is plain,
 * unclickable text in WhatsApp or Instagram, so it is always HTTPS: the
 * verified app-link host when there is one, otherwise the website's handoff
 * page, which opens the app or offers the stores.
 */
export function buildListContentUrl(listId?: string | null, placeId?: string | null) {
  if (!listId) {
    return buildDownloadUrl();
  }

  if (env.appLinkDomain) {
    return `https://${env.appLinkDomain}/lists/${encodeURIComponent(listId)}${buildQuery({ placeId })}`;
  }
  return `${PUBLIC_WEBSITE_URL}/lists/${buildQuery({ listId, placeId })}`;
}
