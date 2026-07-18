const TURKISH_SEARCH_CHAR_MAP: Record<string, string> = {
  'ç': 'c',
  'Ç': 'c',
  'ğ': 'g',
  'Ğ': 'g',
  'ı': 'i',
  'I': 'i',
  'İ': 'i',
  'ö': 'o',
  'Ö': 'o',
  'ş': 's',
  'Ş': 's',
  'ü': 'u',
  'Ü': 'u',
};

export function normalizeSearchText(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return '';
  }

  return trimmed
    .replace(/[çÇğĞıIİöÖşŞüÜ]/g, (char) => TURKISH_SEARCH_CHAR_MAP[char] || char)
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function compareLocalizedText(left: string, right: string) {
  const normalizedLeft = normalizeSearchText(left);
  const normalizedRight = normalizeSearchText(right);

  if (normalizedLeft < normalizedRight) {
    return -1;
  }

  if (normalizedLeft > normalizedRight) {
    return 1;
  }

  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

export function uniqueSortedText(items: string[]) {
  return Array.from(new Set(items)).sort(compareLocalizedText);
}
