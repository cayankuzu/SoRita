import { describe, expect, it } from 'vitest';

import { normalizeSearchQuery, normalizeSearchText } from '@/mobile/app/shared/utils/textSort';

describe('normalizeSearchText', () => {
  it.each([
    ['IĞDIR', 'igdir'],
    ['İstanbul', 'istanbul'],
    ['Çağrı Şöleni Ürgüp', 'cagri soleni urgup'],
    ['  Özgür   Çelik  ', 'ozgur celik'],
  ])('normalizes Turkish search text %s', (input, expected) => {
    expect(normalizeSearchText(input)).toBe(expected);
  });
});

describe('normalizeSearchQuery', () => {
  it.each([
    ['@Ayşe', 'ayse'],
    ['  @@cayan ', 'cayan'],
    ['@ ', ''],
    ['kafe@moda', 'kafe@moda'],
  ])('reads what was typed into a search box %s', (input, expected) => {
    expect(normalizeSearchQuery(input)).toBe(expected);
  });
});
