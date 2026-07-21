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

  it('keeps text intact when the search is empty', () => {
    expect(splitHighlightedText('Kadıköy', ' ')).toEqual([
      { highlighted: false, text: 'Kadıköy' },
    ]);
  });
});
