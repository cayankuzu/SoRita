import { describe, expect, it } from 'vitest';

import {
  MOSAIC_GAP,
  calculateAppLayout,
  getResponsiveDiscoveryColumnCount,
  getResponsiveGalleryColumnCount,
  getResponsiveDiscoveryTileWidth,
  getResponsiveGridLayout,
  getResponsiveScreenPadding,
} from '@/mobile/app/shared/utils/layout';

describe('responsive layout helpers', () => {
  it('lays a mosaic out edge to edge, three across on a phone and more on a tablet', () => {
    expect(getResponsiveGridLayout(390, 844, { strategy: 'mosaic' })).toEqual({
      columnCount: 3,
      columnWidth: Math.floor((390 - 2 * MOSAIC_GAP) / 3),
      gap: MOSAIC_GAP,
      horizontalPadding: 0,
    });
    expect(getResponsiveGridLayout(360, 740, { strategy: 'mosaic' }).columnCount).toBe(3);
    expect(getResponsiveGridLayout(700, 1000, { strategy: 'mosaic' }).columnCount).toBe(4);
    expect(getResponsiveGridLayout(1100, 800, { strategy: 'mosaic' }).columnCount).toBe(5);
  });

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

  it('keeps rich cards usable and scales media-first gallery columns separately', () => {
    expect(getResponsiveDiscoveryColumnCount(360, 800)).toBe(1);
    expect(getResponsiveDiscoveryColumnCount(480, 900)).toBe(2);
    expect(getResponsiveDiscoveryColumnCount(600, 900)).toBe(3);
    expect(getResponsiveGalleryColumnCount(320, 720)).toBe(3);
    expect(getResponsiveGalleryColumnCount(840, 1180)).toBe(6);
  });

  it.each([
    { expectedColumnWidth: 89, height: 720, width: 320 },
    { expectedColumnWidth: 112, height: 844, width: 390 },
  ])(
    'fits gallery columns, gaps, and padding inside a $width dp compact viewport',
    ({ expectedColumnWidth, height, width }) => {
      const gap = 10;
      const layout = getResponsiveGridLayout(width, height, {
        gap,
        strategy: 'gallery',
      });
      const occupiedWidth =
        layout.horizontalPadding * 2 +
        layout.columnWidth * layout.columnCount +
        gap * (layout.columnCount - 1);

      expect(layout).toMatchObject({
        columnCount: 3,
        columnWidth: expectedColumnWidth,
      });
      expect(occupiedWidth).toBeLessThanOrEqual(width);
    },
  );

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
