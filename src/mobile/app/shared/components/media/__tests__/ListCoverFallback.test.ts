import { describe, expect, it } from 'vitest';

import { pickListCoverWash } from '@/mobile/app/shared/components/media/ListCoverFallback';

describe('pickListCoverWash', () => {
  it('gives one list the same wash every time', () => {
    expect(pickListCoverWash('list-42')).toBe(pickListCoverWash('list-42'));
  });

  it('spreads different lists across more than one wash', () => {
    const washes = new Set(
      Array.from({ length: 24 }, (_, index) => pickListCoverWash(`list-${index}`)),
    );

    expect(washes.size).toBeGreaterThan(1);
  });
});
