import { Linking } from 'react-native';

function sanitizeRawCandidate(rawUrl: string) {
  const trimmed = rawUrl.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed;
}

function stripIpv6Brackets(hostname: string) {
  return hostname.replace(/^\[|\]$/g, '');
}

function parseIpv4Octets(hostname: string) {
  const parts = hostname.split('.');

  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => Number.parseInt(part, 10));

  if (octets.some((value, index) => Number.isNaN(value) || value < 0 || value > 255 || String(value) !== parts[index])) {
    return null;
  }

  return octets;
}

function isIpv6Hostname(hostname: string) {
  const normalized = stripIpv6Brackets(hostname);

  return normalized.includes(':');
}

function isPrivateOrLocalIpHostname(hostname: string) {
  const normalized = stripIpv6Brackets(hostname.toLowerCase());
  const ipv4Octets = parseIpv4Octets(normalized);

  if (ipv4Octets) {
    const [first, second] = ipv4Octets;

    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  if (!isIpv6Hostname(normalized)) {
    return false;
  }

  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  );
}

function hasBlockedHostnamePattern(hostname: string) {
  const normalized = hostname.toLowerCase();

  return (
    normalized === 'localhost' ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.localdomain') ||
    normalized.endsWith('.internal') ||
    normalized.split('.').some((label) => label.startsWith('xn--'))
  );
}

function isLikelyPublicHostname(hostname: string) {
  const normalized = stripIpv6Brackets(hostname.toLowerCase());

  if (!normalized) {
    return false;
  }

  if (parseIpv4Octets(normalized) || isIpv6Hostname(normalized)) {
    return true;
  }

  if (!/^[a-z0-9.-]+$/.test(normalized)) {
    return false;
  }

  const labels = normalized.split('.').filter(Boolean);
  if (labels.length < 2) {
    return false;
  }

  if (
    labels.some(
      (label) =>
        label.length === 0 ||
        label.length > 63 ||
        label.startsWith('-') ||
        label.endsWith('-'),
    )
  ) {
    return false;
  }

  const topLevelLabel = labels[labels.length - 1];
  return /^[a-z]{2,63}$/i.test(topLevelLabel);
}

export function normalizeExternalUrlCandidate(rawUrl: string): string | null {
  const candidate = sanitizeRawCandidate(rawUrl);
  if (!candidate) {
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    return candidate;
  }

  if (/^www\./i.test(candidate)) {
    return `https://${candidate}`;
  }

  if (/^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s<>()]*)?$/i.test(candidate)) {
    return `https://${candidate}`;
  }

  return null;
}

export function normalizeSafeExternalUrl(rawUrl: string): string | null {
  const candidate = normalizeExternalUrlCandidate(rawUrl);
  if (!candidate) {
    return null;
  }

  let parsed: URL;

  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') {
    return null;
  }

  if (parsed.username || parsed.password || parsed.port) {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (candidate.length > 2048) {
    return null;
  }

  if (!isLikelyPublicHostname(hostname)) {
    return null;
  }

  if (hasBlockedHostnamePattern(hostname) || isPrivateOrLocalIpHostname(hostname)) {
    return null;
  }

  return parsed.toString();
}

export function isSafeExternalUrl(rawUrl: string) {
  return normalizeSafeExternalUrl(rawUrl) !== null;
}

export async function openSafeExternalUrl(rawUrl: string) {
  const safeUrl = normalizeSafeExternalUrl(rawUrl);

  if (!safeUrl) {
    return false;
  }

  try {
    await Linking.openURL(safeUrl);
    return true;
  } catch {
    return false;
  }
}
