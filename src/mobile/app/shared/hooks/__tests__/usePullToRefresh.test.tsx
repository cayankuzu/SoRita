import { describe, expect, it, vi } from 'vitest';

import { usePullToRefresh } from '@/mobile/app/shared/hooks/usePullToRefresh';
import { act, renderHook } from '@/mobile/app/test/hookTestUtils';

describe('usePullToRefresh', () => {
  it('tracks only the real refresh operation without an artificial minimum delay', async () => {
    let resolveRefresh!: () => void;
    const refresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const hook = renderHook(() => usePullToRefresh(refresh));

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = hook.result.current.onRefresh();
    });
    expect(hook.result.current.refreshing).toBe(true);

    await act(async () => {
      resolveRefresh();
      await refreshPromise;
    });

    expect(hook.result.current.refreshing).toBe(false);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });
});
