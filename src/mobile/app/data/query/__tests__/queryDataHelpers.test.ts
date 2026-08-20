import { describe, expect, it } from 'vitest';

import {
  flattenPages,
  isInfiniteData,
  mapInfinitePages,
} from '@/mobile/app/data/query/queryDataHelpers';

describe('queryDataHelpers', () => {
  it('handles arrays, malformed data, and duplicate paginated ids', () => {
    const array = [{ id: 'array' }];
    expect(flattenPages(array)).toBe(array);
    expect(flattenPages(null)).toEqual([]);
    expect(isInfiniteData({ pages: [], pageParams: [] })).toBe(true);
    expect(isInfiniteData({ pages: [] })).toBe(false);
    expect(flattenPages({
      pageParams: [0, 1],
      pages: [[{ id: 'one' }, { id: 'duplicate' }], [{ id: 'duplicate' }, { id: 'two' }]],
    })).toEqual([{ id: 'one' }, { id: 'duplicate' }, { id: 'two' }]);
  });

  it('maps every page and preserves an absent cache', () => {
    expect(mapInfinitePages(undefined, (item: { id: string }) => item)).toBeUndefined();
    expect(mapInfinitePages(
      { pageParams: [0], pages: [[{ id: 'one', count: 1 }]] },
      (item) => ({ ...item, count: item.count + 1 }),
    )).toEqual({ pageParams: [0], pages: [[{ id: 'one', count: 2 }]] });
  });
});
