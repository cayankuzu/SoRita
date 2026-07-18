import { describe, expect, it } from 'vitest';

import {
  clampPageProgress,
  resolvePagedScrollIndex,
  shouldRenderPagedItem,
} from '@/mobile/app/shared/components/navigation/SwipeableCategoryPager';

describe('clampPageProgress', () => {
  it('keeps animated progress inside the pager range', () => {
    expect(clampPageProgress(-1.5, 4)).toBe(0);
    expect(clampPageProgress(1.35, 4)).toBe(1.35);
    expect(clampPageProgress(8, 4)).toBe(3);
    expect(clampPageProgress(Number.NaN, 4)).toBe(0);
  });
});

describe('resolvePagedScrollIndex', () => {
  it('keeps the current tab until the swipe crosses the early visual threshold', () => {
    expect(resolvePagedScrollIndex(0.07, 0, 4)).toBe(0);
    expect(resolvePagedScrollIndex(0.08, 0, 4)).toBe(1);
  });

  it('moves backward early and clamps indexes safely', () => {
    expect(resolvePagedScrollIndex(0.93, 1, 4)).toBe(1);
    expect(resolvePagedScrollIndex(0.91, 1, 4)).toBe(0);
    expect(resolvePagedScrollIndex(3.4, 3, 4)).toBe(3);
    expect(resolvePagedScrollIndex(-0.4, 0, 4)).toBe(0);
  });

  it('pre-renders farther pages during lazy swipes to avoid white gaps', () => {
    expect(shouldRenderPagedItem(3, 1, false, true)).toBe(true);
    expect(shouldRenderPagedItem(4, 1, false, true)).toBe(false);
    expect(shouldRenderPagedItem(4, 1, true, true)).toBe(true);
    expect(shouldRenderPagedItem(4, 1, false, false)).toBe(true);
  });
});
