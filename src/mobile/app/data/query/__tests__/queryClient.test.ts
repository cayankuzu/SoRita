import { describe, expect, it } from 'vitest';

import { queryClient } from '@/mobile/app/data/query/queryClient';

describe('queryClient', () => {
  it('configures sane default query timings and retry behaviour', () => {
    const defaults = queryClient.getDefaultOptions();
    const retry = defaults.queries?.retry as ((failureCount: number, error: unknown) => boolean) | undefined;

    expect(defaults.queries?.gcTime).toBe(1000 * 60 * 15);
    expect(defaults.queries?.staleTime).toBe(1000 * 30);
    expect(defaults.queries?.refetchOnReconnect).toBe(true);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
    expect(defaults.mutations?.retry).toBe(false);
    expect(retry?.(0, { status: 500 })).toBe(true);
    expect(retry?.(0, { status: 404 })).toBe(false);
    expect(retry?.(2, new Error('timeout'))).toBe(false);
  });
});
