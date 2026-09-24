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

// Folds Turkish letters and case one character for one, so "Şükrü" and
// "sukru" compare equal and positions still line up with the original text.
export function foldSearchText(value: string) {
  return value
    .replace(/[çÇğĞıIİöÖşŞüÜ]/g, (char) => TURKISH_SEARCH_CHAR_MAP[char] || char)
    .toLowerCase();
}

export function normalizeSearchText(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return '';
  }

  return foldSearchText(trimmed).replace(/\s+/g, ' ');
}

// What someone typed into a search box: "@ayse" looks for the username "ayse".
export function normalizeSearchQuery(value?: string | null) {
  return normalizeSearchText(value).replace(/^@+/, '').trim();
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
