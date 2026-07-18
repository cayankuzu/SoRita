import { describe, expect, it } from 'vitest';

import {
  PLACE_NOTES_MAX_LENGTH,
  PLACE_TITLE_MAX_LENGTH,
  clampMultilineTextLength,
  encodePersistedLineBreaks,
  normalizeLineBreaks,
  trimPreservingLineBreaks,
} from '@/mobile/app/shared/validation/contentLimits';

describe('contentLimits', () => {
  it('uses the updated place title and notes limits', () => {
    expect(PLACE_TITLE_MAX_LENGTH).toBe(200);
    expect(PLACE_NOTES_MAX_LENGTH).toBe(500);
  });

  it('normalizes and trims multiline text without collapsing inner line breaks', () => {
    expect(normalizeLineBreaks('A\r\nB\rC')).toBe('A\nB\nC');
    expect(normalizeLineBreaks('A\u2028B\u2029C')).toBe('A\nB\nC');
    expect(clampMultilineTextLength('A\r\nB\rC', 5)).toBe('A\nB\nC');
    expect(trimPreservingLineBreaks('\r\nA\nV\nB\r\n')).toBe('A\nV\nB');
    expect(encodePersistedLineBreaks('A\nV\nB')).toBe('A\u2028V\u2028B');
  });
});
