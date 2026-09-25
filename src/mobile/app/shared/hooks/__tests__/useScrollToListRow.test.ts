import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useScrollToListRow } from '@/mobile/app/shared/hooks/useScrollToListRow';
import { act, renderHook } from '@/mobile/app/test/hookTestUtils';

type Hook = ReturnType<typeof useScrollToListRow>;

// A list that measures rows up to `measured`; aiming past it fails the way
// VirtualizedList does, by calling onScrollToIndexFailed synchronously.
function setup({ targetIndex = 5 }: { targetIndex?: number } = {}) {
  const state = { measured: -1, targetKey: 'place-5' as string | null };
  const onDone = vi.fn(() => {
    state.targetKey = null;
  });
  let current!: Hook;
  const list = {
    scrollToIndex: vi.fn(({ index }: { index: number }) => {
      if (index > state.measured) {
        current.onScrollToIndexFailed({ highestMeasuredFrameIndex: state.measured, index });
      }
    }),
  };
  const listRef = { current: list };
  const hook = renderHook(() => {
    current = useScrollToListRow({
      listRef,
      onDone,
      targetIndex,
      targetKey: state.targetKey,
    });
    return current;
  });

  return { hook, list, onDone, state };
}

describe('useScrollToListRow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps trying as rows get measured, then aims once more before letting go', () => {
    const { hook, list, onDone, state } = setup();

    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(list.scrollToIndex).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();

    // Three rows measured: the list steps to the last one to render more.
    state.measured = 2;
    act(() => {
      hook.result.current.onContentSizeChange();
      vi.advanceTimersByTime(60);
    });
    expect(list.scrollToIndex).toHaveBeenLastCalledWith({ animated: false, index: 2 });

    state.measured = 8;
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(list.scrollToIndex).toHaveBeenLastCalledWith({
      animated: true,
      index: 5,
      viewOffset: 12,
      viewPosition: 0.08,
    });
    expect(onDone).not.toHaveBeenCalled();

    // Images above the row finished loading: one more aim, then done.
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onDone).toHaveBeenCalledOnce();
    hook.rerender();

    const calls = list.scrollToIndex.mock.calls.length;
    act(() => {
      hook.result.current.onContentSizeChange();
      vi.advanceTimersByTime(2000);
    });
    expect(list.scrollToIndex).toHaveBeenCalledTimes(calls);
  });

  it('lets go the moment the person drags the list', () => {
    const { hook, list, onDone } = setup();

    act(() => {
      vi.advanceTimersByTime(16);
    });
    act(() => {
      hook.result.current.onScrollBeginDrag();
    });
    expect(onDone).toHaveBeenCalledOnce();
    hook.rerender();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(list.scrollToIndex).toHaveBeenCalledTimes(1);
  });

  it('gives up after a bounded number of tries on a list that never measures the row', () => {
    const { list, onDone } = setup();

    act(() => {
      vi.advanceTimersByTime(16 + 250 * 25);
    });
    expect(onDone).toHaveBeenCalledOnce();
    expect(list.scrollToIndex).toHaveBeenCalledTimes(20);
  });

  it('does nothing without a row to reach', () => {
    const { list, onDone } = setup({ targetIndex: -1 });

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(list.scrollToIndex).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});
