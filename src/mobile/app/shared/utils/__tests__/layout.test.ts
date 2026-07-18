import { describe, expect, it } from 'vitest';

import {
  calculateAppLayout,
  getResponsiveDiscoveryColumnCount,
  getResponsiveDiscoveryTileWidth,
  getResponsiveScreenPadding,
} from '@/mobile/app/shared/utils/layout';

describe('responsive layout helpers', () => {
  it('uses compact padding and a single discovery column for very narrow split windows', () => {
    expect(getResponsiveScreenPadding(320, 720)).toBe(16);
    expect(getResponsiveDiscoveryColumnCount(320, 720)).toBe(1);
    expect(getResponsiveDiscoveryTileWidth(320, 720)).toBe(288);
  });

  it('scales discovery columns and gaps on wider windows', () => {
    expect(getResponsiveScreenPadding(840, 1180)).toBe(32);
    expect(getResponsiveDiscoveryColumnCount(840, 1180)).toBe(3);
    expect(getResponsiveDiscoveryTileWidth(840, 1180, 12)).toBe(250);
  });

  it('reports constrained content width and safe-area adjusted height', () => {
    expect(
      calculateAppLayout({
        bottomInset: 24,
        height: 900,
        maxContentWidth: 520,
        topInset: 36,
        width: 780,
      }),
    ).toMatchObject({
      contentWidth: 520,
      heightClass: 'tall',
      usableHeight: 840,
      windowClass: 'medium',
    });
  });
});
