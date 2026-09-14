import { describe, expect, it } from 'vitest';

import { normalizeSearchText } from '@/mobile/app/shared/utils/textSort';

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
