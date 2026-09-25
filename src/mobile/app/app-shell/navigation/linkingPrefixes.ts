export function buildNavigationLinkingPrefixes(
  appScheme: string,
  appLinkDomain?: string | null,
) {
  const prefixes = [`${appScheme}://`];

  if (appLinkDomain) {
    prefixes.push(`https://${appLinkDomain}`);
  }

  return prefixes;
}

/**
 * React Navigation 6 parses a link's query with query-string 7, whose
 * decode-uri-component retries a broken %-escape in exponential time
 * (GHSA-vcc3-ghjq-m6fr; the fixed release is ESM-only and cannot replace it).
 * A link that does not decode cleanly opens nothing.
 */
export function isSafeLinkPath(path: string) {
  try {
    decodeURIComponent(path);
    return true;
  } catch {
    return false;
  }
}
