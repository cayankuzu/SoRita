import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook } from '@/mobile/app/test/hookTestUtils';
import { useAutoDismissingNotice } from '@/mobile/app/shared/hooks/useAutoDismissingNotice';

describe('useAutoDismissingNotice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a notice and clears it once its time is up', () => {
    const { result } = renderHook(() => useAutoDismissingNotice<string>(2_800));

    expect(result.current.notice).toBeNull();

    act(() => {
      result.current.show('Kaydedilemedi');
    });
    expect(result.current.notice).toBe('Kaydedilemedi');

    act(() => {
      vi.advanceTimersByTime(2_799);
    });
    expect(result.current.notice).toBe('Kaydedilemedi');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.notice).toBeNull();
  });

  it('a second notice restarts the clock instead of inheriting the first one', () => {
    const { result } = renderHook(() => useAutoDismissingNotice<string>(1_000));

    act(() => {
      result.current.show('ilk');
    });
    act(() => {
      vi.advanceTimersByTime(900);
      result.current.show('ikinci');
    });
    act(() => {
      vi.advanceTimersByTime(900);
    });

    // The first notice's timer would have fired by now and taken the second
    // one down with it.
    expect(result.current.notice).toBe('ikinci');
  });

  it('clearing drops the pending timer so it cannot fire later', () => {
    const { result } = renderHook(() => useAutoDismissingNotice<string>(1_000));

    act(() => {
      result.current.show('görünür');
      result.current.clear();
    });
    expect(result.current.notice).toBeNull();

    act(() => {
      result.current.show('yeniden');
      vi.advanceTimersByTime(999);
    });
    expect(result.current.notice).toBe('yeniden');
  });

  it('leaves no timer behind when the screen goes away', () => {
    const { result, unmount } = renderHook(() => useAutoDismissingNotice<string>(1_000));

    act(() => {
      result.current.show('açık');
    });
    unmount();

    expect(() => vi.advanceTimersByTime(2_000)).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
});
