import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAnchoredFeed } from '@/mobile/app/shared/hooks/useAnchoredFeed';
import { act, renderHook } from '@/mobile/app/test/hookTestUtils';

const items = ['a', 'b', 'c', 'd', 'e', 'f'];

describe('useAnchoredFeed', () => {
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const runFrames = () => {
    const pending = frames;
    frames = [];
    act(() => {
      pending.forEach((callback) => callback(0));
    });
  };

  it('opens on the tapped card, then puts the earlier cards back above it', () => {
    const hook = renderHook(() => useAnchoredFeed({ items, startIndex: 4 }));

    expect(hook.result.current.data).toEqual(['e', 'f']);
    expect(hook.result.current.maintainVisibleContentPosition).toEqual({ minIndexForVisible: 0 });

    act(() => {
      hook.result.current.onContentSizeChange(390, 1200);
    });
    expect(hook.result.current.data).toEqual(['e', 'f']);

    runFrames();
    expect(hook.result.current.data).toBe(items);

    hook.unmount();
  });

  it('waits for the tapped card to have a size before adding cards above it', () => {
    const hook = renderHook(() => useAnchoredFeed({ items, startIndex: 2 }));

    act(() => {
      hook.result.current.onContentSizeChange(390, 0);
    });
    expect(frames).toHaveLength(0);
    expect(hook.result.current.data).toEqual(['c', 'd', 'e', 'f']);

    act(() => {
      hook.result.current.onContentSizeChange(390, 800);
      hook.result.current.onContentSizeChange(390, 900);
    });
    expect(frames).toHaveLength(1);

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
    act(() => {
      empty.result.current.onContentSizeChange(390, 24);
    });
    expect(frames).toHaveLength(0);
    empty.unmount();
  });

  it('goes back to the tapped card when Android showed the first one instead', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const hook = renderHook(() => useAnchoredFeed({ items, startIndex: 4, viewOffset: 12 }));
    const list = { scrollToIndex: vi.fn() };
    hook.result.current.listRef.current = list as never;

    act(() => {
      hook.result.current.onContentSizeChange(390, 1200);
    });
    runFrames();
    // The cards above went in, but the list did not hold the tapped card.
    act(() => {
      hook.result.current.onViewableItemsChanged({
        viewableItems: [{ index: 0, isViewable: true, item: 'a', key: 'a' }],
      } as never);
      vi.advanceTimersByTime(250);
    });
    expect(list.scrollToIndex).toHaveBeenCalledWith({ animated: false, index: 4, viewOffset: 12 });

    // Not measured yet: try again shortly, a bounded number of times.
    list.scrollToIndex.mockClear();
    act(() => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        hook.result.current.onScrollToIndexFailed({ averageItemLength: 0, highestMeasuredFrameIndex: 0, index: 4 });
        vi.advanceTimersByTime(120);
      }
    });
    expect(list.scrollToIndex).toHaveBeenCalledTimes(3);

    hook.unmount();
    vi.useRealTimers();
  });

  it('leaves the list alone when the tapped card held, or once the person scrolls', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const held = renderHook(() => useAnchoredFeed({ items, startIndex: 4 }));
    const heldList = { scrollToIndex: vi.fn() };
    held.result.current.listRef.current = heldList as never;
    act(() => {
      held.result.current.onContentSizeChange(390, 1200);
    });
    runFrames();
    act(() => {
      held.result.current.onViewableItemsChanged({
        viewableItems: [{ index: 4, isViewable: true, item: 'e', key: 'e' }],
      } as never);
      vi.advanceTimersByTime(250);
    });
    expect(heldList.scrollToIndex).not.toHaveBeenCalled();
    held.unmount();

    const scrolled = renderHook(() => useAnchoredFeed({ items, startIndex: 4 }));
    const scrolledList = { scrollToIndex: vi.fn() };
    scrolled.result.current.listRef.current = scrolledList as never;
    act(() => {
      scrolled.result.current.onContentSizeChange(390, 1200);
    });
    runFrames();
    act(() => {
      scrolled.result.current.onScrollBeginDrag();
      scrolled.result.current.onViewableItemsChanged({
        viewableItems: [{ index: 1, isViewable: true, item: 'b', key: 'b' }],
      } as never);
      vi.advanceTimersByTime(250);
    });
    expect(scrolledList.scrollToIndex).not.toHaveBeenCalled();
    scrolled.unmount();
    vi.useRealTimers();
  });

  it('drops the pending frame when the feed closes first', () => {
    const hook = renderHook(() => useAnchoredFeed({ items, startIndex: 3 }));
    act(() => {
      hook.result.current.onContentSizeChange(390, 700);
    });

    hook.unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });
});
