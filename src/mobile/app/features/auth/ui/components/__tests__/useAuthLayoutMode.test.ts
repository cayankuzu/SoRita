import { describe, expect, it } from 'vitest';

import { isCompactAuthLayout } from '@/mobile/app/features/auth/ui/components/authLayout';

describe('auth responsive composition', () => {
  it.each([
    { width: 320, height: 568 },
    { width: 360, height: 640 },
  ])('uses compact composition at $width x $height', ({ height, width }) => {
    expect(isCompactAuthLayout({ fontScale: 1, height, isLandscape: false, width })).toBe(true);
  });

  it.each([1.3, 1.5, 2])('uses compact composition at %sx text', (fontScale) => {
    expect(
      isCompactAuthLayout({ fontScale, height: 914, isLandscape: false, width: 411 }),
    ).toBe(true);
  });

  it('keeps the regular composition on a tall phone and compacts landscape/tablet splits', () => {
    expect(
      isCompactAuthLayout({ fontScale: 1, height: 914, isLandscape: false, width: 411 }),
    ).toBe(false);
    expect(
      isCompactAuthLayout({ fontScale: 1, height: 600, isLandscape: true, width: 960 }),
    ).toBe(true);
  });
});
