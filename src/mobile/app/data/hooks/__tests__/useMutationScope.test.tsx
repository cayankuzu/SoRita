import { describe, expect, it } from 'vitest';

import { useMutationScope } from '@/mobile/app/data/hooks/useMutationScope';
import { renderHook } from '@/mobile/app/test/hookTestUtils';

describe('useMutationScope', () => {
  it('serializes one control instance without blocking unrelated controls', () => {
    const first = renderHook(() => useMutationScope('place-like'));
    const firstId = first.result.current.id;
    first.rerender();
    const second = renderHook(() => useMutationScope('place-like'));

    expect(first.result.current.id).toBe(firstId);
    expect(second.result.current.id).not.toBe(firstId);
  });
});
