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
