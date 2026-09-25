import { describe, expect, it } from 'vitest';

import { withRetryJitter } from '@/mobile/app/shared/utils/retryJitter';

describe('withRetryJitter', () => {
  it('spreads a delay evenly around its value', () => {
    expect(withRetryJitter(10_000, 0.2, () => 0)).toBe(8_000);
    expect(withRetryJitter(10_000, 0.2, () => 0.5)).toBe(10_000);
    expect(withRetryJitter(10_000, 0.2, () => 1)).toBe(12_000);
  });

  it('never schedules a retry at zero', () => {
    expect(withRetryJitter(0, 0.2, () => 0)).toBe(1);
    expect(withRetryJitter(1, 1, () => 0)).toBe(1);
  });
});
