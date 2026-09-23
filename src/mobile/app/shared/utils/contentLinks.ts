import { env } from '@/mobile/app/platform/config/env';

function buildQuery(params: Record<string, string | null | undefined>) {
  const pairs = Object.entries(params).flatMap(([key, value]) =>
    value ? [`${key}=${encodeURIComponent(value)}`] : [],
  );
  return pairs.length > 0 ? `?${pairs.join('&')}` : '';
}

/**
 * Where a shared link sends someone without the content: the app itself on a
 * verified app-link host, the website's download page, or, in development,
 * the app's own scheme.
 */
export function buildDownloadUrl() {
  if (env.appLinkDomain) {
    return `https://${env.appLinkDomain}`;
  }
  if (env.publicWebUrl) {
    return `${env.publicWebUrl}/download/`;
  }
  return `${env.appScheme}://`;
}

/**
 * The link a list or place is shared with. A custom-scheme link is plain,
 * unclickable text in WhatsApp or Instagram, so a release shares an HTTPS
 * link: the verified app-link host when there is one, otherwise the
 * website's handoff page, which opens the app or offers the stores.
 */
export function buildListContentUrl(listId?: string | null, placeId?: string | null) {
  if (!listId) {
    return buildDownloadUrl();
  }

  if (env.appLinkDomain) {
    return `https://${env.appLinkDomain}/lists/${encodeURIComponent(listId)}${buildQuery({ placeId })}`;
  }
  if (env.publicWebUrl) {
    return `${env.publicWebUrl}/lists/${buildQuery({ listId, placeId })}`;
  }
  return `${env.appScheme}://lists/${encodeURIComponent(listId)}${buildQuery({ placeId })}`;
}
