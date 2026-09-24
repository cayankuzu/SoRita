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

  it('drops the pending frame when the feed closes first', () => {
    const hook = renderHook(() => useAnchoredFeed({ items, startIndex: 3 }));
    act(() => {
      hook.result.current.onContentSizeChange(390, 700);
    });

    hook.unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });
});
