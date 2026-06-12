import { describe, expect, it } from 'vitest';

import {
  buildAdaptiveFlatListProps,
  isTabletLikeViewport,
} from '@/mobile/app/shared/utils/flatList';

describe('flatList utils', () => {
  it('detects tablet-like viewports from the smaller screen dimension', () => {
    expect(isTabletLikeViewport(1024, 768)).toBe(true);
    expect(isTabletLikeViewport(430, 932)).toBe(false);
  });

  it('builds conservative defaults for phone-sized android lists', () => {
    expect(
      buildAdaptiveFlatListProps({
        itemCount: 20,
        platformOS: 'android',
        viewportHeight: 932,
        viewportWidth: 430,
      }),
    ).toEqual({
      contentInsetAdjustmentBehavior: 'automatic',
      initialNumToRender: 4,
      keyboardDismissMode: 'on-drag',
      keyboardShouldPersistTaps: 'handled',
      maxToRenderPerBatch: 6,
      removeClippedSubviews: true,
      updateCellsBatchingPeriod: 50,
      windowSize: 6,
    });
  });

  it('widens render windows slightly for tablet-sized ios layouts', () => {
    expect(
      buildAdaptiveFlatListProps({
        itemCount: 20,
        platformOS: 'ios',
        viewportHeight: 1024,
        viewportWidth: 768,
      }),
    ).toEqual({
      contentInsetAdjustmentBehavior: 'automatic',
      initialNumToRender: 6,
      keyboardDismissMode: 'interactive',
      keyboardShouldPersistTaps: 'handled',
      maxToRenderPerBatch: 8,
      removeClippedSubviews: false,
      updateCellsBatchingPeriod: 40,
      windowSize: 8,
    });
  });

  it('keeps clipping disabled for android lists that contain native maps', () => {
    expect(
      buildAdaptiveFlatListProps({
        containsNativeMaps: true,
        itemCount: 20,
        platformOS: 'android',
        viewportHeight: 932,
        viewportWidth: 430,
      }).removeClippedSubviews,
    ).toBe(false);
  });
});
