import { describe, expect, it } from 'vitest';

import { splitHighlightedText } from '@/mobile/app/shared/components/ui/HighlightedText';

describe('HighlightedText', () => {
  it('highlights every case-insensitive search match without changing the copy', () => {
    const segments = splitHighlightedText('SoRita ile sorita', 'sorita');

    expect(segments).toEqual([
      { highlighted: true, text: 'SoRita' },
      { highlighted: false, text: ' ile ' },
      { highlighted: true, text: 'sorita' },
    ]);
    expect(segments.map((segment) => segment.text).join('')).toBe('SoRita ile sorita');
  });

  it('marks what search matched: Turkish letters, a Latin capital I, an @ before a username', () => {
    expect(splitHighlightedText('Şükrü Saraçoğlu', 'sukru')).toEqual([
      { highlighted: true, text: 'Şükrü' },
      { highlighted: false, text: ' Saraçoğlu' },
    ]);
    expect(splitHighlightedText('Istanbul Modern', 'ist')).toEqual([
      { highlighted: true, text: 'Ist' },
      { highlighted: false, text: 'anbul Modern' },
    ]);
    expect(splitHighlightedText('@ayse_k', '@ayse')).toEqual([
      { highlighted: false, text: '@' },
      { highlighted: true, text: 'ayse' },
      { highlighted: false, text: '_k' },
    ]);
  });

  it('keeps text intact when the search is empty', () => {
    expect(splitHighlightedText('Kadıköy', ' ')).toEqual([
      { highlighted: false, text: 'Kadıköy' },
    ]);
  });
});
