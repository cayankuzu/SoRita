import { describe, expect, it } from 'vitest';

import { mapWithConcurrency } from '@/shared/utils/mapWithConcurrency';

describe('mapWithConcurrency', () => {
  it('preserves result order and never exceeds the worker budget', async () => {
    let active = 0;
    let peak = 0;
    const results = await mapWithConcurrency([30, 10, 20, 5], 2, async (delay, index) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, delay));
      active -= 1;
      return index;
    });

    expect(results).toEqual([0, 1, 2, 3]);
    expect(peak).toBe(2);
  });

  it('waits for in-flight workers before rejecting', async () => {
    const completed: number[] = [];

    await expect(
      mapWithConcurrency([0, 1, 2], 2, async (value) => {
        if (value === 0) {
          throw new Error('failed');
        }

        await Promise.resolve();
        completed.push(value);
        return value;
      }),
    ).rejects.toThrow('failed');
    expect(completed).toEqual([1]);
  });

  it('rejects invalid concurrency', async () => {
    await expect(mapWithConcurrency([1], 0, async (value) => value)).rejects.toThrow(
      'positive integer',
    );
  });
});
