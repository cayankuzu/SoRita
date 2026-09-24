import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAnchoredFeed } from '@/mobile/app/shared/hooks/useAnchoredFeed';
import { act, renderHook } from '@/mobile/app/test/hookTestUtils';

const items = ['a', 'b', 'c', 'd', 'e', 'f'];

function scrollEvent(y: number) {
  return { nativeEvent: { contentOffset: { x: 0, y } } } as never;
}

describe('useAnchoredFeed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function openOn(startIndex: number) {
    const hook = renderHook(() => useAnchoredFeed({ items, startIndex, viewOffset: 12 }));
    const list = { scrollToIndex: vi.fn() };
    hook.result.current.listRef.current = list as never;
    return { hook, list };
  }

  it('opens on the tapped card, then puts the earlier cards back above it once it settles', () => {
    const { hook } = openOn(4);

    expect(hook.result.current.data).toEqual(['e', 'f']);
    expect(hook.result.current.maintainVisibleContentPosition).toEqual({ minIndexForVisible: 0 });

    act(() => {
      hook.result.current.onContentSizeChange(390, 0);
      vi.advanceTimersByTime(1000);
    });
    expect(hook.result.current.data).toEqual(['e', 'f']);

    act(() => {
      hook.result.current.onContentSizeChange(390, 1200);
      hook.result.current.onContentSizeChange(390, 1300);
      vi.advanceTimersByTime(499);
    });
    expect(hook.result.current.data).toEqual(['e', 'f']);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(hook.result.current.data).toBe(items);

    hook.unmount();
  });

  it('shows the whole feed at once for the first card, and clamps a stale index', () => {
    const first = renderHook(() => useAnchoredFeed({ items, startIndex: 0 }));
    expect(first.result.current.data).toBe(items);
    first.unmount();

    const stale = renderHook(() => useAnchoredFeed({ items, startIndex: 40 }));
    expect(stale.result.current.data).toEqual(['f']);
    stale.unmount();

    const empty = renderHook(() => useAnchoredFeed({ items: [] as string[], startIndex: 3 }));
    expect(empty.result.current.data).toEqual([]);
    empty.unmount();
  });

  it('takes the list back to the tapped card when Android left it at the top', () => {
    const { hook, list } = openOn(4);
    act(() => {
      hook.result.current.onContentSizeChange(390, 1200);
      vi.advanceTimersByTime(500);
    });

    // The earlier cards went in, and the list stayed scrolled to zero.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(list.scrollToIndex).toHaveBeenCalledWith({ animated: false, index: 4, viewOffset: 12 });

    // Not measured yet: step to the furthest measured card, then aim again.
    list.scrollToIndex.mockClear();
    act(() => {
      hook.result.current.onScrollToIndexFailed({ highestMeasuredFrameIndex: 2 } as never);
    });
    expect(list.scrollToIndex).toHaveBeenLastCalledWith({ animated: false, index: 2 });
    act(() => {
      vi.advanceTimersByTime(120);
    });
    expect(list.scrollToIndex).toHaveBeenLastCalledWith({ animated: false, index: 4, viewOffset: 12 });

    // A bounded number of steps.
    list.scrollToIndex.mockClear();
    act(() => {
      for (let step = 0; step < 10; step += 1) {
        hook.result.current.onScrollToIndexFailed({ highestMeasuredFrameIndex: 2 } as never);
        vi.advanceTimersByTime(120);
      }
    });
    expect(list.scrollToIndex.mock.calls.filter(([params]) => params.index === 4)).toHaveLength(5);

    hook.unmount();
  });

  it('leaves the list alone when the card held, or once the person scrolls', () => {
    const held = openOn(4);
    act(() => {
      held.hook.result.current.onContentSizeChange(390, 1200);
      vi.advanceTimersByTime(500);
      held.hook.result.current.onScroll(scrollEvent(2400));
      vi.advanceTimersByTime(300);
    });
    expect(held.list.scrollToIndex).not.toHaveBeenCalled();
    held.hook.unmount();

    const scrolled = openOn(4);
    act(() => {
      scrolled.hook.result.current.onContentSizeChange(390, 1200);
      vi.advanceTimersByTime(500);
      scrolled.hook.result.current.onScrollBeginDrag();
      vi.advanceTimersByTime(300);
      scrolled.hook.result.current.onScrollToIndexFailed({ highestMeasuredFrameIndex: 2 } as never);
      vi.advanceTimersByTime(120);
    });
    expect(scrolled.list.scrollToIndex).not.toHaveBeenCalled();
    scrolled.hook.unmount();
  });

  it('does nothing after the feed closes', () => {
    const { hook, list } = openOn(3);
    act(() => {
      hook.result.current.onContentSizeChange(390, 700);
    });

    hook.unmount();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(list.scrollToIndex).not.toHaveBeenCalled();
  });
});
